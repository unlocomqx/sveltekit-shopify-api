import { AuthConfig } from "../../auth/oauth/types"
import { ShopifyHeader } from "../../base-types"
import { Context } from "../../context"
import * as ShopifyErrors from "../../error"
import { MissingRequiredArgument } from "../../error"
import { HttpClient } from "../http_client/http_client"
import { DataType, RequestReturn } from "../http_client/types"

import { GraphqlParams } from "./types"

export interface AccessTokenHeader {
  header: string;
  value: string;
}

export class GraphqlClient {
  protected baseApiPath = "/admin/api"

  private readonly client: HttpClient

  constructor (readonly domain: string, readonly accessToken?: string) {
    if (!Context.IS_PRIVATE_APP && !accessToken) {
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

    const path = `${ this.baseApiPath }/${ Context.API_VERSION }/graphql.json`

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
