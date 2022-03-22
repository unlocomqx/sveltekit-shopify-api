/* eslint-disable @typescript-eslint/naming-convention */
import { SessionInterface } from "../session/types"

export interface AuthQuery {
  code: string;
  timestamp: string;
  state: string;
  shop: string;
  host?: string;
  hmac?: string;
}

export interface AccessTokenResponse {
  access_token: string;
  scope: string;
}

export interface OnlineAccessInfo {
  expires_in: number;
  associated_user_scope: string;
  associated_user: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    email_verified: boolean;
    account_owner: boolean;
    locale: string;
    collaborator: boolean;
  };
}

/* eslint-enable @typescript-eslint/naming-convention */

export type AuthConfig = {
  keys?: string[];
  myShopifyDomain?: string;
  accessMode?: "online" | "offline";
  prefix?: string

  API_KEY: string
  IS_PRIVATE_APP: boolean
}

export type AuthResult = {
  location: string
  cookie: string
}

export type AuthValidationResult = {
  session: SessionInterface
  cookie: string
}

export interface OnlineAccessResponse
  extends AccessTokenResponse,
    OnlineAccessInfo {
}
