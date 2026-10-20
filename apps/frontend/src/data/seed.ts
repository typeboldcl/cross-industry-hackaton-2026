/*
 * Datos de ejemplo extraídos manualmente de los documentos del reto
 * (RCA 202410001185, Rectificación RCA, Res. Sanitaria SUSPEL y Res. Sanitaria
 * RESPEL). REQ_TEMPLATES tiene la forma que debe devolver la extracción con
 * LLM (RequisitoExtraido en @hackaton/contracts).
 */
import type {
  Documento,
  Instalacion,
  Pertinencia,
  RequisitoExtraido,
} from "@hackaton/contracts";

export interface Alerta {
  tipo: "warn" | "info" | "bad";
  titulo: string;
  texto: string;
}

export const INSTALACIONES: Instalacion[] = [
  {
    id: "aucha",
    nombre: "Piscicultura Aucha",
    tipo: "Piscicultura",
    lugar: "Sector Aucha, Calbuco, Los Lagos",
    real: true,
  },
  {
    id: "ces",
    nombre: "Centro de cultivo Ejemplo",
    tipo: "Centro de cultivo (CES)",
    lugar: "Datos ficticios",
    real: false,
    demo: { pct: 72, avance: 100, nc: 3, total: 28 },
  },
  {
    id: "planta",
    nombre: "Planta de proceso Ejemplo",
    tipo: "Planta",
    lugar: "Datos ficticios",
    real: false,
    demo: { pct: 86, avance: 64, nc: 1, total: 41 },
  },
];

export const DOCS_AUCHA: Documento[] = [
  {
    id: "D1",
    tipo: "RCA",
    numero: "Res. Ex. N° 202410001185",
    fecha: "2024-09-13",
    emisor: "Comisión de Evaluación Región de Los Lagos",
    titulo:
      "Califica ambientalmente la DIA “Ampliación Piscicultura de Recirculación Aucha”",
    vigencia: "Vigente · modificada por rectificación",
    estado: "warn",
  },
  {
    id: "D2",
    tipo: "Rectificación",
    numero: "Documento N° 202410101706",
    fecha: "2024-12-19",
    emisor: "SEA Región de Los Lagos",
    titulo: "Rectifica 33 considerandos de la RCA 202410001185",
    vigencia: "Vigente",
    estado: "ok",
  },
  {
    id: "D3",
    tipo: "Res. sanitaria",
    numero: "Res. Ex. N° 2310322819",
    fecha: "2023-09-14",
    emisor: "SEREMI de Salud Los Lagos",
    titulo: "Autoriza almacenamiento de sustancias peligrosas (SUSPEL)",
    vigencia: "Vigente · prórroga automática desde 14-09-2026",
    estado: "ok",
  },
  {
    id: "D4",
    tipo: "Res. sanitaria",
    numero: "Res. Ex. N° 241020665",
    fecha: "2024-01-23",
    emisor: "SEREMI de Salud Los Lagos",
    titulo: "Autoriza sitio de almacenamiento de residuos peligrosos (RESPEL)",
    vigencia: "Vigente · requiere rectificar superficie",
    estado: "warn",
  },
];

export const PERT_AUCHA: Pertinencia[] = [
  {
    id: "P1",
    numero: "Res. Ex. N° 20211010180/21",
    titulo: "Consulta de pertinencia de ingreso al SEIA",
    cargada: false,
  },
  {
    id: "P2",
    numero: "Res. Ex. N° 202310101465/23",
    titulo: "Consulta de pertinencia de ingreso al SEIA",
    cargada: false,
  },
];

export const NORMAS_CITADAS: string[] = [
  "D.S. 90/2000 (descargas de RILes)",
  "D.S. 38/2011 (ruido)",
  "D.S. 148/2003 (residuos peligrosos)",
  "D.S. 43/2015 (sustancias peligrosas)",
  "D.S. 320/2001 (RAMA)",
  "Res. Ex. 885/2016 SMA (reporte de contingencias)",
];

export const ALERTAS: Alerta[] = [
  {
    tipo: "warn",
    titulo: "Inconsistencia entre documentos",
    texto:
      "La Res. Sanitaria RESPEL 241020665 indica 90 m² para la bodega; la RCA (Cons. 6.2.4) señala que lo correcto es 36 m² y que la resolución debe rectificarse.",
  },
  {
    tipo: "warn",
    titulo: "Documento relacionado no cargado",
    texto:
      "La RCA 202410001185 modifica la RCA N° 49/2017 del proyecto original. Cárgala para completar los requisitos heredados.",
  },
  {
    tipo: "info",
    titulo: "Rectificación aplicada",
    texto:
      "La rectificación del 19-12-2024 cambió 4 requisitos (grupo electrógeno 150→50 kVA, retiro de residuos 2→1 por semana, inicio del PSA y limpieza de playas).",
  },
];

