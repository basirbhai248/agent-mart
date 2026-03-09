import { proxyToConvex } from "../_lib/proxy";

export async function POST(request: Request): Promise<Response> {
  return proxyToConvex(request, "/api/listings");
}

export async function GET(request: Request): Promise<Response> {
  return proxyToConvex(request, "/api/listings");
}
