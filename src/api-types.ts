import type { paths } from "./openapi.schema";

type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

// Extract path parameters
export type PathParams<P extends keyof paths, M extends HttpMethod = "get"> = paths[P][M] extends {
  parameters: { path: infer R };
}
  ? R
  : never;

// Extract request body
export type RequestBody<P extends keyof paths, M extends HttpMethod = "post"> = paths[P][M] extends {
  requestBody: { content: { "application/json": infer R } };
}
  ? R
  : never;

// Extract success response (200 or 201)
export type Response<
  P extends keyof paths,
  M extends HttpMethod = "get",
  S extends number = 200,
> = paths[P][M] extends { responses: { [K in S]: { content: { "application/json": infer R } } } } ? R : never;

// Combined endpoint type ensuring consistent HttpMethod
export type Endpoint<P extends keyof paths, M extends HttpMethod = "get", S extends number = 200> = {
  params: PathParams<P, M>;
  body: RequestBody<P, M>;
  response: Response<P, M, S>;
};
