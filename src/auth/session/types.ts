import { AuthConfig, OnlineAccessInfo } from "../oauth/types.js"

export interface SessionInterface {
  readonly id: string;
  shop: string;
  state: string;
  isOnline: boolean;
  scope?: string;
  expires?: Date;
  accessToken?: string;
  onlineAccessInfo?: OnlineAccessInfo;
  isActive (config: AuthConfig): boolean;
}
