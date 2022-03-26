import { GetRequestParams, RequestReturn } from "../http_client/types.js"

export interface PageInfo {
  limit: string;
  fields?: string[];
  previousPageUrl?: string;
  nextPageUrl?: string;
  prevPage?: GetRequestParams;
  nextPage?: GetRequestParams;
}

export type RestRequestReturn = RequestReturn & {
  pageInfo?: PageInfo;
};
