# Sistema de Auditorías Ambientales por Instalación

Documento de funcionamiento y composición del prototipo de frontend para el **Reto 4 · Automatización de auditorías ambientales y de permisos por instalación** (Invermar · Hackatón).

- Archivo del prototipo: `apps/frontend/prototipo/index.html` (un solo archivo HTML + CSS + JavaScript, sin dependencias).
- Estado: prototipo navegable con datos reales extraídos de los documentos del reto. La extracción con LLM, el backend y la sincronización real están **simulados**.

---

## 1. Problema que resuelve

Hoy las auditorías de cumplimiento se preparan a mano: alguien lee cada RCA o resolución, copia los requisitos en planillas y pide las evidencias por correo o en carpetas compartidas. Esto genera poca trazabilidad, versiones dispersas y riesgo de omitir obligaciones.

El sistema busca:

- **Generar sistemáticamente** los requisitos a auditar a partir de los documentos de cada instalación (RCA, resoluciones sectoriales, normas y pertinencias).
- Exigir que un **responsable valide** los requisitos antes de usarlos.
- Permitir **llenar la auditoría en terreno** desde el celular, con semáforo y evidencias, incluso **sin conexión**.
- Dar **visibilidad del cumplimiento** por instalación y auditoría a las gerencias.
- Mantener un **repositorio único y trazable** de evidencias por instalación y requisito.

### Usuarios

| Usuario | Qué hace en el sistema |
|---|---|
| Área de Concesiones y Cumplimiento Normativo | Crea auditorías, carga documentos, genera y **valida** requisitos, cierra auditorías. |
| Equipos operativos (jefes de centro, piscicultura o planta) | Llenan el checklist en terreno y cargan evidencias. |
| Gerencias | Revisan el panel de cumplimiento y el historial por centro. |

### Restricciones del reto

- Sin datos sensibles: se trabaja con información de ejemplo o anonimizada.
- Conectividad limitada en las instalaciones remotas: la app guarda todo en el dispositivo.
- Debe ser simple para personal que no es experto en normativa.
- Los requisitos generados automáticamente **deben** validarse por un responsable antes de usarse.

---

## 2. Estructura general

El sistema se organiza en tres niveles:

```
Centro (instalación)
 └── Auditorías (varias por centro: en curso y finalizadas)
      └── Requisitos (generados, agregados a mano, validados)
           └── Resultado en terreno: estado + observación + evidencias + historial
```

### Flujo principal

```
1. Elegir centro
2. Ver auditorías del centro  ──►  "+ Crear nueva auditoría"
3. Preparar (antes de ir al lugar)
     Datos → Documentos → Pertinencias → Requisitos (generar + validar + publicar)
4. Terreno: checklist con semáforo y evidencias (funciona sin conexión)
5. Panel: cumplimiento, vencimientos, hallazgos e historial del centro
6. Cerrar auditoría → queda en solo lectura en "Finalizadas"
```

---

## 3. Pantallas

| Ruta | Pantalla | Contenido principal |
|---|---|---|
| `#/inicio` | **Centros** | "¿Qué centro vas a auditar?". Tarjetas por instalación con el último % de cumplimiento, cantidad de auditorías y cuántas están en curso. Botones "Cargar ejemplo" y "Reiniciar prototipo". |
| `#/centro/{id}` | **Auditorías del centro** | Botón **"+ Crear nueva auditoría"**, listas "En curso" y "Finalizadas", documentos del centro y alertas detectadas en ellos. |
| `#/nueva` | **Crear nueva auditoría** | Centro, tipo, nombre y fecha programada. Al crearla se pasa directo a Preparar. |
| `#/a/{id}[/vista]` | (ruta técnica) | Abre una auditoría y redirige a la pantalla que corresponde a su estado. |
| `#/preparar` | **Preparar** (asistente de 4 pasos) | Ver sección 4. |
| `#/terreno` | **Terreno** | Progreso con semáforo, buscador, pestañas Pendientes/Llenados, requisitos agrupados por temática y botón "+ Agregar requisito encontrado en terreno". |
| `#/req/{id}` | **Detalle de requisito** | Botones Cumple/Parcial/No cumple/No aplica, observación, evidencias (foto o archivo), ficha del requisito (fuente, referencia, frecuencia, vencimiento, validador) e historial. |
| `#/panel` | **Panel de cumplimiento** | KPIs, botón "Cerrar auditoría", historial de auditorías del centro, cumplimiento por temática, próximos vencimientos, hallazgos y alertas de documentos. |

