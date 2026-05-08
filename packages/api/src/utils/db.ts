// packages/api/src/utils/db.ts
// Production-grade DB connection management for multi-tenant SaaS
// - Master DB singleton (one connection, reused across all requests)
// - Tenant DB cache (one cached connection per restaurant, LRU eviction)
// - Keepalive ping to prevent Neon cold starts
// - Stale eviction to prevent memory leaks at scale

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

// ── Master DB Singleton ───────────────────────────────────────
// Created once at first use, reused for all subsequent requests.
// The master DB is queried on every login and every API request
// (to resolve tenant connection string), so it must never be cold.

let _masterDb: ReturnType<typeof drizzle> | null = null;

export function getMasterDb(): ReturnType<typeof drizzle> {
  if (!_masterDb) {
    const masterUrl = process.env.MASTER_DATABASE_URL;
    if (!masterUrl) throw new Error('MASTER_DATABASE_URL not set');
    _masterDb = drizzle(neon(masterUrl));
  }
  return _masterDb;
}

// ── Tenant DB Cache ───────────────────────────────────────────
// One cached db instance per restaurantId (UUID — never user-controlled).
// Connection string is verified from master DB before first cache entry.
// Eviction: LRU when at capacity, TTL for stale entries.

interface TenantCacheEntry {
  db: ReturnType<typeof drizzle>;
  lastUsedAt: number;
}

const TENANT_CACHE_MAX = 500;          // Max restaurants in memory at once
const TENANT_CACHE_TTL_MS = 60 * 60 * 1000; // Evict after 1hr of inactivity

const _tenantCache = new Map<string, TenantCacheEntry>();

export function getTenantDbCached(
  restaurantId: string,
  connectionString: string
): ReturnType<typeof drizzle> {
  const existing = _tenantCache.get(restaurantId);
  if (existing) {
    existing.lastUsedAt = Date.now();
    return existing.db;
  }

  // At capacity — evict the least recently used entry
  if (_tenantCache.size >= TENANT_CACHE_MAX) {
    let lruKey = '';
    let lruTime = Infinity;
    for (const [key, entry] of _tenantCache) {
      if (entry.lastUsedAt < lruTime) {
        lruTime = entry.lastUsedAt;
        lruKey = key;
      }
    }
    if (lruKey) _tenantCache.delete(lruKey);
  }

  const db = drizzle(neon(connectionString));
  _tenantCache.set(restaurantId, { db, lastUsedAt: Date.now() });
  return db;
}

// Called when a restaurant is suspended — immediately evicts their
// cached connection so subsequent requests fail auth as expected.
export function evictTenantFromCache(restaurantId: string): void {
  _tenantCache.delete(restaurantId);
}

// ── Stale Eviction ────────────────────────────────────────────
// Run on a 30-minute interval to free memory for inactive restaurants.
export function evictStaleTenantConnections(): number {
  const now = Date.now();
  let evicted = 0;
  for (const [key, entry] of _tenantCache) {
    if (now - entry.lastUsedAt > TENANT_CACHE_TTL_MS) {
      _tenantCache.delete(key);
      evicted++;
    }
  }
  return evicted;
}

// ── Cache Stats (for health endpoint / monitoring) ────────────
export function getTenantCacheStats(): { size: number; maxSize: number } {
  return { size: _tenantCache.size, maxSize: TENANT_CACHE_MAX };
}

// ── Master DB Keepalive ───────────────────────────────────────
// Neon serverless suspends after ~5 minutes of inactivity.
// Ping every 4 minutes to keep master DB warm.
// Tenant DBs warm themselves naturally through usage.
export async function pingMasterDb(): Promise<void> {
  try {
    await getMasterDb().execute(sql`SELECT 1`);
  } catch {
    // Fail silently — keepalive is best-effort, not critical path
  }
}
