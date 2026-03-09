import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

type Listing = {
  _id: string;
  title: string;
  description: string;
  priceUsdc: number;
  creatorId?: string;
  creatorName?: string;
  creatorWallet?: string;
};

type RouteProps = {
  params: Promise<{ id: string }>;
};

async function getListing(id: string): Promise<Listing | null> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return null;
  }

  const response = await fetch(
    `${protocol}://${host}/api/listings/${encodeURIComponent(id)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load listing ${id}`);
  }

  return (await response.json()) as Listing;
}

export default async function ListingDetailPage({ params }: RouteProps) {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    notFound();
  }

  const creatorSummary =
    listing.creatorName ?? listing.creatorWallet ?? listing.creatorId;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
        Listing details
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
        {listing.title}
      </h1>
      <p className="whitespace-pre-wrap text-base leading-7 text-zinc-300">
        {listing.description}
      </p>

      <dl className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-[0.12em] text-zinc-500">
            Price
          </dt>
          <dd className="mt-1 text-lg font-semibold text-zinc-100">
            {listing.priceUsdc} USDC
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.12em] text-zinc-500">
            Creator
          </dt>
          <dd className="mt-1 text-sm text-zinc-200">
            {creatorSummary ?? "Unknown creator"}
          </dd>
        </div>
      </dl>

      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        Purchases are agent-only and must be completed via CLI.
      </p>

      <Link href="/" className="inline-flex text-sm text-zinc-300 underline">
        Back to listings
      </Link>
    </section>
  );
}
