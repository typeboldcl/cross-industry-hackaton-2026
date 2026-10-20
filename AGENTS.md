# AGENTS.md

Context and rules for coding agents working in this repo. Read this first, then `apps/frontend/prototipo/SISTEMA.md` for the full product description (in Spanish).

## What we are building

Cross-industry hackathon 2026, **challenge 4 for Invermar** (salmon farming): automate environmental and permit compliance audits per installation (centros de cultivo, pisciculturas and the processing plant).

Today requirements are copied by hand from each RCA (Resolución de Calificación Ambiental) and sectoral resolution into spreadsheets, and evidence arrives by email. The product must:

1. Read a centro's documents (RCA, rectifications, sectoral resolutions, norms, SEIA pertinencias) and **generate the list of requirements to audit**, each with its source.
2. Have a **responsible person validate** those requirements before they are used. This is a hard rule of the challenge; never skip it.
3. Let site teams **fill in the audit on a phone, offline**, with status and evidence.
4. Show **compliance per installation** to management, with a traceable history.

Challenge constraints: no sensitive data, limited connectivity at remote sites, simple enough for people who are not regulatory experts.

Team split: Josué builds the frontend, Adriel the document loading and LLM extraction, Daniel the cloud deployment and the pitch.

## Repo layout

pnpm workspace, Node >= 24, pnpm 12 (`corepack enable`).

- `apps/frontend` (`hackaton-frontend`): React 19 + Vite + TypeScript app. TanStack Query for server data, Zustand for UI state, React Router (hash router), Vitest, oxlint. This is where UI work happens.
- `apps/frontend/prototipo/`: the original single-file HTML prototype and `SISTEMA.md`. It is the **reference for the agreed flow**. Do not change it unless asked; it is excluded from Prettier.
- `apps/backend` (`hackaton-backend`): NestJS API under `/api` (facilities, documents, obligations, audits, evidence, SEIA, Q&A) on Postgres, OBS and Orbit. Needs `apps/backend/.env` (see `.env.example`).
- `deploy/`: Huawei CCE manifests; the frontend and backend share one ingress (`/` and `/api`).
- `packages/contracts` (`@hackaton/contracts`): types shared by frontend and backend. **Types only**: import with `import type`, never add runtime code.

Commands, from the repo root:

```sh
pnpm install
pnpm dev:frontend   # http://localhost:5173
pnpm dev:backend    # http://localhost:3000/api/health
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
```

Run that last line before saying a change is done. If Node or pnpm is not available, say that the checks were not run instead of claiming they pass.

## Frontend map

- `src/App.tsx`: routes. The open audit lives in the URL (`#/auditorias/:auditId/terreno`), so every screen is linkable.
- `src/views/`: one file per screen (Inicio = centros, Centro, Nueva, Preparar, Terreno, Requisito, Panel).
- `src/api/`: the only way screens read and change data: query hooks (`useFacilities`, `useFacilityContext`, `useObligations`, `useAudit`) and `actions.*`, which call the API and refresh the cache. Two backends implement the same `AuditApi`: `httpApi` (the real one, `VITE_API_URL`, default `/api`, sends `X-Actor-Name`) and `demo/demoApi` (in-browser, same contracts and rules, stored in `localStorage`). Keep both in step when the backend changes.
- `src/domain/`: pure logic (labels in Spanish for the backend enums, stats, sheet numbering, evidence thumbnails). Keep it free of React so it stays testable; tests live next to it (`*.spec.ts`).
- `src/store/useSession.ts`: the auditor's name and Demo/Backend mode (persisted). `useUiStore.ts`: toasts, dialogs, Terreno filters, wizard step and excluded themes.
- `src/data/seed.ts`: demo data only: example installations, the Piscicultura Aucha documents and `REQ_TEMPLATES`, the 35 requirements extracted by hand.
- `src/styles.css`: Invermar palette (navy `#03215C`, accent `#00BBFF`, primary `#0072B2`). Light theme by default, dark theme only when the user picks it.

