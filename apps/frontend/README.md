# frontend

Frontend for challenge 4: automating environmental and permit audits per installation.

## `prototipo/`

A clickable, mobile-first prototype in a single static HTML file (no build, no dependencies). It is here to agree on the flow before porting it to React; once that happens this folder becomes a workspace package with its own `package.json`.

Open `prototipo/index.html` directly in a browser. Progress is stored in the browser's `localStorage`; use "Reiniciar prototipo" on the home screen to reset it, or "Cargar ejemplo" to load an audit that is already validated and partly filled in.

### Screens

- **Inicio**: audit status, the three-step flow and alerts found across documents.
- **Preparar** (before visiting the site): pick the installation, load the RCA and sectoral resolutions, load pertinencias, generate requirements, then have a responsible person validate them (pick themes, edit, discard or add requirements the analysis missed) and publish.
- **Terreno**: search, Pendientes / Llenados tabs, requirements grouped by theme, traffic-light status (Cumple / Parcial / No cumple / No aplica), notes, photo and file evidence, and a per-requirement change history. Works offline.
- **Panel**: compliance per installation and per theme, upcoming due dates and findings.
- **Chat**: answers questions about the installation's requirements and always cites the source document.

### What is mocked

- Requirement generation and the chat do not call an LLM yet. "Generar" loads `REQ_TEMPLATES`, 35 requirements extracted by hand from the Piscicultura Aucha documents (RCA 202410001185 and its rectification, and the SUSPEL and RESPEL sanitary resolutions). The chat matches keywords against that list.
- Each entry in `REQ_TEMPLATES` has the shape the extraction step should return: `{ tema, titulo, detalle, fuente: { doc, ref }, frecuencia, evidencia, venc?, rectificado? }`. When this moves to the backend, that shape belongs in `packages/contracts`.
- Offline sync is simulated: changes stay in `localStorage` and are marked as synced when the connection returns.
- The other two installations in the panel use made-up numbers, and most due dates are examples. The SUSPEL declaration deadline (20 December) comes straight from the resolution.

### Porting to React

Each screen is a `view*` function (`viewInicio`, `viewPreparar`, `viewTerreno`, `viewReq`, `viewPanel`) that renders from a single state object `S`, and user actions are handled in one `data-action` switch. Screens map to components and the actions map to state updates.
