import jwt from "jsonwebtoken"
import { AuthConfig } from "../auth/oauth/types.js"

import * as ShopifyErrors from "../error.js"

import validateShop from "./shop-validator.js"

const JWT_PERMITTED_CLOCK_TOLERANCE = 5

interface JwtPayload {
  iss: string;
  dest: string;
  aud: string;
  sub: string;
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sid: string;
}

/**
 * Decodes the given session token, and extracts the session information from it
 *
 * @param token Received session token
 */
function decodeSessionToken (config: AuthConfig, token: string): JwtPayload {
  let payload: JwtPayload
  try {
    payload = jwt.verify(token, config.API_SECRET_KEY, {
      algorithms    : ["HS256"],
      clockTolerance: JWT_PERMITTED_CLOCK_TOLERANCE,
    }) as JwtPayload
  } catch (error) {
    throw new ShopifyErrors.InvalidJwtError(
      `Failed to parse session token '${ token }': ${ error.message }`,
    )
  }

  // The exp and nbf fields are validated by the JWT library

  if (payload.aud !== config.API_KEY) {
    throw new ShopifyErrors.InvalidJwtError(
      "Session token had invalid API key",
    )
  }

  if (!validateShop(payload.dest.replace(/^https:\/\//, ""))) {
    throw new ShopifyErrors.InvalidJwtError("Session token had invalid shop")
  }

  return payload
}

export default decodeSessionToken

export { decodeSessionToken, JwtPayload }
