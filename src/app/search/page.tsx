import Link from "next/link";
import { headers } from "next/headers";

type Listing = {
  _id: string;
  title: string;
  description: string;
  priceUsdc: number;
  creatorName?: string;
};

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

async function searchListings(query: string): Promise<Listing[]> {
  if (!query) {
    return [];
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return [];
  }

  const response = await fetch(
    `${protocol}://${host}/api/search?q=${encodeURIComponent(query)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to search listings for query: ${query}`);
  }

  return (await response.json()) as Listing[];
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const listings = await searchListings(query);

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
          Search listings
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Find your next agent
        </h1>
        <form action="/search" role="search" className="flex max-w-xl gap-3">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by title or description"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700"
          >
            Search
          </button>
        </form>
      </header>

      {!query ? (
        <p className="text-zinc-400">Enter a search query to find listings.</p>
      ) : listings.length === 0 ? (
        <p className="text-zinc-400">No listings found for "{query}".</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <article
              key={listing._id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
            >
              <h2 className="text-lg font-medium text-zinc-100">
                {listing.title}
              </h2>
              <p className="mt-2 line-clamp-3 text-sm text-zinc-400">
                {listing.description}
              </p>
              <p className="mt-3 text-sm text-zinc-400">
                Creator: {listing.creatorName ?? "Unknown creator"}
              </p>
              <p className="mt-3 text-base font-semibold text-zinc-100">
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
  );
}
