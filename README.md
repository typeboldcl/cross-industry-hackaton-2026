# cross-industry-hackaton-2026

pnpm workspace: apps live in `apps/`, shared code in `packages/`.

| Path                 | Package               | What                             |
| -------------------- | --------------------- | -------------------------------- |
| `apps/backend`       | `hackaton-backend`    | NestJS API, served under `/api`  |
| `packages/contracts` | `@hackaton/contracts` | HTTP contract types (types only) |

## Requirements

- Node.js >= 24
- pnpm 12 (`packageManager` in `package.json`)

## Getting started

```sh
pnpm install
pnpm dev:backend   # http://localhost:3000/api/health
```

## Scripts

Run from the root; each one runs across every workspace package.

- `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`
- `pnpm format` / `pnpm format:check` (Prettier, configured once at the root)

## Contracts

Request and response shapes the frontend and backend share go in `packages/contracts`. Import them with `import type` only; the package ships no runtime code.
