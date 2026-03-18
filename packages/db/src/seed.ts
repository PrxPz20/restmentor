import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import bcryptjs from 'bcryptjs';
const { hash } = bcryptjs;
import 'dotenv/config';

async function seed() {
  // ── Seed Master Database ────────────────────────────
  const masterUrl = process.env.MASTER_DATABASE_URL;
  const tenantUrl = process.env.TENANT_TEST_DATABASE_URL;
  if (!masterUrl || !tenantUrl) {
    console.error('MASTER_DATABASE_URL and TENANT_TEST_DATABASE_URL must be set');
    process.exit(1);
  }

  const masterClient = neon(masterUrl);
  const masterDb = drizzle(masterClient);

  console.log('Seeding master database...');

  // Create test restaurant
  const existingRestaurant = await masterDb.execute(
    sql`SELECT id FROM restaurants WHERE slug = 'testrestaurant' LIMIT 1`
  );

  if (existingRestaurant.rows.length === 0) {
    await masterDb.execute(sql`
      INSERT INTO restaurants (name, slug, neon_connection_string, status, commission_rate)
      VALUES ('Test Restaurant', 'testrestaurant', ${tenantUrl}, 'active', 0.10)
    `);
    console.log('  ✓ Test restaurant created (slug: testrestaurant)');
  } else {
    console.log('  ✓ Test restaurant already exists');
  }

  // Create superadmin user
  const existingAdmin = await masterDb.execute(
    sql`SELECT id FROM platform_users WHERE email = 'admin@restmentor.com' LIMIT 1`
  );

  if (existingAdmin.rows.length === 0) {
    const passwordHash = await hash('admin123', 12);
    await masterDb.execute(sql`
      INSERT INTO platform_users (name, email, password_hash, role)
      VALUES ('Platform Admin', 'admin@restmentor.com', ${passwordHash}, 'superadmin')
    `);
    console.log('  ✓ Superadmin created (admin@restmentor.com / admin123)');
  } else {
    console.log('  ✓ Superadmin already exists');
  }

  // ── Seed Tenant Database ────────────────────────────
  const tenantClient = neon(tenantUrl);
  const tenantDb = drizzle(tenantClient);

  console.log('\nSeeding tenant database (Test Restaurant)...');

  // Create test waiter
  const existingWaiter = await tenantDb.execute(
    sql`SELECT id FROM users WHERE waiter_number = '001' LIMIT 1`
  );

  if (existingWaiter.rows.length === 0) {
    const waiterHash = await hash('waiter123', 12);
    await tenantDb.execute(sql`
      INSERT INTO users (waiter_number, name, role, password_hash, is_active)
      VALUES ('001', 'John Waiter', 'waiter', ${waiterHash}, true)
    `);
    console.log('  ✓ Test waiter created (testrestaurant/001 / waiter123)');
  } else {
    console.log('  ✓ Test waiter already exists');
  }

  // Create test admin
  const existingRestAdmin = await tenantDb.execute(
    sql`SELECT id FROM users WHERE waiter_number = 'admin' LIMIT 1`
  );

  if (existingRestAdmin.rows.length === 0) {
    const adminHash = await hash('admin123', 12);
    await tenantDb.execute(sql`
      INSERT INTO users (waiter_number, name, role, password_hash, is_active)
      VALUES ('admin', 'Restaurant Admin', 'admin', ${adminHash}, true)
    `);
    console.log('  ✓ Restaurant admin created (testrestaurant/admin / admin123)');
  } else {
    console.log('  ✓ Restaurant admin already exists');
  }

  // Create test tables
  const existingTables = await tenantDb.execute(
    sql`SELECT id FROM tables LIMIT 1`
  );

  if (existingTables.rows.length === 0) {
    for (let i = 1; i <= 10; i++) {
      await tenantDb.execute(sql`
        INSERT INTO tables (label, status, sort_order)
        VALUES (${`Table ${i}`}, 'open', ${i})
      `);
    }
    console.log('  ✓ 10 tables created (Table 1 - Table 10)');
  } else {
    console.log('  ✓ Tables already exist');
  }

  // Create test menu categories and items
  const existingCategories = await tenantDb.execute(
    sql`SELECT id FROM menu_categories LIMIT 1`
  );

  if (existingCategories.rows.length === 0) {
    // Starters
    const starters = await tenantDb.execute(sql`
      INSERT INTO menu_categories (name, sort_order) VALUES ('Starters', 1) RETURNING id
    `);
    const startersId = starters.rows[0]!.id;

    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${startersId}, 'Caesar Salad', 'Fresh romaine, parmesan, croutons', 12.50, 'kitchen')`);
    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${startersId}, 'Bruschetta', 'Toasted bread with tomato and basil', 9.00, 'kitchen')`);
    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${startersId}, 'Soup of the Day', 'Ask your waiter for today''s selection', 8.50, 'kitchen')`);

    // Mains
    const mains = await tenantDb.execute(sql`
      INSERT INTO menu_categories (name, sort_order) VALUES ('Mains', 2) RETURNING id
    `);
    const mainsId = mains.rows[0]!.id;

    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${mainsId}, 'Grilled Ribeye Steak', '300g ribeye with roasted vegetables', 32.00, 'kitchen')`);
    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${mainsId}, 'Pan-Seared Sea Bass', 'With lemon butter sauce and asparagus', 28.00, 'kitchen')`);
    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${mainsId}, 'Mushroom Risotto', 'Arborio rice with wild mushrooms and truffle oil', 22.00, 'kitchen')`);
    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${mainsId}, 'Grilled Chicken Breast', 'With mashed potatoes and gravy', 20.00, 'kitchen')`);

    // Desserts
    const desserts = await tenantDb.execute(sql`
      INSERT INTO menu_categories (name, sort_order) VALUES ('Desserts', 3) RETURNING id
    `);
    const dessertsId = desserts.rows[0]!.id;

    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${dessertsId}, 'Tiramisu', 'Classic Italian coffee dessert', 10.00, 'kitchen')`);
    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${dessertsId}, 'Chocolate Lava Cake', 'Warm chocolate cake with vanilla ice cream', 12.00, 'kitchen')`);

    // Wines
    const wines = await tenantDb.execute(sql`
      INSERT INTO menu_categories (name, sort_order) VALUES ('Wines', 4) RETURNING id
    `);
    const winesId = wines.rows[0]!.id;

    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${winesId}, 'Cabernet Sauvignon', 'Full-bodied red, Napa Valley', 22.00, 'bar')`);
    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${winesId}, 'Sauvignon Blanc', 'Crisp white, Marlborough', 18.00, 'bar')`);
    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${winesId}, 'Prosecco', 'Italian sparkling wine', 16.00, 'bar')`);

    // Drinks
    const drinks = await tenantDb.execute(sql`
      INSERT INTO menu_categories (name, sort_order) VALUES ('Drinks', 5) RETURNING id
    `);
    const drinksId = drinks.rows[0]!.id;

    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${drinksId}, 'Espresso', 'Double shot', 3.50, 'bar')`);
    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${drinksId}, 'Fresh Orange Juice', 'Freshly squeezed', 5.00, 'bar')`);
    await tenantDb.execute(sql`INSERT INTO menu_items (category_id, name, description, price, destination) VALUES (${drinksId}, 'Sparkling Water', '750ml bottle', 4.00, 'bar')`);

    console.log('  ✓ 5 menu categories + 15 menu items created');
  } else {
    console.log('  ✓ Menu already exists');
  }

  console.log('\nSeed complete! You can now log in with:');
  console.log('  Waiter:     testrestaurant/001  password: waiter123');
  console.log('  Admin:      testrestaurant/admin  password: admin123');
  console.log('  Superadmin: admin@restmentor.com  password: admin123');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
