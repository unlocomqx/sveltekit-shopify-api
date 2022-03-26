import { Session } from "./session.js"
import { SessionStorage } from "./session_storage.js"
import { CustomSessionStorage } from "./storage/custom.js"
import { MemorySessionStorage } from "./storage/memory.js"

const ShopifySession = {
  Session,
  MemorySessionStorage,
  CustomSessionStorage,
}

export default ShopifySession
export { Session, SessionStorage, MemorySessionStorage, CustomSessionStorage }
