// packages/api/src/services/ai.service.ts
import 'dotenv/config';
import OpenAI from 'openai';

let _openaiClient: OpenAI | null = null;
function getOpenAIClient() {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openaiClient;
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
  target: 'male' | 'female' | 'kid';
  reasons: string[];
}

export interface SuggestionRequest {
  genderTarget: 'male' | 'female' | 'kid';
  lastAddedItemName: string;
  currentGroupItems: OrderedItem[];
}

// ── Agent context cache (keyed by sessionId) ──────────────────
interface AgentContext {
  systemPrompt: string;
  shortToRealId: Map<string, string>;
  realToShortId: Map<string, string>;
  shortIdToName: Map<string, string>;
  shortIdToPrice: Map<string, string>;
  shortIdToCategory: Map<string, string>;
  realIdToCategory: Map<string, string>;
}
const sessionAgentCache = new Map<string, AgentContext>();

// ── Build system prompt with short IDs ───────────────────────
function buildSystemPrompt(
  menu: MenuItem[],
  shortToReal: Map<string, string>,
  guestMales: number,
  guestFemales: number,
  guestKids: number
): string {
  // Group menu by category using short IDs
  const menuByCategory: Record<string, { shortId: string; name: string; price: string }[]> = {};

  for (const [shortId, realId] of shortToReal) {
    const item = menu.find(m => m.id === realId);
    if (!item) continue;
    if (!menuByCategory[item.category]) menuByCategory[item.category] = [];
    menuByCategory[item.category].push({ shortId, name: item.name, price: item.price });
  }

  const menuText = Object.entries(menuByCategory)
    .map(([category, items]) => {
      const itemList = items.map(i => `[${i.shortId}]${i.name}€${i.price}`).join(' | ');
      return `[${category.toUpperCase()}] ${itemList}`;
    })
    .join('\n');

  return `You are an expert restaurant server and sommelier with 20 years of experience.
Table: ${guestMales} male(s), ${guestFemales} female(s), ${guestKids} kid(s)

MENU (use short IDs exactly as shown):
${menuText}

YOUR TASK:
Suggest EXACTLY 2 menu items that pair well with the trigger item (the last item added by the group).
The trigger item is the primary pairing anchor — your suggestions must complement it specifically.
Also consider the other items already ordered by the group for overall meal balance.

STRICT RULES — every rule is mandatory:
1. ONLY suggest items from the MENU above using their exact short IDs — never invent items
2. NEVER suggest any item listed under ALREADY ORDERED — this is non-negotiable and the most critical rule
3. NEVER suggest an item from the same category as the trigger item — e.g. if trigger is a Main, do NOT suggest another Main
4. Suggestions must complement the trigger item through flavour pairing, balance, or meal progression
5. Suggestions must target the requested gender group only:
   - male: bold flavours, full-bodied red wines, hearty sides, sauces that enhance meat/fish
   - female: lighter options, crisp white wines or rosé, fresh salads, refined desserts — avoid heavy grilled meats
   - kid: ONLY juice, water, lemonade, ice cream, or kid-friendly desserts — NEVER suggest alcohol, coffee, espresso, cocktails, or spicy dishes under any circumstances
6. Reasoning must be specific — reference the trigger item by name and explain exactly why this pairing works
7. Return ONLY valid JSON, no markdown, no explanation outside the JSON

RESPONSE FORMAT:
{"suggestions":[{"itemId":"shortId","itemName":"Name","price":"0.00","target":"male|female|kid","reasons":["pairs with [trigger item] because...","balances the meal by..."]}]}`;
}

