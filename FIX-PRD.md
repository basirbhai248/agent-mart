# Fix Convex HTTP Routes

## Tasks

- [ ] Fix convex/http.ts — replace direct function imports with `api` references from `convex/_generated/api`. In Convex HTTP actions, `ctx.runQuery` and `ctx.runMutation` require function references from the generated API, not direct imports. Change imports to use `import { api } from "./_generated/api"` and reference functions as `api.queries.getListings`, `api.mutations.createCreator`, etc.
- [ ] Run `npx convex dev --once` and verify zero TypeScript errors
- [ ] Run `npm run build` and verify the Next.js app builds successfully