Elementos globales:

- **Barra superior:** centro y auditoría abierta, indicador de conexión ("En línea", "Sin conexión · N por sincronizar") y botón de tema claro/oscuro (por defecto claro; la elección se recuerda).
- **Navegación:** Centros · Preparar · Terreno · Panel (barra inferior en celular, lateral en escritorio).
- **Chat de normativa** (botón flotante): responde preguntas sobre la normativa del centro **citando siempre la fuente**.

---

## 4. Preparación de la auditoría ("antes de ir al lugar")

1. **Datos:** resumen de la auditoría (centro, tipo, fecha, estado).
2. **Documentos:** RCA, rectificaciones, resoluciones sectoriales y normas, con su estado de vigencia (por ejemplo, "Vigente · modificada por rectificación" o "Vigente · prórroga automática desde 14-09-2026"). Se pueden cargar más PDF.
3. **Pertinencias:** consultas de pertinencia al SEIA asociadas al centro y normas citadas que se detectaron.
4. **Requisitos:**
   - **Generar:** lee los documentos y propone requisitos (hoy simulado; ver sección 7).
   - **Validar:**
     - elegir las **temáticas** que entran en la auditoría;
     - **editar** o **descartar** cada requisito;
     - **agregar requisitos manualmente** cuando el análisis no los detectó. Quedan marcados como "Agregado manualmente";
     - indicar el **responsable que valida** (obligatorio).
   - **Publicar:** los requisitos validados pasan a Terreno.

---

## 5. Estados

### Auditoría

| Estado | Etiqueta | Acción sugerida | Abre en |
|---|---|---|---|
| `sin_preparar` | Borrador | Continuar preparación | Preparar |
| `en_validacion` | En validación | Validar requisitos | Preparar |
| `publicada` | En terreno | Continuar en terreno | Terreno |
| `cerrada` | Cerrada | Ver resultados | Panel (solo lectura) |

### Requisito: validación (`val`)

`propuesto` → `validado` · `descartado` · `fuera` (su temática se excluyó al publicar).

### Requisito: resultado en terreno (`estado`)

`pendiente` · `cumple` · `parcial` · `no_cumple` · `na` (no aplica).

### Cálculo de indicadores

- **Avance** = requisitos llenados / requisitos validados.
- **Cumplimiento** = (cumple + 0,5 × parcial) / (cumple + parcial + no cumple). Los "No aplica" no cuentan.
- Semáforo de colores: ≥ 85 % verde, ≥ 65 % amarillo y bajo eso rojo.

---

## 6. Modelo de datos

Todo el estado vive en un objeto `S` que se guarda en `localStorage` (clave `auditorias-proto-v2`). El tema se guarda aparte (`auditorias-tema`).

