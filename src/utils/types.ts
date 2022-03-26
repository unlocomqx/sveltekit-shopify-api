import http from "http"

import { Session } from "../auth/session/index.js"
import { GraphqlClient } from "../clients/graphql/index.js"
import { RestClient } from "../clients/rest/index.js"

export interface WithSessionParams {
  clientType: "rest" | "graphql";
  isOnline: boolean;
  req?: http.IncomingMessage;
  res?: http.ServerResponse;
  shop?: string;
}

interface WithSessionBaseResponse {
  session: Session;
}

export interface RestWithSession extends WithSessionBaseResponse {
  client: RestClient;
}

export interface GraphqlWithSession extends WithSessionBaseResponse {
  client: GraphqlClient;
}

export type WithSessionResponse = RestWithSession | GraphqlWithSession;
