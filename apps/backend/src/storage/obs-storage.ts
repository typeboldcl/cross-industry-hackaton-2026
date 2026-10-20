import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageSettings } from "../common/config/env.js";
import type { StorageService, StoredObject } from "./storage.service.js";

const PRESIGNED_URL_SECONDS = 300;

export class ObsStorage implements StorageService {
  private readonly client: S3Client;

  constructor(private readonly settings: StorageSettings) {
    if (!settings.accessKey || !settings.secretKey) {
      throw new Error("OBS_AK and OBS_SK are required to use OBS storage.");
    }

    this.client = new S3Client({
      endpoint: settings.endpoint,
      region: settings.region,
      credentials: {
        accessKeyId: settings.accessKey,
        secretAccessKey: settings.secretKey,
      },
      forcePathStyle: false,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<StoredObject> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }),
    );

    if (!response.Body) {
      throw new Error(`OBS returned no body for ${key}.`);
    }

    return {
      body: Buffer.from(await response.Body.transformToByteArray()),
      contentType: response.ContentType ?? null,
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (error instanceof NotFound) return false;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: key }),
    );
  }

  presignedGetUrl(key: string, filename?: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        ResponseContentDisposition: filename
          ? `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
          : undefined,
      }),
      { expiresIn: PRESIGNED_URL_SECONDS },
    );
  }
}
