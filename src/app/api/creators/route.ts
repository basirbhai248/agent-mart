import { proxyToConvex } from "../_lib/proxy";

export async function GET(request: Request): Promise<Response> {
  return proxyToConvex(request, "/api/creators");
}
