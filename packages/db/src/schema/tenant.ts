// packages/db/src/schema/tenant.ts
import { pgTable, uuid, varchar, text, timestamp, integer, boolean, decimal, jsonb } from 'drizzle-orm/pg-core';

// ── Users (Waiters & Restaurant Admins) ─────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  waiterNumber: varchar('waiter_number', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('waiter'),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Tables ──────────────────────────────────────────────
export const tables = pgTable('tables', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: varchar('label', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  currentSessionId: uuid('current_session_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Table Sessions ──────────────────────────────────────
export const tableSessions = pgTable('table_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id').notNull().references(() => tables.id),
  waiterId: uuid('waiter_id').notNull().references(() => users.id),
  guestMales: integer('guest_males').notNull().default(0),
  guestFemales: integer('guest_females').notNull().default(0),
  guestKids: integer('guest_kids').notNull().default(0),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

// ── Menu Categories ─────────────────────────────────────
export const menuCategories = pgTable('menu_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Menu Items ──────────────────────────────────────────
export const menuItems = pgTable('menu_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').notNull().references(() => menuCategories.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  destination: varchar('destination', { length: 20 }).notNull().default('kitchen'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Orders ──────────────────────────────────────────────
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => tableSessions.id),
  roundNumber: integer('round_number').notNull().default(1),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
});

// ── Order Items ─────────────────────────────────────────
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  menuItemId: uuid('menu_item_id').notNull().references(() => menuItems.id),
  genderTarget: varchar('gender_target', { length: 10 }).notNull().default('shared'),
  quantity: integer('quantity').notNull().default(1),
  aiSuggested: boolean('ai_suggested').notNull().default(false),
  aiSuggestionId: uuid('ai_suggestion_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── AI Suggestions ──────────────────────────────────────
export const aiSuggestions = pgTable('ai_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => tableSessions.id),
  roundContext: jsonb('round_context').notNull(),
  suggestedItems: jsonb('suggested_items').notNull(),
  reasoning: jsonb('reasoning').notNull(),
  acceptedItemIds: jsonb('accepted_item_ids').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Restaurant Gender Stats ─────────────────────────────
export const restaurantGenderStats = pgTable('restaurant_gender_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  totalMales: integer('total_males').notNull().default(0),
  totalFemales: integer('total_females').notNull().default(0),
  totalKids: integer('total_kids').notNull().default(0),
  totalGuests: integer('total_guests').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Restaurant Item Stats ───────────────────────────────
export const restaurantItemStats = pgTable('restaurant_item_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  menuItemId: uuid('menu_item_id').notNull().references(() => menuItems.id),
  genderTarget: varchar('gender_target', { length: 10 }).notNull(),
  totalQuantity: integer('total_quantity').notNull().default(0),
  aiSuggestedQuantity: integer('ai_suggested_quantity').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Audit Log ───────────────────────────────────────────
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  previousState: jsonb('previous_state'),
  newState: jsonb('new_state'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
