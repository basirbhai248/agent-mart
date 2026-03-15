import { NextResponse } from "next/server";
import { base } from "@base-org/account/node";

const SUBSCRIPTION_AMOUNT_USDC = "0.001";
const SUBSCRIPTION_PERIOD_DAYS = 30;

let _cachedWalletAddress: string | null = null;

async function getSubscriptionOwnerAddress(): Promise<string> {
  if (_cachedWalletAddress) return _cachedWalletAddress;

  const result = await base.subscription.getOrCreateSubscriptionOwnerWallet({});
  _cachedWalletAddress = result.address;
  return result.address;
}

export async function GET(): Promise<NextResponse> {
  try {
    const subscriptionOwner = await getSubscriptionOwnerAddress();

    return NextResponse.json({
      subscriptionOwner,
      amountUsdc: SUBSCRIPTION_AMOUNT_USDC,
      periodDays: SUBSCRIPTION_PERIOD_DAYS,
      network: "base",
      chainId: 8453,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[subscription/setup] Failed:", msg);
    return NextResponse.json(
      { error: "Failed to initialize subscription wallet" },
      { status: 500 },
    );
  }
}
