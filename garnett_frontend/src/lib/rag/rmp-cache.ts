const rmpCache = new Map<
  string,
  { data: unknown; timestamp: number }
>();

const CACHE_DURATION = 24 * 60 * 60 * 1000;
export const MAX_CACHE_SIZE = 1500;

export function getCachedRmpData(profId: string): unknown | null {
  const cached = rmpCache.get(profId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    rmpCache.delete(profId);
    rmpCache.set(profId, cached);
    return cached.data;
  }
  if (cached) {
    rmpCache.delete(profId);
  }
  return null;
}

export function setCachedRmpData(profId: string, data: unknown): void {
  if (rmpCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = rmpCache.keys().next().value as string;
    rmpCache.delete(oldestKey);
  }
  rmpCache.set(profId, { data, timestamp: Date.now() });
}

export function getCacheStats() {
  const now = Date.now();
  let expired = 0;
  let valid = 0;
  for (const [, cached] of rmpCache.entries()) {
    if (now - cached.timestamp > CACHE_DURATION) expired++;
    else valid++;
  }
  return {
    size: rmpCache.size,
    maxSize: MAX_CACHE_SIZE,
    valid,
    expired,
    utilizationPercent: Math.round((rmpCache.size / MAX_CACHE_SIZE) * 100),
    entries: Array.from(rmpCache.keys()).slice(0, 10),
  };
}
