import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function migrate() {
  const dbUrl = process.env.MASTER_DATABASE_URL;
  if (!dbUrl) {
    console.error('MASTER_DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('Connecting to master database...');
  const client = neon(dbUrl);
  const db = drizzle(client);

  console.log('Creating master database tables...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS restaurants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      neon_connection_string TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.10,
      settings JSONB DEFAULT '{}',
      onboarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('  ✓ restaurants');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS platform_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'superadmin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('  ✓ platform_users');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS commission_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      session_ref VARCHAR(255) NOT NULL,
      order_item_ref VARCHAR(255) NOT NULL,
      item_price DECIMAL(10,2) NOT NULL,
      commission_rate DECIMAL(5,4) NOT NULL,
      commission_amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('  ✓ commission_ledger');

  console.log('\nMaster database migration complete!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
