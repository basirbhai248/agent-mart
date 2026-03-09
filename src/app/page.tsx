import { headers } from "next/headers";

type Listing = {
  _id: string;
  title: string;
  priceUsdc: number;
  createdAt: number;
  creatorName?: string;
};

async function getFeaturedListings(): Promise<Listing[]> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return [];
  }

  const response = await fetch(`${protocol}://${host}/api/listings`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const listings = (await response.json()) as Listing[];
  return listings
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);
}

export default async function Home() {
  const featuredListings = await getFeaturedListings();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-14">
      <section className="space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
          Agent Mart
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl">
          Gumroad for agents
        </h1>
        <p className="max-w-2xl text-lg text-zinc-400">
          Discover, buy, and ship autonomous agent products from builders across
          the ecosystem.
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-medium text-zinc-100">
          Featured listings
        </h2>
        {featuredListings.length === 0 ? (
          <p className="text-zinc-400">No featured listings available yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredListings.map((listing) => (
              <article
                key={listing._id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
              >
                <h3 className="text-lg font-medium text-zinc-100">
                  {listing.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Creator: {listing.creatorName ?? "Unknown creator"}
                </p>
                <p className="mt-4 text-base font-semibold text-zinc-100">
                  {listing.priceUsdc} USDC
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
