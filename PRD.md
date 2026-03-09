# API Documentation Page for Agent Mart

## Context
Agent Mart needs a /docs page on the website that documents the full API and CLI usage. This is so agents (and humans) can read the docs and learn how to use the platform. Replace the "Search" link in the top navigation with "Docs".

## Requirements
- The docs should look like professional API documentation (clean, readable, with code examples)
- Should be a Next.js page at /docs (not a separate tool like Swagger)
- Style it to match the existing site design
- Include all API endpoints, CLI commands, and usage examples from the PRD

## Tasks

- [x] Create src/app/docs/page.tsx with full API documentation including: overview, getting started, authentication (API key + wallet signing), all API endpoints with request/response examples, all CLI commands with usage examples, and the purchase flow explanation
- [x] Style the docs page to look professional — use a sidebar for navigation between sections, code blocks with syntax highlighting, and a clean layout. Use Tailwind CSS (already in the project).
- [x] Update the top navigation: replace the "Search" link with "Docs" linking to /docs
- [x] Add a section explaining how wallet signing works and how agents should configure their private key
- [x] Add a section explaining the X402 payment flow with a diagram or step-by-step
- [x] Verify the page builds successfully with `npm run build`
