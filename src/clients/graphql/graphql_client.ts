import { AuthConfig } from "../../auth/oauth/types.js"
import { ShopifyHeader } from "../../base-types.js"
import * as ShopifyErrors from "../../error.js"
import { MissingRequiredArgument } from "../../error.js"
import { HttpClient } from "../http_client/http_client.js"
import { DataType, RequestReturn } from "../http_client/types.js"

import { GraphqlParams } from "./types.js"

export interface AccessTokenHeader {
  header: string;
  value: string;
}

export class GraphqlClient {
  protected baseApiPath = "/admin/api"

  private readonly client: HttpClient

  constructor (readonly config: AuthConfig, readonly domain: string, readonly accessToken?: string) {
    if (!this.config.IS_PRIVATE_APP && !accessToken) {
      throw new ShopifyErrors.MissingRequiredArgument(
        "Missing access token when creating GraphQL client",
      )
    }

    this.client = new HttpClient(this.domain)
  }

  async query (config: AuthConfig, params: GraphqlParams): Promise<RequestReturn> {
    if (params.data.length === 0) {
      throw new MissingRequiredArgument("Query missing.")
    }

    const accessTokenHeader = this.getAccessTokenHeader(config)
    params.extraHeaders = {
      [accessTokenHeader.header]: accessTokenHeader.value,
      ...params.extraHeaders,
    }

    const path = `${ this.baseApiPath }/${ this.config.API_VERSION }/graphql.json`

    let dataType: DataType.GraphQL | DataType.JSON

    if (typeof params.data === "object") {
      dataType = DataType.JSON
    } else {
      dataType = DataType.GraphQL
    }

    return this.client.post({ path, type: dataType, ...params })
  }

  protected getAccessTokenHeader (config: AuthConfig): AccessTokenHeader {
    return {
      header: ShopifyHeader.AccessToken,
      value : config.IS_PRIVATE_APP
        ? config.API_SECRET_KEY
        : (this.accessToken as string),
    }
  }
}
