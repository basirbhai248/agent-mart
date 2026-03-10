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

function normalizeListing(listing) {
  return {
    id: normalizeText(listing?._id ?? listing?.id),
    title: normalizeText(listing?.title),
    price: normalizePrice(listing?.priceUsdc ?? listing?.price),
    creator: normalizeText(
      listing?.creator ??
        listing?.creatorName ??
        listing?.creatorDisplayName ??
        listing?.creatorId,
    ),
  };
}

function pad(value, width) {
  return value.padEnd(width, " ");
}

export function formatSearchResultsTable(listings) {
  const rows = listings.map(normalizeListing);
  if (rows.length === 0) {
    return "No results found.";
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

async function parseSearchResponse(response) {
  if (typeof response.json === "function") {
    return await response.json();
  }

  if (!response.body) {
    throw new Error("Search response must be JSON");
  }

  const text = await new Response(response.body).text();
  return JSON.parse(text);
}

function isNetworkFetchError(error) {
  if (!(error instanceof TypeError)) {
    return false;
  }

  const causeCode = error.cause?.code;
  return typeof causeCode === "string" && causeCode.length > 0;
}

export async function searchListings(queryInput, options = {}, deps = {}) {
  const query = normalizeRequiredOption(queryInput, "<query>");
  const apiUrl = resolveApiUrl({ apiUrl: options.apiUrl, env: deps.env });

  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch implementation is unavailable");
  }

  const endpoint = new URL("/api/search", apiUrl);
  endpoint.searchParams.set("q", query);

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "GET",
    });
  } catch (error) {
    if (isNetworkFetchError(error)) {
      return [];
    }
    throw error;
  }

  if (!response.ok) {
    const errorMessage = await parseResponseError(response);
    throw new Error(`Search failed (${response.status}): ${errorMessage}`);
  }

  const payload = await parseSearchResponse(response);
  if (!Array.isArray(payload)) {
    throw new Error("Search response must be an array");
  }

  return payload;
}

export function createSearchAction(deps = {}) {
  const logger = deps.logger ?? console;
  return async (query, options) => {
    const listings = await searchListings(query, options, deps);
    logger.log(formatSearchResultsTable(listings));
  };
}
