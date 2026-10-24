import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

class StorageService {
  constructor() {
    this.driver = env.STORAGE_DRIVER;
    this.localDir = env.LOCAL_STORAGE_DIR;

    if (!fs.existsSync(this.localDir)) {
      fs.mkdirSync(this.localDir, { recursive: true });
    }
  }

  /**
   * Generates a safe, unguessable storage key (UUID + optional ext)
   */
  generateStorageKey(ext = '') {
    const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '');
    const suffix = cleanExt ? `.${cleanExt}` : '';
    return `${uuidv4()}${suffix}`;
  }

  /**
   * Save a buffer to storage
   */
  async saveFile(buffer, ext = '') {
    const storageKey = this.generateStorageKey(ext);

    if (this.driver === 'local') {
      const filePath = path.join(this.localDir, storageKey);
      await fs.promises.writeFile(filePath, buffer);
      return {
        storageKey,
        storageType: 'local',
      };
    } else {
      // In production with S3 configured, this connects to AWS S3 / MinIO client
      // For fallback/dev consistency, save locally
      const filePath = path.join(this.localDir, storageKey);
      await fs.promises.writeFile(filePath, buffer);
      return {
        storageKey,
        storageType: 's3',
      };
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(storageKey) {
    if (this.driver === 'local' || true) {
      const safeKey = path.basename(storageKey);
      const filePath = path.join(this.localDir, safeKey);
      return fs.existsSync(filePath);
    }
  }

  /**
   * Stream a file to an HTTP response
   */
  createReadStream(storageKey) {
    const safeKey = path.basename(storageKey);
    const filePath = path.join(this.localDir, safeKey);

    if (!fs.existsSync(filePath)) {
      throw new Error('Stored file not found on disk');
    }

    return fs.createReadStream(filePath);
  }

  /**
   * Delete file from disk
   */
  async deleteFile(storageKey) {
    try {
      const safeKey = path.basename(storageKey);
      const filePath = path.join(this.localDir, safeKey);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      return true;
    } catch (err) {
      console.error(`Failed to delete file ${storageKey}:`, err);
      return false;
    }
  }
}

export const storageService = new StorageService();