// fuente.doc → id de DOCS_AUCHA; venc en formato AAAA-MM-DD
export const REQ_TEMPLATES: RequisitoExtraido[] = [
  {
    id: "R01",
    tema: "Ruido",
    titulo: "Monitoreo anual de ruido en operación",
    detalle:
      "Medición diurna en receptores R01–R08 y nocturna en R01–R07 según D.S. 38/2011, en la condición crítica de la planta. Informe técnico con fichas de la Res. Ex. 693 SMA/15 y procedimiento Res. Ex. 867 SMA/16.",
    fuente: { doc: "D1", ref: "Cons. 4.3.2, Tabla 2 · CAV 8.9" },
    frecuencia: "Anual",
    evidencia: "Informe técnico de medición de ruido",
    venc: "2027-02-28",
  },
  {
    id: "R02",
    tema: "Ruido",
    titulo: "Silenciadores de escape en grupos electrógenos (−13 dB)",
    detalle:
      "Mejora del silenciador de escape con atenuación de 13 dB en el grupo de 50 kVA (sector L2), los 2 grupos de 635 kVA y los 4 de 750 kVA.",
    fuente: { doc: "D1", ref: "Cons. 4.3.2 · rectificado en D2" },
    frecuencia: "Verificación única",
    evidencia: "Ficha técnica y foto de cada equipo",
    rectificado:
      "La rectificación corrige el grupo de L2: de 150 kVA a 50 kVA.",
  },
  {
    id: "R03",
    tema: "Ruido",
    titulo: "Atenuadores acústicos en ventiladores de estanques",
    detalle:
      "Atenuadores de 10 dB en los ventiladores superiores de los 10 estanques más cercanos al receptor R02.",
    fuente: { doc: "D1", ref: "Cons. 4.3.2" },
    frecuencia: "Verificación única",
    evidencia: "Fotos de los 10 estanques",
  },
  {
    id: "R04",
    tema: "Efluentes (RILes)",
    titulo: "Descarga cumple Tabla 5 del D.S. 90/2000 y caudal máx. 429 L/s",
    detalle:
      "El efluente tratado se descarga por emisario cumpliendo la Tabla 5 del D.S. 90/2000 y sin superar el caudal máximo de 429 L/s.",
    fuente: { doc: "D1", ref: "Cons. 4.3.2 · Tabla 6.2.2" },
    frecuencia: "Continua",
    evidencia: "Resultados de laboratorio y registro de caudal",
  },
  {
    id: "R05",
    tema: "Efluentes (RILes)",
    titulo: "Autocontrol mensual del efluente",
    detalle:
      "Mientras no exista resolución de monitoreo de la SMA: aceites y grasas ≤150 mg/L, pH 5,5–9, sólidos sedimentables ≤20 ml/L/h, SST ≤300 mg/L y SAAM ≤15 mg/L.",
    fuente: { doc: "D1", ref: "Tabla 6.2.2 d) · Tabla 3" },
    frecuencia: "Mensual",
    evidencia: "Informe de laboratorio del mes",
    venc: "2026-10-31",
  },
  {
    id: "R06",
    tema: "Efluentes (RILes)",
    titulo: "Chequeo diario de la planta de RILes",
    detalle:
      "Revisión visual diaria de filtros rotatorios, planta elevadora (PEAS), dosificación de polímero y desinfección UV, con registro en bitácora.",
    fuente: { doc: "D1", ref: "Tabla 9.1 · 9.2" },
    frecuencia: "Diaria",
    evidencia: "Bitácora de chequeo diario",
  },
  {
    id: "R07",
    tema: "Medio marino",
    titulo: "Plan de Seguimiento Ambiental del medio marino",
    detalle:
      "2 campañas al año (estival e invernal) en las estaciones PD, E1–E4, C1 y C2, ejecutadas por una ETFA. Informe a la SMA en un plazo de 90 días. Mínimo 3 años.",
    fuente: { doc: "D1", ref: "CAV 8.1 · rectificado en D2" },
    frecuencia: "Semestral",
    evidencia: "Informe de campaña y comprobante SMA",
    venc: "2026-12-15",
    rectificado:
      "La rectificación fija el inicio del PSA en la fase de construcción (antes: operación).",
  },
  {
    id: "R08",
    tema: "Medio marino",
    titulo: "Filmación e inspección anual del emisario submarino",
    detalle:
      "Filmación de la estructura del emisario en 2 campañas por año, lista de chequeo anual de inspección y limpieza y mantención anual.",
    fuente: { doc: "D2", ref: "Cons. 4.3.2 · Tabla 9.2 (10)" },
    frecuencia: "Semestral",
    evidencia: "Video de filmación y lista de chequeo",
  },
  {
    id: "R09",
    tema: "Residuos no peligrosos",
    titulo: "Lodos del tratamiento en contenedores herméticos",
    detalle:
      "2 contenedores herméticos de 15 m³ dentro de galpón con losa de hormigón; retiro al menos 1 vez por semana por empresa autorizada.",
    fuente: { doc: "D1", ref: "Tabla 6.2.3" },
    frecuencia: "Semanal",
    evidencia: "Guía de despacho del retiro",
    venc: "2026-10-24",
  },
  {
    id: "R10",
    tema: "Residuos no peligrosos",
    titulo: "Retiro semanal de residuos industriales no peligrosos",
    detalle:
      "Plásticos, cartones y papeles en contenedor hermético de 22 m³, con retiro 1 vez por semana y prioridad a reciclaje.",
    fuente: { doc: "D2", ref: "Cons. 4.3.2 (ICE 4.7.6.1)" },
    frecuencia: "Semanal",
    evidencia: "Guía de despacho del retiro",
    rectificado:
      "La rectificación cambia la frecuencia de 2 a 1 retiro por semana.",
  },
  {
    id: "R11",
    tema: "Residuos no peligrosos",
    titulo: "Residuos domiciliarios en contenedor hermético",
    detalle:
      "Contenedor de 22 m³ permanentemente tapado; retiro semanal o según necesidad, sin superar el 80% de su capacidad.",
    fuente: { doc: "D1", ref: "Tabla 6.2.3" },
    frecuencia: "Semanal",
    evidencia: "Foto del contenedor y guía de retiro",
  },
  {
    id: "R12",
    tema: "Ensilaje y mortalidad",
    titulo: "Registro diario de ensilaje (pH ≤ 4)",
    detalle:
      "Registrar diariamente la mortalidad, el pH de la pasta (≤4) y el ácido fórmico usado. Programar el retiro antes del 80% de capacidad de los silos.",
    fuente: { doc: "D1", ref: "Tabla 6.2.3 c.4" },
    frecuencia: "Diaria",
    evidencia: "Planilla diaria de ensilaje",
  },
  {
    id: "R13",
    tema: "Ensilaje y mortalidad",
    titulo: "Pretil de contención y ducha lavaojos",
    detalle:
      "Sistema de ensilaje sobre losa con pretil (≈16,8 m³) capaz de contener el 100% del estanque de acopio, y ducha lavaojos junto a la plataforma.",
    fuente: { doc: "D1", ref: "Tabla 6.2.3 c.1 · Tabla 9.12" },
    frecuencia: "Verificación única",
    evidencia: "Fotos del pretil y de la ducha",
  },
  {
    id: "R14",
    tema: "Aguas servidas",
    titulo: "Retiro de lodos de la PTAS",
    detalle:
      "Lodos de la planta de aguas servidas (≈5 kg/día) retirados aprox. 3 veces al año por empresa autorizada.",
    fuente: { doc: "D1", ref: "Tabla 6.2.1 i)" },
    frecuencia: "Cuatrimestral",
    evidencia: "Guía de retiro con camión limpiafosas",
  },
  {
    id: "R15",
    tema: "Agua",
    titulo: "Monitoreo de nivel freático del acuífero somero",
    detalle:
      "Medición diaria en el piezómetro Pi1 (junto a los pozos 3 y 4). Informe semestral a la SMA durante los primeros 4 años y luego anual.",
    fuente: { doc: "D1", ref: "CAV 8.15" },
    frecuencia: "Diaria · informe semestral",
    evidencia: "Serie de datos e informe a SMA",
    venc: "2027-01-31",
  },
  {
    id: "R16",
    tema: "Agua",
    titulo: "Inspección de fosos y contrafosos de aguas lluvia",
    detalle:
      "Inspección visual semanal en operación y limpieza general anual antes de la temporada de lluvias, con bitácora digital.",
    fuente: { doc: "D1", ref: "CAV 8.11" },
    frecuencia: "Semanal",
    evidencia: "Bitácora y fotos",
  },
  {
    id: "R17",
    tema: "Comunidad",
    titulo: "Gestión del canal de reclamos",
    detalle:
      "Formalizar los reclamos recibidos en un máximo de 24 h y responder en un máximo de 15 días hábiles. Informe anual de reclamos.",
    fuente: { doc: "D1", ref: "CAV 8.6" },
    frecuencia: "Por evento · informe anual",
    evidencia: "Registro de reclamos y respuestas",
  },
  {
    id: "R18",
    tema: "Comunidad",
    titulo: "Reunión anual de difusión de resultados",
    detalle:
      "Presentar a la comunidad los resultados del Plan de Seguimiento Ambiental y del monitoreo de ruido, con registro de asistencia.",
    fuente: { doc: "D1", ref: "CAV 8.2 · 8.10" },
    frecuencia: "Anual",
    evidencia: "Registro de asistencia y presentación",
  },
  {
    id: "R19",
    tema: "Comunidad",
    titulo: "Encuentros de diálogo comunitario",
    detalle:
      "Al menos 2 encuentros al año con acta de temas, acuerdos y plazos, registro de asistentes y fotos.",
    fuente: { doc: "D1", ref: "CAV 8.3" },
    frecuencia: "Semestral",
    evidencia: "Acta y registro fotográfico",
  },
  {
    id: "R20",
    tema: "Borde costero",
    titulo: "Limpieza mensual de playa",
    detalle:
      "Limpieza mensual del sector costero aledaño con Registro de Playas Limpias (fecha, participantes, residuos extraídos, fotos) y copia de la guía de despacho. Informe semestral a la SMA.",
    fuente: { doc: "D2", ref: "CAV 8.14" },
    frecuencia: "Mensual",
    evidencia: "Registro de playas limpias y guía de despacho",
    venc: "2026-10-31",
    rectificado:
      "La rectificación exige copia de la guía de despacho como indicador.",
  },
  {
    id: "R21",
    tema: "Capacitación",
    titulo: "Capacitación anual en buenas prácticas ambientales",
    detalle:
      "Charla anual (y a cada trabajador nuevo) sobre operación, planes de contingencia, manejo de residuos, químicos e hidrocarburos.",
    fuente: { doc: "D1", ref: "CAV 8.8" },
    frecuencia: "Anual",
    evidencia: "Registro de asistencia y contenidos",
  },
  {
    id: "R22",
    tema: "Capacitación",
    titulo: "Capacitación en conservación de mamíferos marinos",
    detalle:
      "Inducción a todos los trabajadores sobre la normativa de avistamiento, acercamiento y captura de mamíferos marinos.",
    fuente: { doc: "D1", ref: "CAV 8.19" },
    frecuencia: "Anual",
    evidencia: "Registro de capacitación",
  },
  {
    id: "R23",
    tema: "Paisaje y flora",
    titulo: "Monitoreo de la cortina vegetal",
    detalle:
      "Seguimiento anual (hasta 5 años) de la barrera vegetal hacia la ruta V-891 y el mar, con replante si es necesario e informe a la SMA.",
    fuente: { doc: "D1", ref: "CAV 8.18" },
    frecuencia: "Anual",
    evidencia: "Informe fotográfico",
  },
  {
    id: "R24",
    tema: "Contingencias",
    titulo: "Aviso a la SMA en menos de 24 h",
    detalle:
      "Ante cualquier contingencia que afecte agua, aire, suelo, biodiversidad o medio humano, reportar en el Sistema de Seguimiento Ambiental según Res. Ex. 885/2016.",
    fuente: { doc: "D1", ref: "Considerando 9" },
    frecuencia: "Por evento",
    evidencia: "Comprobante de reporte",
  },
  {
    id: "R25",
    tema: "Contingencias",
    titulo: "Simulacros de incendio y mantención de extintores",
    detalle:
      "Simulacros registrados, mantención anual de equipos contra incendio por servicio autorizado y mapa de salidas y extintores.",
    fuente: { doc: "D1", ref: "Tabla 9.3" },
    frecuencia: "Anual",
    evidencia: "Reporte de simulacro y certificado de mantención",
  },
  {
    id: "R26",
    tema: "Sustancias peligrosas",
    titulo: "Declaración semestral de sustancias peligrosas",
    detalle:
      "Declarar el almacenamiento de sustancias peligrosas dos veces al año, con plazo máximo el 20 de junio y el 20 de diciembre (art. 5 D.S. 43/15).",
    fuente: { doc: "D3", ref: "Resuelvo 4" },
    frecuencia: "Semestral",
    evidencia: "Comprobante de declaración",
    venc: "2026-12-20",
  },
  {
    id: "R27",
    tema: "Sustancias peligrosas",
    titulo: "Condiciones de la bodega SUSPEL",
    detalle:
      "Capacidad máxima de 9,5 t; clases 8, 5.1, 3 y 9 en envases portátiles; muros RF 180 min; detección automática de humo. Cualquier ampliación o traslado requiere nueva autorización.",
    fuente: { doc: "D3", ref: "Resuelvo 2, 3 y 5" },
    frecuencia: "Verificación en terreno",
    evidencia: "Fotos e inventario de la bodega",
  },
  {
    id: "R28",
    tema: "Residuos peligrosos",
    titulo: "Almacenamiento de RESPEL menor a 6 meses",
    detalle:
      "Ningún residuo peligroso puede superar 6 meses en bodega (art. 31 D.S. 148/2003). Control mediante la planilla “Control de Inventario Bodega RESPEL”.",
    fuente: { doc: "D4", ref: "Resuelvo 2 · RCA 6.2.4" },
    frecuencia: "Mensual",
    evidencia: "Inventario actualizado",
  },
  {
    id: "R29",
    tema: "Residuos peligrosos",
    titulo: "Registro de ingreso y salida de RESPEL",
    detalle:
      "Sistema de registro de ingreso al sitio y salida a la instalación de eliminación, mantenido permanentemente actualizado.",
    fuente: { doc: "D4", ref: "Resuelvo 2" },
    frecuencia: "Continua",
    evidencia: "Registro y guías de salida",
  },
  {
    id: "R30",
    tema: "Residuos peligrosos",
    titulo: "Etiquetado NCh 2190 y hojas de seguridad",
    detalle:
      "Contenedores en buen estado y etiquetados según NCh 2190 Of.93; hojas de seguridad disponibles en la bodega.",
    fuente: { doc: "D4", ref: "Resuelvo 2 y 5" },
    frecuencia: "Verificación en terreno",
    evidencia: "Fotos de etiquetas y HDS",
  },
  {
    id: "R31",
    tema: "Residuos peligrosos",
    titulo: "Protocolos y plan de emergencia del sitio RESPEL",
    detalle:
      "Mantener protocolos de operación actualizados y un plan para enfrentar emergencias en el sitio de almacenamiento.",
    fuente: { doc: "D4", ref: "Resuelvo 5" },
    frecuencia: "Anual",
    evidencia: "Documento vigente del plan",
  },
  {
    id: "R32",
    tema: "Residuos peligrosos",
    titulo: "Rectificar superficie en la Res. Sanitaria RESPEL",
    detalle:
      "La resolución indica 90 m², pero la superficie correcta es 36 m². Debe rectificarse ante la Autoridad Sanitaria.",
    fuente: { doc: "D1", ref: "Tabla 6.2.4 a)" },
    frecuencia: "Gestión única",
    evidencia: "Solicitud o resolución rectificada",
  },
  {
    id: "R33",
    tema: "Olores",
    titulo: "Buenas prácticas en filtro tornillo y ductos",
    detalle:
      "Retiro frecuente de material biológico, mantención de filtros, retiro de lodos con condiciones meteorológicas favorables y revisión del ducto del pozo de lodos.",
    fuente: { doc: "D1", ref: "Cons. 4.3.2, Tabla 3" },
    frecuencia: "Semanal",
    evidencia: "Registro de mantención",
  },
  {
    id: "R34",
    tema: "Gestión y reportes",
    titulo: "Declaración mensual en RETC / SINADER",
    detalle:
      "Declarar mensualmente los RILes (según resolución de monitoreo) y los residuos en la Ventanilla Única del RETC.",
    fuente: { doc: "D1", ref: "Tabla 7.2.4 · 7.3.3" },
    frecuencia: "Mensual",
    evidencia: "Comprobante de declaración",
    venc: "2026-11-10",
  },
  {
    id: "R35",
    tema: "Gestión y reportes",
    titulo: "Informar a la SMA el inicio de cada fase",
    detalle:
      "Avisar a la SMA con al menos una semana de anticipación el inicio de cada fase del proyecto.",
    fuente: { doc: "D1", ref: "Considerando 12" },
    frecuencia: "Por evento",
    evidencia: "Comprobante de aviso",
  },
];
