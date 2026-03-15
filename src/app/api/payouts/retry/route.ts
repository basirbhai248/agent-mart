import { NextResponse } from "next/server";
import {
  createWalletClient,
  http,
  publicActions,
  getAddress,
  parseAbi,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

function getPayoutClient() {
  const pk = process.env.FACILITATOR_PRIVATE_KEY?.trim();
  if (!pk) {
    throw new Error("FACILITATOR_PRIVATE_KEY is required");
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account,
    chain: base,
    transport: http(),
  }).extend(publicActions);
}

export async function POST(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const baseUrl = process.env.CONVEX_SITE_URL?.trim();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "CONVEX_SITE_URL not configured" },
      { status: 500 },
    );
  }

  // Fetch failed payouts from Convex
  const failedRes = await fetch(
    new URL("/api/payouts/failed", baseUrl),
  );
  if (!failedRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch failed payouts" },
      { status: 500 },
    );
  }

  const failedPayouts = await failedRes.json();
  if (!Array.isArray(failedPayouts) || failedPayouts.length === 0) {
    return NextResponse.json({ retried: 0, results: [] });
  }

  const client = getPayoutClient();
  const results: Array<{ wallet: string; status: string; txHash?: string; error?: string }> = [];

  for (const payout of failedPayouts) {
    try {
      const txHash = await client.writeContract({
        address: getAddress(USDC_ADDRESS),
        abi: USDC_ABI,
        functionName: "transfer",
        args: [
          getAddress(payout.creatorWallet),
          BigInt(payout.creatorAmount),
        ],
      });

      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      const success = receipt.status === "success";

      // Update payout status in Convex
      await fetch(new URL("/api/payout", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorWallet: payout.creatorWallet,
          grossAmount: payout.grossAmount,
          creatorAmount: payout.creatorAmount,
          platformAmount: payout.platformAmount,
          txHash,
          status: success ? "completed" : "failed",
          error: success ? undefined : "Retry tx reverted",
        }),
      });

      results.push({
        wallet: payout.creatorWallet,
        status: success ? "completed" : "failed",
        txHash,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      results.push({
        wallet: payout.creatorWallet,
        status: "failed",
        error: errMsg,
      });
    }
  }

  return NextResponse.json({ retried: results.length, results });
}
