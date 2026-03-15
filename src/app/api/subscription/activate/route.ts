import { proxyToConvex } from "../../_lib/proxy";

export async function POST(request: Request): Promise<Response> {
  return proxyToConvex(request, "/api/subscription/activate");
}
