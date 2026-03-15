import { NextResponse } from "next/server";
import { base } from "@base-org/account/node";

const SUBSCRIPTION_AMOUNT_USDC = "10";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getConvexBaseUrl(): string {
  const url = process.env.CONVEX_SITE_URL?.trim();
  if (!url) throw new Error("CONVEX_SITE_URL is required");
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convexUrl = getConvexBaseUrl();

  // Fetch creators with due subscriptions from Convex
  const dueRes = await fetch(`${convexUrl}/api/subscription/due`, {
    method: "GET",
    headers: { "x-cron-secret": cronSecret ?? "" },
  });
  if (!dueRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch due subscriptions" },
      { status: 500 },
    );
  }

  const creators = await dueRes.json();
  if (!Array.isArray(creators) || creators.length === 0) {
    return NextResponse.json({ charged: 0, message: "No subscriptions due" });
  }

  const results: Array<{
    wallet: string;
    status: string;
    txHash?: string;
    error?: string;
  }> = [];

  for (const creator of creators) {
    if (!creator.subscriptionId) {
      results.push({
        wallet: creator.wallet,
        status: "lapsed",
        error: "No subscription ID stored",
      });
      await updateSubscription(convexUrl, cronSecret, {
        creatorId: creator._id,
        subscriptionStatus: "lapsed",
      });
      continue;
    }

    try {
      const chargeResult = await base.subscription.charge({
        id: creator.subscriptionId,
        amount: SUBSCRIPTION_AMOUNT_USDC,
      });

      if (chargeResult.success) {
        await updateSubscription(convexUrl, cronSecret, {
          creatorId: creator._id,
          subscriptionStatus: "active",
          subscriptionExpiresAt: Date.now() + THIRTY_DAYS_MS,
          subscriptionTxHash: chargeResult.id,
        });
        results.push({
          wallet: creator.wallet,
          status: "renewed",
          txHash: chargeResult.id,
        });
      } else {
        await updateSubscription(convexUrl, cronSecret, {
          creatorId: creator._id,
          subscriptionStatus: "lapsed",
        });
        results.push({ wallet: creator.wallet, status: "lapsed", error: "Charge failed" });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("[charge] Failed for", creator.wallet, errMsg);
      await updateSubscription(convexUrl, cronSecret, {
        creatorId: creator._id,
        subscriptionStatus: "lapsed",
      });
      results.push({ wallet: creator.wallet, status: "lapsed", error: errMsg });
    }
  }

  return NextResponse.json({
    charged: results.filter((r) => r.status === "renewed").length,
    lapsed: results.filter((r) => r.status === "lapsed").length,
    results,
  });
}

async function updateSubscription(
  convexUrl: string,
  cronSecret: string | undefined,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(`${convexUrl}/api/subscription/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret ?? "",
      },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.error("[charge] Failed to update subscription:", e);
  }
}
