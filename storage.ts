export interface StorageUsage {
  usedKb: number;
  quotaKb: number;
  percentUsed: number;
}

export function safeLocalStorageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[STARVIX Storage] Failed reading key "${key}":`, err);
    return fallback;
  }
}

export function safeLocalStorageSet<T>(key: string, value: T): boolean {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (err: unknown) {
    console.warn(`[STARVIX Storage] Quota or write error on "${key}":`, err);

    // Attempt defensive cleanup: drop non-critical caches
    try {
      localStorage.removeItem('starvix_telemetry_cache');
      localStorage.removeItem('starvix_temp_logs');
      // Retry once
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch {
      // Disk quota completely exceeded on mobile device
      return false;
    }
  }
}

export function getStorageUsage(): StorageUsage {
  try {
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const val = localStorage.getItem(key) || '';
        totalBytes += (key.length + val.length) * 2; // UTF-16 representation
      }
    }
    const usedKb = Number((totalBytes / 1024).toFixed(1));
    const quotaKb = 5120; // 5MB standard mobile browser quota
    const percentUsed = Math.min(100, Number(((usedKb / quotaKb) * 100).toFixed(1)));

    return { usedKb, quotaKb, percentUsed };
  } catch {
    return { usedKb: 0, quotaKb: 5120, percentUsed: 0 };
  }
}
