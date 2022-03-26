import { AuthConfig, OnlineAccessInfo } from "../oauth/types.js"

import { SessionInterface } from "./types.js"

/**
 * Stores App information from logged in merchants so they can make authenticated requests to the Admin API.
 */
class Session implements SessionInterface {
  public static cloneSession (session: Session, newId: string): Session {
    const newSession = new Session(
      newId,
      session.shop,
      session.state,
      session.isOnline,
    )

    newSession.scope = session.scope
    newSession.expires = session.expires
    newSession.accessToken = session.accessToken
    newSession.onlineAccessInfo = session.onlineAccessInfo

    return newSession
  }

  public scope?: string
  public expires?: Date
  public accessToken?: string
  public onlineAccessInfo?: OnlineAccessInfo

  constructor (
    readonly id: string,
    public shop: string,
    public state: string,
    public isOnline: boolean,
  ) {
  }

  public isActive (config: AuthConfig): boolean {
    const scopesUnchanged = config.SCOPES.toString() === this.scope
    if (
      scopesUnchanged &&
      this.accessToken &&
      (!this.expires || this.expires >= new Date())
    ) {
      return true
    }
    return false
  }
}

export { Session }
