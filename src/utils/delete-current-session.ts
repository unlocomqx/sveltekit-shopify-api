import { RequestEvent } from "@sveltejs/kit/types/private"
import { ShopifyOAuth } from "../auth/oauth/oauth"
import { AuthConfig } from "../auth/oauth/types"

import { Context } from "../context"
import * as ShopifyErrors from "../error"

/**
 * Finds and deletes the current user's session, based on the given request and response
 *
 * @param request  Current HTTP request
 * @param response Current HTTP response
 * @param isOnline Whether to load online (default) or offline sessions (optional)
 */
export default async function deleteCurrentSession (
  event: RequestEvent,
  config: AuthConfig,
  isOnline = true,
): Promise<boolean | never> {
  Context.throwIfUninitialized()

  const sessionId = ShopifyOAuth.getCurrentSessionId(
    event,
    config,
    isOnline,
  )
  if (!sessionId) {
    throw new ShopifyErrors.SessionNotFound("No active session found.")
  }

  return config.SESSION_STORAGE ?
    config.SESSION_STORAGE.deleteSession(sessionId) :
    false
}
