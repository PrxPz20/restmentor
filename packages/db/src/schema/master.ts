import { pgTable, uuid, varchar, text, timestamp, jsonb, decimal } from 'drizzle-orm/pg-core';

// ── Restaurants (Tenant Registry) ───────────────────────
export const restaurants = pgTable('restaurants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  neonConnectionString: text('neon_connection_string').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  commissionRate: decimal('commission_rate', { precision: 5, scale: 4 }).notNull().default('0.10'),
  settings: jsonb('settings').default({}),
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Platform Users (Super Admin Accounts) ───────────────
export const platformUsers = pgTable('platform_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('superadmin'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Commission Ledger (Platform-Wide Revenue) ───────────
export const commissionLedger = pgTable('commission_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  sessionRef: varchar('session_ref', { length: 255 }).notNull(),
  orderItemRef: varchar('order_item_ref', { length: 255 }).notNull(),
  itemPrice: decimal('item_price', { precision: 10, scale: 2 }).notNull(),
  commissionRate: decimal('commission_rate', { precision: 5, scale: 4 }).notNull(),
  commissionAmount: decimal('commission_amount', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
