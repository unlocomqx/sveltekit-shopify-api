import { PostRequestParams } from "../http_client/types.js"

export type GraphqlParams = Omit<PostRequestParams, "path" | "type">;
