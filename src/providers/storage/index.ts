import fs from "node:fs";
import path from "node:path";
import { config } from "../../config/index.js";

export interface StorageProvider {
  id: string;
  put(localPath: string, key: string): Promise<string>;
  get(key: string): Promise<string>;
}

export class LocalStorage implements StorageProvider {
  id = "local-fs";
  root = path.join(config.dataDir, "storage");
  async put(localPath: string, key: string): Promise<string> {
    const dest = path.join(this.root, key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(localPath, dest);
    return dest;
  }
  async get(key: string): Promise<string> {
    return path.join(this.root, key);
  }
}

/** Cloud adapter seam — S3-compatible endpoint when configured. Never required. */
export class S3Storage implements StorageProvider {
  id = "s3";
  async put(_localPath: string, key: string): Promise<string> {
    throw new Error("S3 storage not configured. Set S3_ENDPOINT/S3_BUCKET to enable remote storage.");
  }
  async get(key: string): Promise<string> {
    throw new Error("S3 storage not configured");
  }
}

export function storage(): StorageProvider {
  if (process.env.S3_ENDPOINT && process.env.S3_BUCKET) return new S3Storage();
  return new LocalStorage();
}