// ── Init agent context for a session ─────────────────────────
export function initSessionAgent(
  sessionId: string,
  menu: MenuItem[],
  guestMales: number,
  guestFemales: number,
  guestKids: number
): void {
  // Build short ID maps — avoids sending 36-char UUIDs to OpenAI
  const shortToReal = new Map<string, string>();
  const realToShort = new Map<string, string>();
  const shortIdToName = new Map<string, string>();
  const shortIdToPrice = new Map<string, string>();

  menu.forEach((item, index) => {
    const shortId = `m${String(index + 1).padStart(2, '0')}`;
    shortToReal.set(shortId, item.id);
    realToShort.set(item.id, shortId);
    shortIdToName.set(shortId, item.name);
    shortIdToPrice.set(shortId, item.price);
  });

  const systemPrompt = buildSystemPrompt(menu, shortToReal, guestMales, guestFemales, guestKids);

  const shortIdToCategory = new Map<string, string>();
  const realIdToCategory = new Map<string, string>();
  menu.forEach((item, index) => {
    const shortId = `m${String(index + 1).padStart(2, '0')}`;
    shortIdToCategory.set(shortId, item.category);
    realIdToCategory.set(item.id, item.category);
  });

  sessionAgentCache.set(sessionId, {
    systemPrompt,
    shortToRealId: shortToReal,
    realToShortId: realToShort,
    shortIdToName,
    shortIdToPrice,
    shortIdToCategory,
    realIdToCategory,
  });
}

export async function getAISuggestions(
  sessionId: string,
  request: SuggestionRequest
): Promise<AISuggestion[]> {
  try {
    const context = sessionAgentCache.get(sessionId);
    if (!context) {
      console.warn(`No agent context for session ${sessionId} — skipping`);
      return [];
    }

    const { genderTarget, lastAddedItemName, currentGroupItems } = request;

    // Find trigger item's category to exclude same-category suggestions
    const triggerShortId = [...context.shortIdToName.entries()]
      .find(([, name]) => name === lastAddedItemName)?.[0];
    const triggerCategory = triggerShortId
      ? context.shortIdToCategory.get(triggerShortId)
      : null;

    // Build already-ordered exclusion list
    const orderedShortIds = new Set(
      currentGroupItems.map(i => context.realToShortId.get(i.menuItemId)).filter(Boolean)
    );
    const orderedNames = currentGroupItems.map(i => i.name).join(', ');
    const excludedStr = orderedShortIds.size > 0
      ? `ALREADY ORDERED - DO NOT SUGGEST: ${[...orderedShortIds].join(',')}\n`
      : '';
    const categoryStr = triggerCategory
      ? `DO NOT SUGGEST FROM CATEGORY "${triggerCategory}" — trigger item is already from this category.\n`
      : '';

    const userMessage = `${genderTarget} group orders: ${orderedNames || 'none'}
Trigger item just added: ${lastAddedItemName}${triggerCategory ? ` (category: ${triggerCategory})` : ''}
${excludedStr}${categoryStr}Suggest 2 complementary items for ${genderTarget}.`;

    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: context.systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const rawSuggestions: any[] = parsed.suggestions ?? [];

    // Map short IDs back to real UUIDs + enforce rules in code
    const orderedRealIds = new Set(currentGroupItems.map(i => i.menuItemId));

    const suggestions: AISuggestion[] = rawSuggestions
      .map(s => {
        const realId = context.shortToRealId.get(s.itemId);
        if (!realId) return null;

        // Code-level: never suggest already ordered items
        if (orderedRealIds.has(realId)) return null;

        // Code-level: never suggest from same category as trigger
        const suggestionCategory = context.shortIdToCategory.get(s.itemId);
        if (triggerCategory && suggestionCategory === triggerCategory) return null;

        return {
          itemId: realId,
          itemName: context.shortIdToName.get(s.itemId) ?? s.itemName,
          price: context.shortIdToPrice.get(s.itemId) ?? s.price,
          target: s.target,
          reasons: s.reasons ?? [],
        };
      })
      .filter((s): s is AISuggestion => s !== null);

    return suggestions;

  } catch (err) {
    console.error('AI suggestion error:', err);
    return [];
  }
}
