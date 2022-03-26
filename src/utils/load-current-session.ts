import { RequestEvent } from "@sveltejs/kit/types/private"
import { ShopifyOAuth } from "../auth/oauth/oauth.js"
import { AuthConfig } from "../auth/oauth/types.js"
import { Session } from "../auth/session/index.js"

/**
 * Loads the current user's session, based on the given request and response.
 *
 * @param request  Current HTTP request
 * @param response Current HTTP response
 * @param isOnline Whether to load online (default) or offline sessions (optional)
 */
export default async function loadCurrentSession (
  config: AuthConfig,
  event: RequestEvent,
  isOnline = true,
): Promise<Session | undefined> {
  const sessionId = ShopifyOAuth.getCurrentSessionId(
    event,
    config,
    isOnline,
  )
  if (!sessionId) {
    return Promise.resolve(undefined)
  }

  return config.SESSION_STORAGE ?
    config.SESSION_STORAGE.loadSession(sessionId) :
    undefined
}
