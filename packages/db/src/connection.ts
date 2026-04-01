// packages/db/src/connection.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as masterSchema from './schema/master.js';
import * as tenantSchema from './schema/tenant.js';

export function getMasterDb() {
  const databaseUrl = process.env.MASTER_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('MASTER_DATABASE_URL is not set');
  }
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema: masterSchema });
}

export function getTenantDb(connectionString: string) {
  const sql = neon(connectionString);
  return drizzle(sql, { schema: tenantSchema });
}

export type MasterDb = ReturnType<typeof getMasterDb>;
export type TenantDb = ReturnType<typeof getTenantDb>;
