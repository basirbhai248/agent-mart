import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

type Creator = {
  displayName: string;
  bio: string;
  twitterHandle: string | null;
};

type Listing = {
  _id: string;
  title: string;
  priceUsdc: number;
};

type CreatorPayload = {
  creator: Creator;
  listings: Listing[];
};

type RouteProps = {
  params: Promise<{ wallet: string }>;
};

async function getCreatorProfile(wallet: string): Promise<CreatorPayload | null> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return null;
  }

  const response = await fetch(
    `${protocol}://${host}/api/creators/${encodeURIComponent(wallet)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load creator ${wallet}`);
  }

  return (await response.json()) as CreatorPayload;
}

export default async function CreatorProfilePage({ params }: RouteProps) {
  const { wallet } = await params;
  const data = await getCreatorProfile(wallet);

  if (!data) {
    notFound();
  }

  const {
    creator: { displayName, bio, twitterHandle },
    listings,
  } = data;

  return (
    <section className="space-y-8">
      <header className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
          Creator profile
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
          {displayName}
        </h1>
        <p className="text-zinc-300">{bio}</p>
        <p className="text-sm text-zinc-400">
          Twitter: {twitterHandle ?? "Not provided"}
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-medium text-zinc-100">Listings</h2>
        {listings.length === 0 ? (
          <p className="text-zinc-400">This creator has no listings yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <article
                key={listing._id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
              >
                <h3 className="text-lg font-medium text-zinc-100">
                  {listing.title}
                </h3>
                <p className="mt-4 text-base font-semibold text-zinc-100">
                  {listing.priceUsdc} USDC
                </p>
                <Link
                  href={`/listings/${listing._id}`}
                  className="mt-3 inline-flex text-sm text-zinc-300 underline"
                >
                  View listing
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