```js
S = {
  centro: 'aucha',          // centro seleccionado
  cur: 'A2-xxxx',           // id de la auditoría abierta (A)
  audits: [Auditoria],      // todas las auditorías de todos los centros
  pending: 0,               // cambios por sincronizar
  chat: [], tab, q, ...     // estado de interfaz
}

Auditoria = {
  id, inst, nombre, tipo, fecha, creada,
  status: 'sin_preparar' | 'en_validacion' | 'publicada' | 'cerrada',
  step: 1..4,               // paso del asistente Preparar
  docs: [Documento], extras: [Documento], perts: [Pertinencia],
  generado: boolean, temasOff: [string],
  validador, publicada, cerrada,
  reqs: [Requisito]
}

Documento   = { id, tipo, numero, fecha, emisor, titulo, vigencia, estado: 'ok'|'warn'|'info' }
Pertinencia = { id, numero, titulo, cargada }

Requisito = {
  id, tema, titulo, detalle,
  fuente: { doc: 'D1' | 'MANUAL' | ..., ref: 'Cons. 4.3.2, Tabla 2' },
  frecuencia, evidencia,     // evidencia esperada
  venc?: 'AAAA-MM-DD',       // próximo vencimiento
  rectificado?: string,      // cambio introducido por una rectificación
  manual?: true, editado?: true,
  val, estado, obs,
  evidencias: [{ nombre, fecha, thumb?, sync }],
  hist: [{ f: fechaISO, a: acción, q: quién }]   // trazabilidad
}
```

Las **instalaciones** son fijas en el prototipo: Piscicultura Aucha (con documentos reales), un Centro de cultivo de ejemplo y una Planta de proceso de ejemplo (estas dos con datos ficticios).

---

## 7. Integración con la extracción de requisitos (LLM)

Hoy el botón "Generar requisitos" muestra una animación y carga `REQ_TEMPLATES`: 35 requisitos extraídos a mano de los documentos de Aucha.

| Documento | Uso |
|---|---|
| RCA Res. Ex. N° 202410001185 (13-09-2024) | Fuente principal (ruido, RILes, medio marino, residuos, agua, comunidad, compromisos voluntarios, contingencias). |
| Rectificación RCA, Doc. N° 202410101706 (19-12-2024) | Corrige 33 considerandos. 4 requisitos quedan marcados "Actualizado por rectificación". |
| Res. Sanitaria SUSPEL N° 2310322819 (14-09-2023) | Declaración semestral (20 jun / 20 dic) y condiciones de bodega. |
| Res. Sanitaria RESPEL N° 241020665 (23-01-2024) | Almacenamiento < 6 meses, registro, etiquetado, protocolos. |

**Contrato esperado:** el módulo de extracción debe devolver una lista de objetos con este formato para conectarse sin cambios en el frontend. Cuando pase al backend, este tipo debería vivir en `packages/contracts`:

```json
{
  "tema": "Residuos peligrosos",
  "titulo": "Almacenamiento de RESPEL menor a 6 meses",
  "detalle": "Ningún residuo peligroso puede superar 6 meses en bodega…",
  "fuente": { "doc": "D4", "ref": "Resuelvo 2" },
  "frecuencia": "Mensual",
  "evidencia": "Inventario actualizado",
  "venc": "2026-12-20",
  "rectificado": null
}
```

Además, el sistema debería:

- **Cruzar documentos** y emitir alertas. Ejemplo real: la resolución RESPEL indica 90 m² para la bodega, pero la RCA dice que lo correcto son 36 m².
- **Verificar vigencia** de cada documento (derogado, rectificado, con prórroga).
- **Detectar documentos relacionados faltantes.** Ejemplo: la RCA modifica la RCA N° 49/2017, que no está cargada.

Los requisitos agregados manualmente sirven como retroalimentación para mejorar la extracción.

### Chat de normativa

Hoy busca por palabras clave dentro de los requisitos de la auditoría abierta y responde con requisito, frecuencia, evidencia, vencimiento y **fuente**. En producción debe reemplazarse por un LLM con recuperación (RAG) sobre los documentos del centro, manteniendo la cita obligatoria de la fuente.

---

## 8. Funcionamiento sin conexión

- Cada cambio (estado, observación, evidencia, requisito nuevo) se guarda de inmediato en el dispositivo.
- Sin señal, la barra superior muestra "Sin conexión · N por sincronizar".
- Al volver la señal se sincroniza. En el prototipo esto es **simulado**: solo marca las evidencias como "sincronizadas".
- Las fotos se reducen a 480 px antes de guardarse, para no llenar el almacenamiento del teléfono.

