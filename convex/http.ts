import { httpActionGeneric as httpAction, httpRouter } from "convex/server";

import { createCreator } from "./mutations.ts";
import { getCreatorByWallet } from "./queries.ts";

const http = httpRouter();

export const registerCreator = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const wallet = asNonEmptyString(payload?.wallet);
  const displayName = asNonEmptyString(payload?.displayName ?? payload?.name);
  const bio = asNonEmptyString(payload?.bio);
  const twitterHandle = asOptionalNonEmptyString(payload?.twitterHandle);

  if (!wallet || !displayName || !bio) {
    return json({ error: "wallet, displayName, and bio are required" }, 400);
  }

  const existingCreator = await ctx.runQuery(getCreatorByWallet, { wallet });
  if (existingCreator) {
    return json({ error: "Creator already registered for wallet" }, 409);
  }

  const apiKey = crypto.randomUUID();
  const creatorId = await ctx.runMutation(createCreator, {
    wallet,
    displayName,
    bio,
    twitterHandle,
    apiKey,
  });

  return json({ creatorId, apiKey }, 201);
});

http.route({
  path: "/api/register",
  method: "POST",
  handler: registerCreator,
});

export default http;

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asOptionalNonEmptyString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return asNonEmptyString(value);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
