# frontend

Frontend for challenge 4: automating environmental and permit audits per installation.

It is a React app (Vite + TypeScript) ported from the HTML prototype in [`prototipo/`](prototipo/), which stays in the repo as the reference for the agreed flow. [`prototipo/SISTEMA.md`](prototipo/SISTEMA.md) describes how the system works (in Spanish): flow, screens, states, data model, the extraction contract, offline behaviour and what is mocked.

## Running it

Needs Node 24+ and pnpm (`corepack enable`). From the repo root:

```bash
pnpm install
pnpm dev:frontend
```

Then open http://localhost:5173. Other scripts, run from `apps/frontend` or with `pnpm --filter hackaton-frontend <script>`: `build`, `preview`, `typecheck`, `lint` and `test`.

Progress is stored in the browser's `localStorage` (key `auditorias-react-v1`), so the app works offline. Use "Reiniciar prototipo" on the Centros screen to reset it, or "Cargar ejemplo" to load Piscicultura Aucha with two audits (Q3 closed, Q4 in progress on site).

## Structure

```
src/
  main.tsx, App.tsx     entry point and routes (hash router)
  styles.css            styles ported 1:1 from the prototype (Invermar palette)
  data/seed.ts          example data and the 35 requirements extracted by hand
  api/                  the only way screens read and change data: `api.*` calls shaped
                        like the backend endpoints, plus `useAudits`/`useAudit` hooks.
                        `localApi` implements it on top of the local store; an HTTP
                        implementation will replace it when the backend is ready
  domain/               pure logic: stats, sheet numbering, factories, evidence
  store/                Zustand stores: local data cache (persisted, used only by `api/`)
                        and UI state (toasts, dialogs, Terreno filters)
  hooks/                theme, connectivity/sync, current audit
  components/           top bar, icons, overlays, shared UI pieces
  views/                one file per screen
```

Shared types live in [`@hackaton/contracts`](../../packages/contracts/src/auditoria.ts). `RequisitoExtraido` is the shape the LLM extraction step must return: `{ id, tema, titulo, detalle, fuente: { doc, ref }, frecuencia, evidencia, venc?, rectificado? }`.

### Routes

| Route                                  | Screen                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `#/`                                   | Centros: pick the installation to audit                                             |
| `#/centros/:centroId`                  | Audits of the centro, its documents and alerts                                      |
| `#/centros/:centroId/nueva`            | Create an audit (the centro comes locked)                                           |
| `#/auditorias/:auditId`                | Opens the screen that matches the audit's status                                    |
| `#/auditorias/:auditId/preparar`       | 4-step wizard: details, documents, pertinencias, generate and validate requirements |
| `#/auditorias/:auditId/terreno`        | On-site checklist: Todos / Llenados / Pendientes, quick status per row              |
| `#/auditorias/:auditId/terreno/:reqId` | Requirement detail: status, notes, evidence, history                                |
| `#/auditorias/:auditId/panel`          | Compliance panel and "Cerrar auditoría"                                             |

Unlike the prototype, the open audit is part of the URL instead of hidden state, so every screen can be linked to directly. The navigation bar (Auditorías · Terreno · Panel) only shows inside an audit. The prototype's regulations chat was dropped: the team decided not to include it.

### Rules on site

- Status matches Invermar's current SÍ / NO / N/A sheet: Cumple, No cumple, No aplica.
- No cumple requires a note; evidence (photo or file) is optional. No aplica requires a reason.
- Requirements are numbered like the paper sheet (1-a, 1-b…). Inside each theme the order is pending → Cumple → No cumple → N/A.
- A whole theme can be marked No aplica, and every change can be undone for 5 seconds.
- Compliance = cumple / (cumple + no cumple); N/A does not count.

## What is mocked

- Requirement generation does not call an LLM yet. "Generar" loads `REQ_TEMPLATES` from `data/seed.ts`, extracted by hand from the Piscicultura Aucha documents (RCA 202410001185 and its rectification, and the SUSPEL and RESPEL sanitary resolutions).
- Sync is simulated: changes stay in `localStorage` and are marked as synced 1.5 s after the last change while online.
- The other two installations have no real documents and use made-up numbers; audits can be created for them, but requirements must be added by hand.
