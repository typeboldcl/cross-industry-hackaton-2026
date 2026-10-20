import type { StorageService, StoredObject } from "./storage.service.js";

export class MemoryStorage implements StorageService {
  readonly objects = new Map<string, StoredObject>();

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async get(key: string): Promise<StoredObject> {
    const object = this.objects.get(key);
    if (!object) throw new Error(`No object at ${key}.`);
    return object;
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async presignedGetUrl(key: string): Promise<string> {
    return `memory://${key}`;
  }
}
