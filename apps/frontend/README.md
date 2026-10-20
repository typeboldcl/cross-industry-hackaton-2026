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

### Backend or demo mode

The app talks to the NestJS backend through the contracts in `@hackaton/contracts` (`src/api/httpApi.ts`). Deployed on CCE it uses `/api` on the same host. In development, set `VITE_API_URL` (e.g. `VITE_API_URL=http://localhost:3000/api` in `apps/frontend/.env.local`) to point at a backend. Requests send the auditor's name (asked on the Centros screen) in `X-Actor-Name`.

Without a backend, it runs in **demo mode** (the default in development): `src/api/demo/` is an in-browser backend that returns the same contracts and applies the same rules (validations, statuses, history), storing data in `localStorage`. "Cargar ejemplo" loads Piscicultura Aucha with two audits (Q3 closed, Q4 on site). The Centros screen switches between Demo and Backend.

## Structure

```
src/
  main.tsx, App.tsx     entry point and routes (hash router)
  styles.css            styles ported 1:1 from the prototype (Invermar palette)
  data/seed.ts          demo data: installations, Aucha documents, the 35 requirements
  api/                  the only way screens read and change data: TanStack Query hooks
                        (useFacilities, useFacilityContext, useObligations, useAudit) and
                        `actions.*`. httpApi = real backend; demo/ = in-browser backend
  domain/               pure logic: Spanish labels for the API enums, stats, numbering
  store/                useSession (auditor name, Demo/Backend) and useUiStore (toasts,
                        dialogs, Terreno filters, wizard step, excluded themes)
  hooks/                theme, connectivity, current audit
  components/           top bar, icons, overlays, shared UI pieces
  views/                one file per screen
```

Shared types live in [`@hackaton/contracts`](../../packages/contracts/src/) (`audits.ts`, `obligations.ts`, `documents.ts`, `context.ts`, `facilities.ts`).

### Routes

| Route                                   | Screen                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `#/`                                    | Centros: pick the installation to audit                                             |
| `#/centros/:centroId`                   | Audits of the centro, its documents and alerts                                      |
| `#/centros/:centroId/nueva`             | Create an audit (the centro comes locked)                                           |
| `#/auditorias/:auditId`                 | Opens the screen that matches the audit's status                                    |
| `#/auditorias/:auditId/preparar`        | 4-step wizard: details, documents, pertinencias, generate and validate requirements |
| `#/auditorias/:auditId/terreno`         | On-site checklist: Todos / Llenados / Pendientes, quick status per row              |
| `#/auditorias/:auditId/terreno/:itemId` | Requirement detail: status, notes, evidence, source quotes, history                 |
| `#/auditorias/:auditId/panel`           | Compliance panel and "Cerrar auditoría"                                             |

Unlike the prototype, the open audit is part of the URL instead of hidden state, so every screen can be linked to directly. The navigation bar (Auditorías · Terreno · Panel) only shows inside an audit. The prototype's regulations chat was dropped: the team decided not to include it.

### Rules (enforced by the backend, mirrored by demo mode)

- Requirements are validated per installation ("Validar todos los propuestos" or one by one); publishing an audit takes the validated ones from the themes left in.
- Status matches Invermar's current SÍ / NO / N/A sheet: Cumple, No cumple, No aplica.
- No cumple requires a note; evidence (photo or file) is optional. No aplica requires a reason, and "Otro motivo" also a note.
- Requirements are numbered like the paper sheet (1-a, 1-b…) by item position. Inside each theme the order is pending → Cumple → No cumple → N/A.
- A whole theme can be marked No aplica, and every change can be undone for 5 seconds.
- Compliance = cumple / (cumple + no cumple); N/A does not count.

## Demo mode limits

- "Generar" creates Aucha's 35 drafts from `REQ_TEMPLATES` (extracted by hand from RCA 202410001185, its rectification and the SUSPEL and RESPEL resolutions) the first time; the real backend extracts them when each PDF is uploaded.
- Uploaded documents are only recorded by name; SEIA pertinencias are fixed.
- There is no offline queue yet against the real backend: changes need a connection.
