import { proxyToConvex } from "../../_lib/proxy";

type RouteContext = {
  params: Promise<{ wallet: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { wallet } = await params;
  return proxyToConvex(request, `/api/creators?wallet=${encodeURIComponent(wallet)}`);
}
