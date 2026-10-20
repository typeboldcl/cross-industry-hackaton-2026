export interface QueryRequest {
  question: string;
  topK?: number;
  answer?: boolean;
}

export interface QueryChunk {
  documentId: string;
  documentTitle: string;
  documentNumber: string | null;
  sectionKey: string;
  part: number;
  pageFrom: number | null;
  pageTo: number | null;
  text: string;
  score: number;
}

export interface QueryAnswer {
  text: string;
  citations: { documentId: string; sectionKey: string; page: number | null }[];
}

export interface QueryResponse {
  chunks: QueryChunk[];
  answer: QueryAnswer | null;
}
