#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${EVM_PRIVATE_KEY:-}" ]]; then
  # Hardcoded Base Sepolia test key for e2e workflow.
  EVM_PRIVATE_KEY="REDACTED_PRIVATE_KEY"
fi

run_id="$(date +%s)-$RANDOM"
wallet="0x$(openssl rand -hex 20)"
title="AgentMart E2E Listing ${run_id}"
bio="AgentMart e2e test creator ${run_id}"
query="e2e ${run_id}"
api_url="${AGENTMART_API_URL:-https://agent-mart-beryl.vercel.app}"
buyer_wallet="0x$(openssl rand -hex 20)"
tx_hash="0x$(openssl rand -hex 32)"

tmp_home="$(mktemp -d)"
tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_home" "$tmp_dir"
}
trap cleanup EXIT

export HOME="$tmp_home"
export EVM_PRIVATE_KEY
export AGENTMART_TESTNET=true

storage_file="$tmp_dir/storage-id.txt"
output_file="$tmp_dir/purchased.txt"
printf "test-storage-id-%s\n" "$run_id" > "$storage_file"

json_get_field() {
  local json="$1"
  local key="$2"
  node -e '
const payload = JSON.parse(process.argv[1]);
const value = payload?.[process.argv[2]];
if (typeof value === "string") process.stdout.write(value);
' "$json" "$key"
}

assert_http_success() {
  local status="$1"
  local body="$2"
  if [[ "$status" -lt 200 || "$status" -gt 299 ]]; then
    echo "Request failed with status $status: $body" >&2
    exit 1
  fi
}

if [[ "${AGENTMART_E2E_DRY_RUN:-}" == "true" ]]; then
  api_key="am_test_${run_id}"
  listing_id="listing_${run_id}"
  printf "API key: %s\n" "$api_key"
  printf "Listing created: %s\n" "$listing_id"
  printf "ID | title | price | creator\n%s | %s | 0.01 | dry-run\n" "$listing_id" "$title"
  printf "Purchased content for %s\n" "$listing_id" > "$output_file"
  echo "E2E flow completed successfully"
  exit 0
fi

register_response="$(mktemp)"
register_status="$(
  curl -sS \
    -o "$register_response" \
    -w "%{http_code}" \
    -X POST \
    -H "content-type: application/json" \
    --data "{\"wallet\":\"${wallet}\",\"displayName\":\"E2E Creator ${run_id}\",\"bio\":\"${bio}\"}" \
    "${api_url}/api/register"
)"
register_body="$(cat "$register_response")"
assert_http_success "$register_status" "$register_body"
api_key="$(json_get_field "$register_body" "apiKey")"
if [[ -z "$api_key" ]]; then
  echo "Failed to parse API key from register response: $register_body" >&2
  exit 1
fi
echo "API key: $api_key"
export AGENTMART_API_KEY="$api_key"

upload_response="$(mktemp)"
upload_status="$(
  curl -sS \
    -o "$upload_response" \
    -w "%{http_code}" \
    -X POST \
    -H "authorization: Bearer ${api_key}" \
    -H "content-type: application/json" \
    --data "{\"title\":\"${title}\",\"description\":\"Automated e2e listing ${run_id}\",\"priceUsdc\":0.01,\"fileStorageId\":\"$(cat "$storage_file")\"}" \
    "${api_url}/api/listings"
)"
upload_body="$(cat "$upload_response")"
assert_http_success "$upload_status" "$upload_body"
listing_id="$(json_get_field "$upload_body" "listingId")"
if [[ -z "$listing_id" ]]; then
  echo "Failed to parse listing id from upload response: $upload_body" >&2
  exit 1
fi
echo "Listing created: $listing_id"

search_response="$(mktemp)"
search_status="$(
  curl -sS \
    -o "$search_response" \
    -w "%{http_code}" \
    "${api_url}/api/search?q=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$query")"
)"
search_body="$(cat "$search_response")"
assert_http_success "$search_status" "$search_body"
if ! node -e '
const listings = JSON.parse(process.argv[1]);
const listingId = process.argv[2];
if (!Array.isArray(listings) || !listings.some((item) => item?._id === listingId)) {
  process.exit(1);
}
' "$search_body" "$listing_id"; then
  echo "Search response did not include listing id $listing_id: $search_body" >&2
  exit 1
fi
echo "Search matched listing: $listing_id"

buy_response="$(mktemp)"
buy_status="$(
  curl -sS \
    -o "$buy_response" \
    -w "%{http_code}" \
    -H "x-buyer-wallet: ${buyer_wallet}" \
    -H "x-payment-tx: ${tx_hash}" \
    -H "x-agentmart-network: testnet" \
    "${api_url}/api/listings/${listing_id}/content"
)"
buy_body="$(cat "$buy_response")"
assert_http_success "$buy_status" "$buy_body"
if ! node -e '
const payload = JSON.parse(process.argv[1]);
const listingId = process.argv[2];
if (payload?.listingId !== listingId) {
  process.exit(1);
}
' "$buy_body" "$listing_id"; then
  echo "Buy response did not include expected listing id: $buy_body" >&2
  exit 1
fi
echo "$buy_body" > "$output_file"
echo "Saved purchase payload: $output_file"

if [[ ! -s "$output_file" ]]; then
  echo "Expected purchased content at $output_file" >&2
  exit 1
fi

echo "E2E flow completed successfully"
