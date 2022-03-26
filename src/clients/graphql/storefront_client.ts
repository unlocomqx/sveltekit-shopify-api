import { AuthConfig } from "../../auth/oauth/types"
import { ShopifyHeader } from "../../base-types"

import { AccessTokenHeader, GraphqlClient } from "./graphql_client"

export class StorefrontClient extends GraphqlClient {
  protected baseApiPath = "/api"

  protected getAccessTokenHeader (config: AuthConfig): AccessTokenHeader {
    return {
      header: ShopifyHeader.StorefrontAccessToken,
      value : (config.IS_PRIVATE_APP
        ? config.PRIVATE_APP_STOREFRONT_ACCESS_TOKEN || this.accessToken
        : this.accessToken) as string,
    }
  }
}
