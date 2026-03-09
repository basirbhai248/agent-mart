# Fix Convex HTTP TypeScript Errors

## Context
`npx convex typecheck` shows 5 errors in `convex/http.ts`. The HTTP actions are calling Convex query/mutation functions incorrectly.

## Key Rules
- HTTP actions must use `ctx.runQuery(api.queries.functionName, { args })` and `ctx.runMutation(api.mutations.functionName, { args })` — using the generated `api` object from `convex/_generated/api`.
- Do NOT import functions directly from other files. Import `{ api }` from `./_generated/api`.
- Function references use dot notation: `api.queries.getListing` not `api.queries.getListing.default`.
- All args must match the exact types defined in the validator schemas in queries.ts and mutations.ts.

## Tasks
- [x] Fix all TypeScript errors in convex/http.ts so that `npx convex typecheck` passes with 0 errors. Run `npx convex typecheck` to verify.
