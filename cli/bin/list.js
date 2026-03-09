import { normalizeRequiredOption, resolveApiUrl } from "./register.js";

function normalizeText(value) {
  if (typeof value !== "string") {
    return "-";
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "-";
}

function normalizePrice(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  return normalizeText(value);
}

function normalizeListing(listing, creator) {
  return {
    id: normalizeText(listing?._id ?? listing?.id),
    title: normalizeText(listing?.title),
    price: normalizePrice(listing?.priceUsdc ?? listing?.price),
    creator: normalizeText(
      listing?.creator ??
        listing?.creatorName ??
        listing?.creatorDisplayName ??
        creator?.displayName ??
        creator?.wallet,
    ),
  };
}

function pad(value, width) {
  return value.padEnd(width, " ");
}

export function formatCreatorListingsTable(listings, creator) {
  const rows = listings.map((listing) => normalizeListing(listing, creator));
  if (rows.length === 0) {
    return "No listings found.";
  }

  const headers = ["ID", "title", "price", "creator"];
  const cells = rows.map((row) => [row.id, row.title, row.price, row.creator]);
  const widths = headers.map((header, index) => {
    return Math.max(
      header.length,
      ...cells.map((row) => row[index].length),
    );
  });

  const headerLine = headers.map((cell, index) => pad(cell, widths[index])).join(" | ");
  const separatorLine = widths.map((width) => "-".repeat(width)).join("-+-");
  const bodyLines = cells.map((row) =>
    row.map((cell, index) => pad(cell, widths[index])).join(" | "),
  );

  return [headerLine, separatorLine, ...bodyLines].join("\n");
}

async function parseResponseError(response) {
  const text = await response.text();
  try {
    const payload = JSON.parse(text);
    if (typeof payload?.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    // not JSON
  }
  return text || "Unknown error";
}

export async function getCreatorListings(options = {}, deps = {}) {
  const creatorWallet = normalizeRequiredOption(options.creator, "--creator");
  const apiUrl = resolveApiUrl({ apiUrl: options.apiUrl, env: deps.env });

  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch implementation is unavailable");
  }

  const response = await fetchImpl(
    new URL(`/api/creators/${encodeURIComponent(creatorWallet)}`, apiUrl),
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    const errorMessage = await parseResponseError(response);
    throw new Error(`List failed (${response.status}): ${errorMessage}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.listings)) {
    throw new Error("List response must include a listings array");
  }

  return payload;
}

export function createListAction(deps = {}) {
  const logger = deps.logger ?? console;
  return async (options) => {
    const payload = await getCreatorListings(options, deps);
    logger.log(formatCreatorListingsTable(payload.listings, payload.creator));
  };
}
