export const STORAGE = Symbol("STORAGE");

export interface StoredObject {
  body: Buffer;
  contentType: string | null;
}

export interface StorageService {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  presignedGetUrl(key: string, filename?: string): Promise<string>;
}
