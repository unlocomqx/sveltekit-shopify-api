import { GraphqlClient as Graphql } from "./graphql/index.js"
import { StorefrontClient as Storefront } from "./graphql/storefront_client.js"
import { RestClient as Rest } from "./rest/index.js"

const ShopifyClients = {
  Rest,
  Graphql,
  Storefront,
}

export default ShopifyClients
export { ShopifyClients }