## Domain rules (do not break these)

The types live in `packages/contracts` (`audits.ts`, `obligations.ts`, `documents.ts`, `context.ts`); the backend enforces these rules and `demoApi` mirrors them.

- Audit status: `draft` → `in_validation` → `published` → `closed`. Closed audits are read-only.
- Requirements (obligations) are validated **per installation**, not per audit: `obligation_version.status` is `draft`, `validated`, `rejected` (plus `superseded`, `revoked`). Publishing an audit creates one item per validated requirement whose theme is not excluded. Only validated requirements reach the site checklist.
- On-site result matches Invermar's paper sheet (SÍ / NO / N/A): `pending`, `compliant`, `non_compliant`, `not_applicable`. There is no "parcial". The UI shows them in Spanish (`src/domain/labels.ts`).
- `non_compliant` requires a note. Evidence is optional. `not_applicable` requires a `naReason`; `other` also requires a note.
- Compliance = compliant / (compliant + non_compliant); N/A does not count. Colours: >= 85 % green, >= 65 % amber, below that red.
- Requirements are numbered like the paper sheet (1-a, 1-b…) from the item `position`, so codes never change when filtering.
- Each item carries its `history` (built by the backend from each step). Traceability is a core selling point.
- Manual requirements have `origin: "manual"` and no source document (criterio del responsable).
- There is no chat: the team decided not to include the regulations chatbot. The HTML prototype still has it only as a historical reference.

## The extraction contract

Extraction runs in the backend when a document is uploaded: it proposes `ObligationVersion` drafts with their `sources` (document, section, page, quote). `RequisitoExtraido` in `contracts/src/auditoria.ts` is the older shape the prototype used; the frontend no longer depends on it. If an API shape has to change, change it in `contracts` first.

Beyond the list, extraction should also:

- cross-check documents and raise alerts (real example: the RESPEL resolution says the warehouse is 90 m², the RCA says the correct figure is 36 m²);
- check each document's validity (repealed, rectified, auto-renewed);
- flag related documents that are missing (the Aucha RCA modifies RCA N° 49/2017, which is not loaded).

## What is mocked today

Only in **demo mode** (`src/api/demo`):

- "Generar requisitos" creates Aucha's 35 drafts from `REQ_TEMPLATES` the first time, as if its documents had been processed.
- Uploading a document only records its name; SEIA pertinencias are fixed.
- Only Piscicultura Aucha has real documents; the other two installations start empty. Most due dates are examples, except the SUSPEL declaration (20 December), which comes from the resolution.

Not built yet: offline work against the real backend (Service Worker + IndexedDB + queue), roles (cumplimiento, centro, gerencia), and a full change log (`audit_log`; today's history is derived).

## Data and privacy

- **Never commit the source PDFs** (RCA, resolutions, challenge sheet). They contain names and RUTs of legal representatives. Keep them locally in `reference/`, which is git-ignored.
- Do not copy personal data (names, RUTs, personal emails, phone numbers) into code, seed data, tests or docs. Company and authority names, resolution numbers and dates are fine.
- Never commit `.env` files or API keys.

## Conventions

- UI text is Spanish (Chile), short and plain, for people who are not regulatory experts. Code identifiers follow the existing mix: domain terms in Spanish (`requisito`, `tema`, `evidencia`), framework code in English.
- Mobile first: the site checklist is used on a phone outdoors. Check new screens at 375 px wide and in both themes.
- Match the surrounding code style; Prettier is configured once at the root.
- Commits use Conventional Commits with a scope, e.g. `feat(frontend): …`, `fix(backend): …`, `docs: …`. Work on a branch and leave pushing and merging to `main` to a human.
- Keep `apps/frontend/README.md` and `SISTEMA.md` in sync when you change behaviour they describe.