En producción esto debería implementarse con un Service Worker + IndexedDB y una cola de sincronización contra el backend.

---

## 9. Trazabilidad

Cada requisito guarda un historial con fecha, acción y responsable:

- generado desde un documento específico;
- validado, editado, descartado o agregado manualmente;
- marcado como Cumple, Parcial, No cumple o No aplica;
- evidencia agregada o eliminada, observación actualizada.

Las auditorías cerradas quedan en **solo lectura**, lo que permite comparar en el tiempo el cumplimiento de un mismo centro (historial en el Panel).

---

## 10. Composición del código

Un solo archivo, `prototipo/index.html`:

| Bloque | Contenido |
|---|---|
| `<style>` | Variables de diseño (colores, semáforo), tema claro/oscuro con `data-theme`, diseño mobile-first con barra lateral desde 1000 px. |
| Datos de ejemplo | `INSTALACIONES`, `DOCS_AUCHA`, `PERT_AUCHA`, `NORMAS_CITADAS`, `ALERTAS`, `REQ_TEMPLATES`. |
| Estado | `freshState`, `newAudit`, `load`, `save`, `syncA` (auditoría abierta `A`), `auditsOf`, `stats`. |
| Vistas | `viewInicio`, `viewCentro`, `viewNueva`, `viewPreparar` (`prepDatos`, `prepDocs`, `prepPerts`, `prepReqs`, `addFormHTML`), `viewTerreno` + `listHTML`, `viewReq`, `viewPanel`, `chatHTML`. |
| Enrutamiento | `route()` + `render()` basado en `location.hash`. |
| Acciones | Delegación de eventos con atributos `data-action` (crear, generar, validar, publicar, cerrar, cambiar estado, evidencias, chat, tema). |
| Conectividad | `scheduleSync`, `updateNet` y los eventos `online`/`offline`. |

### Migración a React (sugerida)

| Prototipo | React |
|---|---|
| Cada `view*()` | Un componente de página |
| `auditCard`, `reqValHTML`, `progressBar`, `ring`, `dueTag` | Componentes reutilizables |
| `S` + `save()` | Contexto o Zustand con persistencia (IndexedDB) |
| `route()` con hash | React Router |
| `data-action` + `switch` | Manejadores `onClick` en cada componente |
| `REQ_TEMPLATES` / `botAnswer` | Llamadas a la API de extracción y de chat |

---

## 11. Qué está simulado y qué falta para producción

| Componente | Prototipo | Producción |
|---|---|---|
| Extracción de requisitos | Lista fija (35 requisitos de Aucha) | LLM sobre los PDF cargados, con el contrato de la sección 7 |
| Chat | Búsqueda por palabras clave | LLM + RAG con cita de fuente |
| Carga de documentos | Solo registra el nombre del archivo | Almacenamiento en la nube + procesamiento |
| Persistencia | `localStorage` del dispositivo | Backend (`apps/backend`, NestJS) + base de datos, con usuarios y roles |
| Sincronización | Simulada | Service Worker + cola de sincronización |
| Centros de ejemplo | Datos ficticios | Catálogo real de instalaciones |
| Vencimientos | Fechas de ejemplo (excepto SUSPEL 20-12-2026, tomada del documento) | Calculados desde la frecuencia y la última ejecución |
| Autenticación | No existe | Login y permisos por rol (cumplimiento, centro, gerencia) |

---

## 12. Cómo ejecutar el prototipo

- Abrir `apps/frontend/prototipo/index.html` directamente en el navegador (doble clic), o
- Servirlo con cualquier servidor estático (por ejemplo, `npx serve apps/frontend/prototipo`).

Para presentar: **Centros → "Cargar ejemplo"** crea dos auditorías en Piscicultura Aucha (Q3 cerrada con 82 % y Q4 en terreno con 81 %). "Reiniciar prototipo" borra todos los datos del dispositivo.
