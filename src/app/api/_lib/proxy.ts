const CONVEX_BASE_URL_ENV = "CONVEX_SITE_URL";
const NETWORK_ENV = "NEXT_PUBLIC_NETWORK";

function normalizedNetwork(value: string | undefined): "mainnet" | "testnet" {
  return value?.trim().toLowerCase() === "testnet" ? "testnet" : "mainnet";
}

function getConvexBaseUrl(): string {
  const value = process.env[CONVEX_BASE_URL_ENV]?.trim();
  if (!value) {
    throw new Error(`${CONVEX_BASE_URL_ENV} is required`);
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function buildConvexUrl(requestUrl: string, path: string): string {
  const source = new URL(requestUrl);
  const target = new URL(`${getConvexBaseUrl()}${path}`);
  const mergedParams = new URLSearchParams(target.search);
  source.searchParams.forEach((value, key) => {
    mergedParams.append(key, value);
  });
  target.search = mergedParams.toString();
  return target.toString();
}

async function requestBody(request: Request): Promise<ArrayBuffer | undefined> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const body = await request.arrayBuffer();
  return body.byteLength > 0 ? body : undefined;
}

export async function proxyToConvex(request: Request, path: string): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-agentmart-network", normalizedNetwork(process.env[NETWORK_ENV]));

  const upstream = await fetch(buildConvexUrl(request.url, path), {
    method: request.method,
    headers,
    body: await requestBody(request),
    redirect: "manual",
  });

  const body = await upstream.arrayBuffer();
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!["transfer-encoding", "content-encoding", "connection"].includes(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
