// packages/api/src/services/ai.service.ts
import 'dotenv/config';
import OpenAI from 'openai';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// ── Types ─────────────────────────────────────────────────────
export interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  category: string;
  destination: string;
}

export interface OrderedItem {
  menuItemId: string;
  name: string;
  quantity: number;
  genderTarget: 'male' | 'female' | 'kid' | 'shared';
}

export interface AISuggestion {
  itemId: string;
  itemName: string;
  price: string;
  target: 'male' | 'female' | 'kid' | 'shared';
  reasons: string[];
}

export interface SuggestionRequest {
  menu: MenuItem[];
  guestMales: number;
  guestFemales: number;
  guestKids: number;
  orderedItems: OrderedItem[];
  lastAddedItem: {
    name: string;
    genderTarget: string;
  };
}

// ── Build system prompt (the persistent agent context) ────────
function buildSystemPrompt(menu: MenuItem[]): string {
  const menuByCategory: Record<string, MenuItem[]> = {};
  for (const item of menu) {
    if (!menuByCategory[item.category]) menuByCategory[item.category] = [];
    menuByCategory[item.category].push(item);
  }

  const menuText = Object.entries(menuByCategory)
    .map(([category, items]) => {
      const itemList = items
        .map(i => `  - [${i.id}] ${i.name} €${i.price}${i.description ? ` (${i.description})` : ''}`)
        .join('\n');
      return `${category}:\n${itemList}`;
    })
    .join('\n\n');

  return `You are an expert restaurant AI assistant and sommelier. Your job is to suggest menu items to waiters in real time as they take orders.

FULL MENU:
${menuText}

RULES:
1. Only suggest items that are on the menu above — never invent items
2. Never suggest items already ordered by that group
3. Suggestions must complement what has been ordered — think about flavour pairing, balance, and flow of the meal
4. Be gender-aware:
   - Males: can handle bold, hearty, rich suggestions
   - Females: prefer lighter, more refined options — avoid heavy BBQ/grill-only suggestions
   - Kids: only suggest kid-friendly items
   - Shared: suggest items the whole table would enjoy together
5. Give 2-3 suggestions maximum per response
6. Each suggestion must have 2-3 short, specific reasoning bullet points that the waiter can use as talking points with the customer
7. Reasoning must reference actual items ordered — be specific, not generic
8. Return ONLY valid JSON — no markdown, no explanation outside the JSON

RESPONSE FORMAT:
{
  "suggestions": [
    {
      "itemId": "uuid-here",
      "itemName": "Item Name",
      "price": "12.50",
      "target": "male|female|kid|shared",
      "reasons": ["reason 1", "reason 2", "reason 3"]
    }
  ]
}`;
}

// ── Build user message (tiny, sent every time) ────────────────
function buildUserMessage(request: SuggestionRequest): string {
  const { guestMales, guestFemales, guestKids, orderedItems, lastAddedItem } = request;

  const maleItems = orderedItems.filter(i => i.genderTarget === 'male');
  const femaleItems = orderedItems.filter(i => i.genderTarget === 'female');
  const kidItems = orderedItems.filter(i => i.genderTarget === 'kid');
  const sharedItems = orderedItems.filter(i => i.genderTarget === 'shared');

  const formatItems = (items: OrderedItem[]) =>
    items.length > 0
      ? items.map(i => `${i.name} x${i.quantity}`).join(', ')
      : 'nothing yet';

  return `Table composition: ${guestMales} male(s), ${guestFemales} female(s), ${guestKids} kid(s)

Just added: ${lastAddedItem.name} for ${lastAddedItem.genderTarget}

Current orders:
- Male segment: ${formatItems(maleItems)}
- Female segment: ${formatItems(femaleItems)}
- Kids segment: ${formatItems(kidItems)}
- Shared: ${formatItems(sharedItems)}

Based on what has been ordered, suggest 2-3 complementary items. Focus on what was just added and the overall order context.`;
}

// ── Main suggestion function ──────────────────────────────────
export async function getAISuggestions(request: SuggestionRequest): Promise<AISuggestion[]> {
  try {
    const systemPrompt = buildSystemPrompt(request.menu);
    const userMessage = buildUserMessage(request);

    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const suggestions: AISuggestion[] = parsed.suggestions ?? [];

    // Validate all suggestions reference real menu items
    const menuIds = new Set(request.menu.map(m => m.id));
    return suggestions.filter(s => menuIds.has(s.itemId));

  } catch (err) {
    console.error('AI suggestion error:', err);
    return [];
  }
}
