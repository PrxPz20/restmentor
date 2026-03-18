export * as masterSchema from './schema/master.js';
export * as tenantSchema from './schema/tenant.js';
export { getMasterDb, getTenantDb } from './connection.js';
export type { MasterDb, TenantDb } from './connection.js';
