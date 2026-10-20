# frontend

Frontend for challenge 4: automating environmental and permit audits per installation.

## `prototipo/`

A clickable, mobile-first prototype in a single static HTML file (no build, no dependencies). It is here to agree on the flow before porting it to React; once that happens this folder becomes a workspace package with its own `package.json`.

Open `prototipo/index.html` directly in a browser. Progress is stored in the browser's `localStorage`; use "Reiniciar prototipo" on the Centros screen to reset it, or "Cargar ejemplo" to load Piscicultura Aucha with two audits (Q3 closed, Q4 in progress on site).

[`prototipo/SISTEMA.md`](prototipo/SISTEMA.md) describes how the system works and how it is put together (in Spanish): flow, screens, states, data model, the extraction contract, offline behaviour and what is mocked.

### Structure

Centro (installation) → Auditorías (several per centro, in progress and closed) → Requisitos → result on site (status, notes, evidence, history).

### Screens

- **Centros** (home): pick the installation to audit; each card shows its latest compliance and how many audits it has.
- **Auditorías del centro**: "+ Crear nueva auditoría", audits in progress and closed, the centro's documents and the alerts found across them.
- **Crear nueva auditoría**: type, name and date; the centro comes locked from the previous screen.
- **Preparar** (before visiting the site): audit details, load the RCA and sectoral resolutions, load pertinencias, generate requirements, then have a responsible person validate them (pick themes, edit, discard or add requirements the analysis missed) and publish.
- **Terreno**: search, Todos / Llenados / Pendientes tabs, requirements grouped by theme with pending ones first, status (Cumple / No cumple / No aplica, matching Invermar's current SÍ / NO / N/A sheet) set straight from each pending row (marked ones turn into a coloured card and are edited from the detail), notes, photo and file evidence, and a per-requirement change history. No cumple requires a note (evidence is optional), No aplica requires a reason, a whole theme can be marked No aplica, and every change can be undone for a few seconds. Works offline. Closed audits are read-only.
- **Panel**: compliance per theme, upcoming due dates, findings, the centro's audit history, and "Cerrar auditoría".
- **Chat**: answers questions about the installation's requirements and always cites the source document.

Audit states: `sin_preparar` (Borrador) → `en_validacion` → `publicada` (En terreno) → `cerrada`.

The navigation bar (Auditorías · Terreno · Panel) only shows once an audit is open. Preparar is reached from the audit card, not from the bar.

### What is mocked

- Requirement generation and the chat do not call an LLM yet. "Generar" loads `REQ_TEMPLATES`, 35 requirements extracted by hand from the Piscicultura Aucha documents (RCA 202410001185 and its rectification, and the SUSPEL and RESPEL sanitary resolutions). The chat matches keywords against that list.
- Each entry in `REQ_TEMPLATES` has the shape the extraction step should return: `{ tema, titulo, detalle, fuente: { doc, ref }, frecuencia, evidencia, venc?, rectificado? }`. When this moves to the backend, that shape belongs in `packages/contracts`.
- Offline sync is simulated: changes stay in `localStorage` and are marked as synced when the connection returns.
- The other two installations have no real documents and use made-up numbers; audits can be created for them, but requirements must be added by hand. Most due dates are examples. The SUSPEL declaration deadline (20 December) comes straight from the resolution.

### Porting to React

Each screen is a `view*` function (`viewInicio`, `viewCentro`, `viewNueva`, `viewPreparar`, `viewTerreno`, `viewReq`, `viewPanel`) that renders from a single state object `S`. `S.audits` holds every audit and `A` is the one currently open. User actions are handled in one `data-action` switch. Screens map to components and the actions map to state updates.
