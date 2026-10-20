export interface SeiaProject {
  expedienteId: string;
  name: string;
  titular: string;
  type: string;
  region: string | null;
  comuna: string | null;
  submittedOn: string | null;
  state: string | null;
}

export interface SeiaDocument {
  folio: string | null;
  type: string;
  sender: string | null;
  date: string | null;
  title: string;
  url: string;
}

export interface SeiaPertinencia {
  id: string;
  kind: "OLD" | "NEW";
  name: string;
  proponent: string;
  comuna: string | null;
  state: string | null;
  submittedOn: string | null;
}
