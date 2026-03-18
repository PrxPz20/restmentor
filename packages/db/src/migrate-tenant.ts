import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function migrateTenant() {
  const dbUrl = process.env.TENANT_TEST_DATABASE_URL;
  if (!dbUrl) {
    console.error('TENANT_TEST_DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('Connecting to test tenant database...');
  const client = neon(dbUrl);
  const db = drizzle(client);

  console.log('Creating tenant database tables...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      waiter_number VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'waiter',
      password_hash TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('  ✓ users');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tables (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      current_session_id UUID,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('  ✓ tables');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS table_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      table_id UUID NOT NULL REFERENCES tables(id),
      waiter_id UUID NOT NULL REFERENCES users(id),
      guest_males INTEGER NOT NULL DEFAULT 0,
      guest_females INTEGER NOT NULL DEFAULT 0,
      guest_kids INTEGER NOT NULL DEFAULT 0,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      paid_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ
    )
  `);
  console.log('  ✓ table_sessions');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('  ✓ menu_categories');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS menu_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id UUID NOT NULL REFERENCES menu_categories(id),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      destination VARCHAR(20) NOT NULL DEFAULT 'kitchen',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('  ✓ menu_items');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES table_sessions(id),
      round_number INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      sent_at TIMESTAMPTZ
    )
  `);
  console.log('  ✓ orders');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id),
      menu_item_id UUID NOT NULL REFERENCES menu_items(id),
      gender_target VARCHAR(10) NOT NULL DEFAULT 'shared',
      quantity INTEGER NOT NULL DEFAULT 1,
      ai_suggested BOOLEAN NOT NULL DEFAULT false,
      ai_suggestion_id UUID,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('  ✓ order_items');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_suggestions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES table_sessions(id),
      round_context JSONB NOT NULL,
      suggested_items JSONB NOT NULL,
      reasoning JSONB NOT NULL,
      accepted_item_ids JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('  ✓ ai_suggestions');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID NOT NULL,
      previous_state JSONB,
      new_state JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('  ✓ audit_log');

  console.log('\nTenant database migration complete!');
}

migrateTenant().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
