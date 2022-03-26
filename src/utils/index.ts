import decodeSessionToken from "./decode-session-token.js"
import deleteCurrentSession from "./delete-current-session.js"
import graphqlProxy from "./graphql_proxy.js"
import validateHmac from "./hmac-validator.js"
import loadCurrentSession from "./load-current-session.js"
import nonce from "./nonce.js"
import safeCompare from "./safe-compare.js"
import validateShop from "./shop-validator.js"
import versionCompatible from "./version-compatible.js"

const ShopifyUtils = {
  decodeSessionToken,
  deleteCurrentSession,
  loadCurrentSession,
  nonce,
  graphqlProxy,
  safeCompare,
  validateHmac,
  validateShop,
  versionCompatible,
}

export default ShopifyUtils
