# Fix: Convex Dynamic Routes & E2E Flow

## Context
Convex HTTP router does NOT support parameterized path segments like `/api/creators/:wallet`. It only matches exact paths. Routes registered as `/api/creators/:wallet` look for the literal string `:wallet` in the URL, not a wildcard.

## Tasks

- [x] Fix Convex HTTP routes: change `/api/creators/:wallet` to use query params. Register route as `/api/creators` (GET) and extract wallet from `?wallet=0x...` query parameter. Update the handler `getCreatorRoute` to read wallet from URL search params instead of pathname.
- [x] Fix Convex HTTP routes: change `/api/listings/:id` to use query params. Register route as `/api/listing` (GET, note singular to avoid conflict with `/api/listings` list route) and extract id from `?id=...` query parameter. Update the handler `getListingRoute` accordingly.
- [x] Fix Convex HTTP routes: change `/api/listings/:id/content` to use query params. Register route as `/api/listing/content` (GET) and extract id from `?id=...` query parameter. Update the handler `getListingContentRoute` accordingly.
- [x] Fix Convex HTTP routes: change `/creator/:wallet` (HTML page route) to use query params. Register as `/creator` (GET) and extract wallet from `?wallet=0x...`. Update `creatorProfilePageRoute`.
- [x] Update Next.js API proxy routes to translate path params to query params when calling Convex. For example, `app/api/listings/[id]/route.ts` should call Convex at `/api/listing?id=<id>` instead of `/api/listings/<id>`. Similarly for `app/api/listings/[id]/content/route.ts` → `/api/listing/content?id=<id>` and `app/api/creators/[wallet]/route.ts` → `/api/creators?wallet=<wallet>`.
- [x] Update the CLI: the `list` command calls `/api/creators/<wallet>` — update to call `/api/creators?wallet=<wallet>` instead (in `cli/bin/list.js`). The `buy` command calls `/api/listings/<id>/content` — update to use the correct Vercel proxy URL which still uses path params (the Next.js route handles translation).
- [x] Run `npx convex dev --once` and verify zero errors
- [x] Run `npm run build` and verify the Next.js app builds successfully
- [x] Test: `curl https://flippant-gecko-520.convex.site/api/creators?wallet=0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf` should return creator data or 404 (not "No matching routes found")
- [x] Test: `curl https://flippant-gecko-520.convex.site/api/listing?id=j975t0ed9q6pf43xetbnf78ytn82j1ha` should return listing data
