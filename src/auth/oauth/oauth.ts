import { RequestEvent } from "@sveltejs/kit/types/private"
import cookie from "cookie"
import querystring from "querystring"

import { v4 as uuidv4 } from "uuid"
import { HttpClient } from "../../clients/http_client/http_client"
import { DataType } from "../../clients/http_client/types"
import * as ShopifyErrors from "../../error"
import decodeSessionToken from "../../utils/decode-session-token"
import validateHmac from "../../utils/hmac-validator"
import nonce from "../../utils/nonce"
import safeCompare from "../../utils/safe-compare"
import validateShop from "../../utils/shop-validator"
import { Session } from "../session"

import {
  AccessTokenResponse,
  AuthConfig,
  AuthQuery,
  AuthResult,
  AuthValidationResult,
  OnlineAccessInfo,
  OnlineAccessResponse,
} from "./types"

const ShopifyOAuth = {
  SESSION_COOKIE_NAME: "shopify_app_session",

  /**
   * Initializes a session and cookie for the OAuth process, and returns the necessary authorization url.
   *
   * @param request Current HTTP Request
   * @param response Current HTTP Response
   * @param shop Shop url: {shop}.myshopify.com
   * @param redirect Redirect url for callback
   * @param isOnline Boolean value. If true, appends 'per-user' grant options to authorization url to receive online access token.
   *                 During final oauth request, will receive back the online access token and current online session information.
   *                 Defaults to online access.
   */
  async beginAuth (
    config: AuthConfig,
    shop: string,
    redirectPath: string,
    isOnline = true,
  ): Promise<AuthResult> {

    if (config.IS_PRIVATE_APP) {
      throw new Error("Cannot perform OAuth for private apps")
    }

    const state = nonce()

    const session = new Session(
      isOnline ? uuidv4() : this.getOfflineSessionId(shop),
      shop,
      state,
      isOnline,
    )

    const sessionStored = config.SESSION_STORAGE &&
      await config.SESSION_STORAGE.storeSession(session)

    if (!sessionStored) {
      throw new ShopifyErrors.SessionStorageError(
        "OAuth Session could not be saved. Please check your session storage functionality.",
      )
    }

    /* eslint-disable @typescript-eslint/naming-convention */
    const query = {
      client_id        : config.API_KEY,
      scope            : config.SCOPES.toString(),
      redirect_uri     : `https://${ config.HOST_NAME }${ redirectPath }`,
      state,
      "grant_options[]": isOnline ? "per-user" : "",
    }
    /* eslint-enable @typescript-eslint/naming-convention */

    const queryString = querystring.stringify(query)

    return {
      location: `https://${ shop }/admin/oauth/authorize?${ queryString }`,
      cookie  : cookie.serialize(ShopifyOAuth.SESSION_COOKIE_NAME, session.id, {
        path    : "/",
        expires : new Date(Date.now() + 60000),
        sameSite: "lax",
        secure  : true,
      })
    }
  },

  /**
   * Validates the received callback query.
   * If valid, will make the subsequent request to update the current session with the appropriate access token.
   * Throws errors for missing sessions and invalid callbacks.
   *
   * @param request Current HTTP Request
   * @param response Current HTTP Response
   * @param query Current HTTP Request Query, containing the information to be validated.
   *              Depending on framework, this may need to be cast as "unknown" before being passed.
   * @returns SessionInterface
   */
  async validateAuthCallback (
    event: RequestEvent,
    config: AuthConfig,
    query: AuthQuery,
  ): Promise<AuthValidationResult> {
    if (config.IS_PRIVATE_APP) {
      throw new Error("Cannot perform OAuth for private apps")
    }

    const cookies = cookie.parse(event.request.headers.get("cookie") || "")

    const sessionCookie = this.getCookieSessionId(cookies)
    if (!sessionCookie) {
      throw new ShopifyErrors.CookieNotFound(
        `Cannot complete OAuth process. Could not find an OAuth cookie for shop url: ${ query.shop }`,
      )
    }

    let currentSession = config.SESSION_STORAGE &&
      await config.SESSION_STORAGE.loadSession(
        sessionCookie,
      )
    if (!currentSession) {
      throw new ShopifyErrors.SessionNotFound(
        `Cannot complete OAuth process. No session found for the specified shop url: ${ query.shop }`,
      )
    }

    if (!validQuery(config, query, currentSession)) {
      throw new ShopifyErrors.InvalidOAuthError("Invalid OAuth callback.")
    }

    /* eslint-disable @typescript-eslint/naming-convention */
    const body = {
      client_id    : config.API_KEY,
      client_secret: config.API_SECRET_KEY,
      code         : query.code,
    }
    /* eslint-enable @typescript-eslint/naming-convention */

    const postParams = {
      path: "/admin/oauth/access_token",
      type: DataType.JSON,
      data: body,
    }

    const client = new HttpClient(currentSession.shop)
    const postResponse = await client.post(postParams)

    if (currentSession.isOnline) {
      const responseBody = postResponse.body as OnlineAccessResponse
      const { access_token, scope, ...rest } = responseBody // eslint-disable-line @typescript-eslint/naming-convention
      const sessionExpiration = new Date(
        Date.now() + responseBody.expires_in * 1000,
      )
      currentSession.accessToken = access_token
      currentSession.expires = sessionExpiration
      currentSession.scope = scope
      currentSession.onlineAccessInfo = rest

      // For an online session in an embedded app, we no longer want the cookie session so we delete it
      if (config.IS_EMBEDDED_APP) {
        // If this is an online session for an embedded app, replace the online session with a JWT session
        const onlineInfo = currentSession.onlineAccessInfo as OnlineAccessInfo
        const jwtSessionId = this.getJwtSessionId(
          currentSession.shop,
          `${ onlineInfo.associated_user.id }`,
        )
        const jwtSession = Session.cloneSession(currentSession, jwtSessionId)

        const sessionDeleted = config.SESSION_STORAGE &&
          await config.SESSION_STORAGE.deleteSession(
            currentSession.id,
          )
        if (!sessionDeleted) {
          throw new ShopifyErrors.SessionStorageError(
            "OAuth Session could not be deleted. Please check your session storage functionality.",
          )
        }
        currentSession = jwtSession
      }
    } else {
      // Offline sessions (embedded / non-embedded) will use the same id so they don't need to be updated
      const responseBody = postResponse.body as AccessTokenResponse
      currentSession.accessToken = responseBody.access_token
      currentSession.scope = responseBody.scope
    }

    const sessionStored = config.SESSION_STORAGE &&
      await config.SESSION_STORAGE.storeSession(
        currentSession,
      )
    if (!sessionStored) {
      throw new ShopifyErrors.SessionStorageError(
        "OAuth Session could not be saved. Please check your session storage functionality.",
      )
    }

    return {
      session: currentSession,
      host   : query.host,
      cookie : cookie.serialize(ShopifyOAuth.SESSION_COOKIE_NAME, currentSession.id, {
        path    : "/",
        expires : config.IS_EMBEDDED_APP ? new Date() : currentSession.expires,
        sameSite: "lax",
        secure  : true,
      })
    }
  },

  /**
   * Loads the current session id from the session cookie.
   *
   * @param cookies HTTP cookies
   */
  getCookieSessionId (
    cookies: Record<string, string>
  ): string | undefined {
    return cookies[this.SESSION_COOKIE_NAME]
  },

  /**
   * Builds a JWT session id from the current shop and user.
   *
   * @param shop Shopify shop domain
   * @param userId Current actor id
   */
  getJwtSessionId (shop: string, userId: string): string {
    return `${ shop }_${ userId }`
  },

  /**
   * Builds an offline session id for the given shop.
   *
   * @param shop Shopify shop domain
   */
  getOfflineSessionId (shop: string): string {
    return `offline_${ shop }`
  },

  /**
   * Extracts the current session id from the request / response pair.
   *
   * @param request  HTTP request object
   * @param response HTTP response object
   * @param isOnline Whether to load online (default) or offline sessions (optional)
   */
  getCurrentSessionId (
    event: RequestEvent,
    config: AuthConfig,
    isOnline = true,
  ): string | undefined {
    let currentSessionId: string | undefined

    const { request } = event

    let cookies = cookie.parse(request.headers.get("cookie") || "")

    if (config.IS_EMBEDDED_APP) {
      const authHeader = request.headers.get("authorization")
      if (authHeader) {
        const matches = authHeader.match(/^Bearer (.+)$/)
        if (!matches) {
          throw new ShopifyErrors.MissingJwtTokenError(
            "Missing Bearer token in authorization header",
          )
        }

        const jwtPayload = decodeSessionToken(matches[1])
        const shop = jwtPayload.dest.replace(/^https:\/\//, "")
        if (isOnline) {
          currentSessionId = this.getJwtSessionId(shop, jwtPayload.sub)
        } else {
          currentSessionId = this.getOfflineSessionId(shop)
        }
      }
    }

    // Non-embedded apps will always load sessions using cookies. However, we fall back to the cookie session for
    // embedded apps to allow apps to load their skeleton page after OAuth, so they can set up App Bridge and get a new
    // JWT.
    if (!currentSessionId) {
      // We still want to get the offline session id from the cookie to make sure it's validated
      currentSessionId = this.getCookieSessionId(cookies)
    }

    return currentSessionId
  },
}

/**
 * Uses the validation utils validateHmac, validateShop, and safeCompare to assess whether the callback is valid.
 *
 * @param query Current HTTP Request Query
 * @param session Current session
 */
function validQuery (config: AuthConfig, query: AuthQuery, session: Session): boolean {
  return (
    validateHmac(config, query) &&
    validateShop(query.shop) &&
    safeCompare(query.state, session.state as string)
  )
}

export { ShopifyOAuth }
