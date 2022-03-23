import { RequestEvent } from "@sveltejs/kit/types/private"
import { ShopifyOAuth } from "../auth/oauth/oauth"
import { AuthConfig } from "../auth/oauth/types"
import { Session } from "../auth/session"

import { Context } from "../context"

/**
 * Loads the current user's session, based on the given request and response.
 *
 * @param request  Current HTTP request
 * @param response Current HTTP response
 * @param isOnline Whether to load online (default) or offline sessions (optional)
 */
export default async function loadCurrentSession (
  event: RequestEvent,
  config: AuthConfig,
  isOnline = true,
): Promise<Session | undefined> {
  Context.throwIfUninitialized()

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
