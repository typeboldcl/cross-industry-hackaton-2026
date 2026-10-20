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

- `apps/frontend` (`hackaton-frontend`): React 19 + Vite + TypeScript app. Zustand stores with Immer, React Router (hash router), Vitest, oxlint. This is where UI work happens.
- `apps/frontend/prototipo/`: the original single-file HTML prototype and `SISTEMA.md`. It is the **reference for the agreed flow**. Do not change it unless asked; it is excluded from Prettier.
- `apps/backend` (`hackaton-backend`): NestJS API under `/api`. Only a health endpoint so far.
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
- `src/domain/`: pure logic (stats, sheet numbering, factories, chat, evidence). Keep it free of React so it stays testable; tests live next to it (`*.spec.ts`).
- `src/store/useAuditStore.ts`: persisted audits (`localStorage` key `auditorias-react-v1`). `useUiStore.ts`: toasts, dialogs, chat.
- `src/data/seed.ts`: example installations, the Piscicultura Aucha documents and `REQ_TEMPLATES`, the 35 requirements extracted by hand.
- `src/styles.css`: Invermar palette (navy `#03215C`, accent `#00BBFF`, primary `#0072B2`). Light theme by default, dark theme only when the user picks it.

## Domain rules (do not break these)

- Audit status: `sin_preparar` → `en_validacion` → `publicada` → `cerrada`. Closed audits are read-only.
- Requirement validation (`val`): `propuesto`, `validado`, `descartado`, `fuera` (its theme was excluded). Only `validado` requirements reach the site checklist.
- On-site status matches Invermar's paper sheet (SÍ / NO / N/A): `pendiente`, `cumple`, `no_cumple`, `na`. There is no "parcial".
- `no_cumple` requires a non-empty note. Evidence is optional. `na` requires a reason (`naMotivo`).
- Compliance = cumple / (cumple + no_cumple); N/A does not count. Colours: >= 85 % green, >= 65 % amber, below that red.
- Requirements are numbered like the paper sheet (1-a, 1-b…) from their original order, so codes never change when filtering.
- Every change appends to the requirement's history (`hist`: date, action, who). Traceability is a core selling point.
- Manually added requirements are flagged `manual: true`, and their source can be `"MANUAL"` (criterio del responsable).
- The chat must **always cite the source document and reference** in its answers.

## The extraction contract

`RequisitoExtraido` in `packages/contracts/src/auditoria.ts` is what the LLM extraction must return for each obligation found: `{ id, tema, titulo, detalle, fuente: { doc, ref }, frecuencia, evidencia, venc?, rectificado? }`. Keep the frontend, the backend and `REQ_TEMPLATES` aligned with that type. If it has to change, change it in `contracts` first.

Beyond the list, extraction should also:

- cross-check documents and raise alerts (real example: the RESPEL resolution says the warehouse is 90 m², the RCA says the correct figure is 36 m²);
- check each document's validity (repealed, rectified, auto-renewed);
- flag related documents that are missing (the Aucha RCA modifies RCA N° 49/2017, which is not loaded).

## What is mocked today

- "Generar requisitos" loads `REQ_TEMPLATES` instead of calling an LLM. The chat matches keywords over the audit's requirements.
- Uploading a document only records its file name.
- Persistence is browser `localStorage`. Sync is simulated (evidence is marked synced 1.5 s after the last change while online).
- Only Piscicultura Aucha has real documents. The other two installations use made-up numbers. Most due dates are examples, except the SUSPEL declaration (20 December), which comes from the resolution.

Likely next steps: backend endpoints for audits and extraction (typed in `contracts`), replace `REQ_TEMPLATES` with the real extraction, chat with retrieval over the centro's documents, real offline sync (Service Worker + IndexedDB + queue), roles (cumplimiento, centro, gerencia).

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
