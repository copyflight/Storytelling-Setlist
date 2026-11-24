export const LS = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage quota errors
    }
  },
  del(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  },
};

export interface StoredAudioRecord {
  blob: Blob;
  name: string;
}

export const AssetDB = {
  open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("copyflight-set", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("assets")) {
          db.createObjectStore("assets");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async put(key: string, value: StoredAudioRecord): Promise<boolean> {
    try {
      const db = await this.open();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("assets", "readwrite");
        tx.objectStore("assets").put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      return false;
    }
  },
  async get(key: string): Promise<StoredAudioRecord | null> {
    try {
      const db = await this.open();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("assets", "readonly");
        const query = tx.objectStore("assets").get(key);
        query.onsuccess = () => resolve((query.result as StoredAudioRecord) || null);
        query.onerror = () => reject(query.error);
      });
    } catch {
      return null;
    }
  },
  async del(key: string): Promise<boolean> {
    try {
      const db = await this.open();
      return await new Promise((resolve) => {
        const tx = db.transaction("assets", "readwrite");
        tx.objectStore("assets").delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  },
};
