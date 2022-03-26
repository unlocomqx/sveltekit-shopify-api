import { RequestEvent } from "@sveltejs/kit/types/private"
import { AuthConfig } from "../auth/oauth/types.js"

import { GraphqlClient } from "../clients/graphql/index.js"
import * as ShopifyErrors from "../error.js"

import loadCurrentSession from "./load-current-session.js"

export default async function graphqlProxy (
  config: AuthConfig,
  event: RequestEvent,
): Promise<Response> {
  const session = await loadCurrentSession(config, event)
  if (!session) {
    throw new ShopifyErrors.SessionNotFound(
      "Cannot proxy query. No session found.",
    )
  } else if (!session.accessToken) {
    throw new ShopifyErrors.InvalidSession(
      "Cannot proxy query. Session not authenticated.",
    )
  }

  const shopName: string = session.shop
  const token: string = session.accessToken

  const json = await event.request.json()

  const options = {
    data: json,
  }
  const client = new GraphqlClient(config, shopName, token)

  const response = await client.query(config, options)
  return new Response(JSON.stringify(response.body))
}
