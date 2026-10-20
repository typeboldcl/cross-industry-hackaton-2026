import type { Auditoria, EstadoTerreno, Requisito } from "@hackaton/contracts";
import { activeReqs, numeracion, ORDEN_ESTADO, stats } from "./auditoria";
import { demoAudits, newAudit } from "./factories";

const req = (
  id: string,
  tema: string,
  estado: EstadoTerreno = "pendiente",
  val: Requisito["val"] = "validado",
): Requisito => ({
  id,
  tema,
  titulo: id,
  detalle: "",
  fuente: { doc: "D1", ref: "" },
  frecuencia: "Anual",
  evidencia: "",
  val,
  estado,
  obs: "",
  evidencias: [],
  hist: [],
});

const audit = (reqs: Requisito[]): Auditoria => ({
  ...newAudit(1, {
    inst: "aucha",
    nombre: "T",
    tipo: "Interna",
    fecha: "2026-10-01",
  }),
  reqs,
});

describe("stats", () => {
  it("calcula cumplimiento sin contar N/A ni pendientes", () => {
    const s = stats([
      req("a", "x", "cumple"),
      req("b", "x", "cumple"),
      req("c", "x", "cumple"),
      req("d", "x", "no_cumple"),
      req("e", "x", "na"),
      req("f", "x"),
    ]);
    expect(s.pct).toBe(75);
    expect(s.llenos).toBe(5);
    expect(s.avance).toBe(83);
  });

  it("devuelve null si no hay nada evaluado", () => {
    expect(stats([req("a", "x", "na"), req("b", "x")]).pct).toBeNull();
  });
});

describe("numeracion", () => {
  it("numera como la planilla y no cambia al marcar", () => {
    const a = audit([
      req("r1", "Ruido"),
      req("r2", "Agua"),
      req("r3", "Ruido", "cumple"),
      req("r4", "Ruido", "pendiente", "descartado"),
    ]);
    const n = numeracion(a);
    expect(n.tema).toEqual({ Ruido: 1, Agua: 2 });
    expect(n.code).toEqual({ r1: "1-a", r2: "2-a", r3: "1-b" });
  });
});

describe("orden en terreno", () => {
  it("pendientes, luego Cumple, No cumple y N/A", () => {
    const orden = (["na", "cumple", "pendiente", "no_cumple"] as const)
      .slice()
      .sort((x, y) => ORDEN_ESTADO[x] - ORDEN_ESTADO[y]);
    expect(orden).toEqual(["pendiente", "cumple", "no_cumple", "na"]);
  });
});

describe("ejemplo", () => {
  it("carga Q3 cerrada y Q4 en terreno con notas en cada No cumple", () => {
    const [q3, q4] = demoAudits();
    expect(q3.status).toBe("cerrada");
    expect(q4.status).toBe("publicada");
    expect(stats(activeReqs(q4))).toMatchObject({
      cumple: 12,
      no_cumple: 4,
      na: 1,
      pct: 75,
    });
    for (const r of [...q3.reqs, ...q4.reqs]) {
      if (r.estado === "no_cumple") expect(r.obs).not.toBe("");
      if (r.estado === "na") expect(r.naMotivo).toBeTruthy();
    }
  });
});
