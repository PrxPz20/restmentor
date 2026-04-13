// packages/db/src/seed-menu.ts
// Adds a professional 50-item menu to the test restaurant
// Safe to run multiple times — skips if categories already exist

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function seedMenu() {
  const tenantUrl = process.env.TENANT_TEST_DATABASE_URL;
  if (!tenantUrl) {
    console.error('TENANT_TEST_DATABASE_URL must be set');
    process.exit(1);
  }

  const tenantClient = neon(tenantUrl);
  const db = drizzle(tenantClient);

  console.log('Expanding menu to ~50 professional items...\n');

  // ── Helper ───────────────────────────────────────────────────
  const upsertCategory = async (name: string, sortOrder: number): Promise<string> => {
    const existing = await db.execute(
      sql`SELECT id FROM menu_categories WHERE name = ${name} LIMIT 1`
    );
    if (existing.rows.length > 0) {
      console.log(`  → Category "${name}" already exists`);
      return existing.rows[0]!.id as string;
    }
    const result = await db.execute(
      sql`INSERT INTO menu_categories (name, sort_order) VALUES (${name}, ${sortOrder}) RETURNING id`
    );
    console.log(`  ✓ Category "${name}" created`);
    return result.rows[0]!.id as string;
  };

  const addItem = async (
    categoryId: string,
    name: string,
    description: string,
    price: number,
    destination: 'kitchen' | 'bar'
  ) => {
    const existing = await db.execute(
      sql`SELECT id FROM menu_items WHERE name = ${name} AND category_id = ${categoryId} LIMIT 1`
    );
    if (existing.rows.length > 0) return; // skip if exists
    await db.execute(
      sql`INSERT INTO menu_items (category_id, name, description, price, destination, is_active)
          VALUES (${categoryId}, ${name}, ${description}, ${price}, ${destination}, true)`
    );
  };

  // ── 1. STARTERS (update existing + add new) ──────────────────
  const startersId = await upsertCategory('Starters', 1);
  await addItem(startersId, 'Bruschetta', 'Toasted bread with tomato and basil', 9.00, 'kitchen');
  await addItem(startersId, 'Caesar Salad', 'Fresh romaine, parmesan, croutons', 12.50, 'kitchen');
  await addItem(startersId, 'Soup of the Day', 'Ask your waiter for today\'s selection', 8.50, 'kitchen');
  await addItem(startersId, 'Beef Carpaccio', 'Thinly sliced beef, capers, lemon dressing', 16.00, 'kitchen');
  await addItem(startersId, 'Burrata', 'Fresh burrata with heirloom tomatoes and basil oil', 14.50, 'kitchen');
  await addItem(startersId, 'Tuna Tartare', 'Fresh tuna, avocado, sesame, soy dressing', 18.00, 'kitchen');
  await addItem(startersId, 'Prawn Cocktail', 'Tiger prawns, Marie Rose sauce, iceberg lettuce', 15.00, 'kitchen');
  await addItem(startersId, 'French Onion Soup', 'Slow-cooked onion broth, gruyère crouton', 11.00, 'kitchen');
  console.log('  ✓ Starters done');

  // ── 2. MAINS ─────────────────────────────────────────────────
  const mainsId = await upsertCategory('Mains', 2);
  await addItem(mainsId, 'Grilled Ribeye Steak', '300g ribeye with roasted vegetables', 32.00, 'kitchen');
  await addItem(mainsId, 'Pan-Seared Sea Bass', 'With lemon butter sauce and asparagus', 28.00, 'kitchen');
  await addItem(mainsId, 'Mushroom Risotto', 'Arborio rice with wild mushrooms and truffle oil', 22.00, 'kitchen');
  await addItem(mainsId, 'Grilled Chicken Breast', 'With mashed potatoes and gravy', 20.00, 'kitchen');
  await addItem(mainsId, 'Lamb Rack', 'Herb-crusted rack of lamb, mint jus, dauphinoise potatoes', 38.00, 'kitchen');
  await addItem(mainsId, 'Duck Confit', 'Slow-cooked duck leg, cherry reduction, braised lentils', 34.00, 'kitchen');
  await addItem(mainsId, 'Lobster Linguine', 'Fresh lobster, cherry tomatoes, white wine, chilli', 42.00, 'kitchen');
  await addItem(mainsId, 'Vegetable Wellington', 'Roasted vegetables in puff pastry, red wine jus', 24.00, 'kitchen');
  await addItem(mainsId, 'Pork Tenderloin', 'Apple cider glaze, roasted root vegetables', 26.00, 'kitchen');
  console.log('  ✓ Mains done');

  // ── 3. PLATTERS ──────────────────────────────────────────────
  const plattersId = await upsertCategory('Platters', 3);
  await addItem(plattersId, 'Seafood Platter', 'Oysters, prawns, crab claws, lobster tail (for 2)', 85.00, 'kitchen');
  await addItem(plattersId, 'Charcuterie Board', 'Selection of cured meats, pickles, mustard, bread', 28.00, 'kitchen');
  await addItem(plattersId, 'Cheese Board', 'Aged cheddar, brie, gorgonzola, grapes, crackers', 22.00, 'kitchen');
  await addItem(plattersId, 'Mixed Grill Platter', 'Ribeye, lamb chop, chicken, sausage (for 2)', 68.00, 'kitchen');
  await addItem(plattersId, 'Antipasti Platter', 'Olives, roasted peppers, artichokes, prosciutto', 24.00, 'kitchen');
  console.log('  ✓ Platters done');

  // ── 4. SIDES ─────────────────────────────────────────────────
  const sidesId = await upsertCategory('Sides', 4);
  await addItem(sidesId, 'Truffle Fries', 'Crispy fries, truffle oil, parmesan', 8.00, 'kitchen');
  await addItem(sidesId, 'Seasonal Vegetables', 'Grilled seasonal vegetables, herb butter', 7.00, 'kitchen');
  await addItem(sidesId, 'Creamed Spinach', 'Wilted spinach, cream, garlic, nutmeg', 7.50, 'kitchen');
  await addItem(sidesId, 'Dauphinoise Potatoes', 'Slow-baked potato gratin with cream and garlic', 8.50, 'kitchen');
  await addItem(sidesId, 'Onion Rings', 'Beer-battered onion rings, chipotle dip', 7.00, 'kitchen');
  await addItem(sidesId, 'Steamed Jasmine Rice', 'Fragrant jasmine rice', 4.50, 'kitchen');
  console.log('  ✓ Sides done');

  // ── 5. SAUCES ────────────────────────────────────────────────
  const saucesId = await upsertCategory('Sauces', 5);
  await addItem(saucesId, 'Béarnaise Sauce', 'Classic French tarragon butter sauce', 4.00, 'kitchen');
  await addItem(saucesId, 'Peppercorn Sauce', 'Creamy green peppercorn sauce', 4.00, 'kitchen');
  await addItem(saucesId, 'Red Wine Jus', 'Rich slow-reduced red wine sauce', 4.00, 'kitchen');
  await addItem(saucesId, 'Garlic Butter', 'Herb and garlic compound butter', 3.00, 'kitchen');
  await addItem(saucesId, 'Chimichurri', 'Fresh Argentinian herb sauce', 3.50, 'kitchen');
  console.log('  ✓ Sauces done');

  // ── 6. DESSERTS ──────────────────────────────────────────────
  const dessertsId = await upsertCategory('Desserts', 6);
  await addItem(dessertsId, 'Tiramisu', 'Classic Italian coffee dessert', 10.00, 'kitchen');
  await addItem(dessertsId, 'Chocolate Lava Cake', 'Warm chocolate cake with vanilla ice cream', 12.00, 'kitchen');
  await addItem(dessertsId, 'Crème Brûlée', 'Classic vanilla custard, caramelised sugar crust', 10.00, 'kitchen');
  await addItem(dessertsId, 'Cheesecake', 'New York style with berry compote', 11.00, 'kitchen');
  await addItem(dessertsId, 'Panna Cotta', 'Vanilla panna cotta with passion fruit coulis', 9.00, 'kitchen');
  await addItem(dessertsId, 'Gelato Selection', 'Three scoops of seasonal gelato', 8.00, 'kitchen');
  console.log('  ✓ Desserts done');

  // ── 7. WINES ─────────────────────────────────────────────────
  const winesId = await upsertCategory('Wines', 7);
  await addItem(winesId, 'Cabernet Sauvignon', 'Full-bodied red, Napa Valley', 22.00, 'bar');
  await addItem(winesId, 'Sauvignon Blanc', 'Crisp white, Marlborough', 18.00, 'bar');
  await addItem(winesId, 'Prosecco', 'Italian sparkling wine', 16.00, 'bar');
  await addItem(winesId, 'Pinot Noir', 'Elegant red, Burgundy', 24.00, 'bar');
  await addItem(winesId, 'Chardonnay', 'Buttery white, oaked, Burgundy', 20.00, 'bar');
  await addItem(winesId, 'Malbec', 'Rich red, Mendoza Argentina', 19.00, 'bar');
  await addItem(winesId, 'Rosé', 'Dry Provence rosé', 17.00, 'bar');
  await addItem(winesId, 'Champagne', 'Moët & Chandon Brut NV, glass', 28.00, 'bar');
  console.log('  ✓ Wines done');

  // ── 8. COCKTAILS & SPIRITS ───────────────────────────────────
  const cocktailsId = await upsertCategory('Cocktails', 8);
  await addItem(cocktailsId, 'Negroni', 'Gin, Campari, sweet vermouth', 14.00, 'bar');
  await addItem(cocktailsId, 'Old Fashioned', 'Bourbon, bitters, orange peel', 15.00, 'bar');
  await addItem(cocktailsId, 'Aperol Spritz', 'Aperol, Prosecco, soda', 12.00, 'bar');
  await addItem(cocktailsId, 'Espresso Martini', 'Vodka, espresso, Kahlúa', 14.00, 'bar');
  await addItem(cocktailsId, 'Mojito', 'White rum, lime, mint, soda', 13.00, 'bar');
  console.log('  ✓ Cocktails done');

  // ── 9. DRINKS ────────────────────────────────────────────────
  const drinksId = await upsertCategory('Drinks', 9);
  await addItem(drinksId, 'Espresso', 'Double shot', 3.50, 'bar');
  await addItem(drinksId, 'Fresh Orange Juice', 'Freshly squeezed', 5.00, 'bar');
  await addItem(drinksId, 'Sparkling Water', '750ml bottle', 4.00, 'bar');
  await addItem(drinksId, 'Still Water', '750ml bottle', 3.50, 'bar');
  await addItem(drinksId, 'Lemonade', 'Homemade with fresh lemon and mint', 5.50, 'bar');
  await addItem(drinksId, 'Craft Beer', 'Local IPA draught, 500ml', 7.00, 'bar');
  await addItem(drinksId, 'Cappuccino', 'Espresso with steamed milk foam', 4.00, 'bar');
  console.log('  ✓ Drinks done');

  // ── Summary ──────────────────────────────────────────────────
  const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM menu_items`);
  const total = countResult.rows[0]!.count;
  console.log(`\n✅ Menu expansion complete! Total menu items: ${total}`);
}

seedMenu().catch((err) => {
  console.error('Menu seed failed:', err);
  process.exit(1);
});
