import { proxyToConvex } from "../_lib/proxy";

export async function POST(request: Request): Promise<Response> {
  return proxyToConvex(request, "/api/listings");
}

export async function GET(request: Request): Promise<Response> {
  return proxyToConvex(request, "/api/listings");
}

export async function PUT(request: Request): Promise<Response> {
  return proxyToConvex(request, "/api/listings");
}

export async function DELETE(request: Request): Promise<Response> {
  return proxyToConvex(request, "/api/listings");
}
