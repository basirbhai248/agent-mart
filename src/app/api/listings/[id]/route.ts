import { proxyToConvex } from "../../_lib/proxy";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { id } = await params;
  return proxyToConvex(request, `/api/listings/${encodeURIComponent(id)}`);
}
