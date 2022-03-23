/* eslint-disable @typescript-eslint/naming-convention */
import { ApiVersion } from "../../base-types"
import { AuthScopes } from "../scopes"
import { SessionStorage } from "../session"
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
  afterAuth: (result: AuthValidationResult) => void

  API_KEY: string;
  API_SECRET_KEY: string;
  SCOPES: string[] | AuthScopes;
  HOST_NAME: string;
  API_VERSION: ApiVersion;
  IS_EMBEDDED_APP: boolean;
  IS_PRIVATE_APP?: boolean;
  SESSION_STORAGE?: SessionStorage;
  LOG_FILE?: string;
  USER_AGENT_PREFIX?: string;
  PRIVATE_APP_STOREFRONT_ACCESS_TOKEN?: string;
}

export type AuthResult = {
  location: string
  cookie: string
}

export type AuthValidationResult = {
  session: SessionInterface
  host: string | undefined
  cookie: string
}

export interface OnlineAccessResponse
  extends AccessTokenResponse,
    OnlineAccessInfo {
}
