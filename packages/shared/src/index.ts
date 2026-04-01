// packages/shared/src/index.ts
// ── Table Status ────────────────────────────────────────
export const TABLE_STATUSES = ['open', 'occupied', 'paid', 'cleaning'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

// ── User Roles ──────────────────────────────────────────
export const USER_ROLES = ['waiter', 'admin', 'manager'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PLATFORM_ROLES = ['superadmin'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

// ── Order Status ────────────────────────────────────────
export const ORDER_STATUSES = ['draft', 'sent', 'modified'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// ── Gender Target ───────────────────────────────────────
export const GENDER_TARGETS = ['male', 'female', 'kid', 'shared'] as const;
export type GenderTarget = (typeof GENDER_TARGETS)[number];

// ── Menu Item Destination ───────────────────────────────
export const ITEM_DESTINATIONS = ['kitchen', 'bar'] as const;
export type ItemDestination = (typeof ITEM_DESTINATIONS)[number];

// ── Restaurant Status ───────────────────────────────────
export const RESTAURANT_STATUSES = ['active', 'suspended'] as const;
export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];

// ── Commission Status ───────────────────────────────────
export const COMMISSION_STATUSES = ['pending', 'confirmed'] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

// ── Auth Types ──────────────────────────────────────────
export interface LoginRequest {
  accountNumber: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    role: UserRole;
    waiterNumber: string;
  };
  restaurant: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// ── JWT Payload ─────────────────────────────────────────
export interface JwtPayload {
  userId: string;
  restaurantId: string;
  restaurantSlug: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// ── Table Types ─────────────────────────────────────────
export interface TableInfo {
  id: string;
  label: string;
  status: TableStatus;
  currentSessionId: string | null;
}

export interface TableSessionConfig {
  guestMales: number;
  guestFemales: number;
  guestKids: number;
}

export interface TableSession {
  id: string;
  tableId: string;
  waiterId: string;
  guestMales: number;
  guestFemales: number;
  guestKids: number;
  openedAt: string;
  paidAt: string | null;
  closedAt: string | null;
}

// ── Menu Types ──────────────────────────────────────────
export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  destination: ItemDestination;
  isActive: boolean;
}

export interface MenuWithCategories {
  categories: (MenuCategory & { items: MenuItem[] })[];
}

// ── Order Types ─────────────────────────────────────────
export interface Order {
  id: string;
  sessionId: string;
  roundNumber: number;
  status: OrderStatus;
  createdAt: string;
  sentAt: string | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number;
  genderTarget: GenderTarget;
  quantity: number;
  aiSuggested: boolean;
  aiSuggestionId: string | null;
  notes: string | null;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

// ── AI Suggestion Types ─────────────────────────────────
export interface AISuggestion {
  id: string;
  sessionId: string;
  suggestedItems: AISuggestedItem[];
  createdAt: string;
}

export interface AISuggestedItem {
  itemId: string;
  itemName: string;
  itemPrice: number;
  target: GenderTarget;
  reasons: string[];
}

// ── Commission Types ────────────────────────────────────
export interface Commission {
  id: string;
  sessionId: string;
  orderItemId: string;
  itemPrice: number;
  commissionRate: number;
  commissionAmount: number;
  status: CommissionStatus;
  confirmedAt: string | null;
}

// ── WebSocket Events ────────────────────────────────────
export interface WSOrderNew {
  event: 'order:new';
  data: {
    tableLabel: string;
    roundNumber: number;
    items: {
      name: string;
      quantity: number;
      notes: string | null;
      destination: ItemDestination;
    }[];
  };
}

export interface WSOrderModified {
  event: 'order:modified';
  data: {
    tableLabel: string;
    roundNumber: number;
    modifiedItems: {
      name: string;
      quantity: number;
      notes: string | null;
      action: 'modified' | 'cancelled';
    }[];
  };
}

export interface WSTableStatusChanged {
  event: 'table:status_changed';
  data: {
    tableId: string;
    newStatus: TableStatus;
  };
}

export interface WSSuggestionReady {
  event: 'suggestion:ready';
  data: {
    sessionId: string;
    suggestions: AISuggestedItem[];
  };
}

// ── API Error ───────────────────────────────────────────
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

// ── Design System Constants ─────────────────────────────
export const COLORS = {
  background: '#EEEEEE',
  primaryDark: '#032813',
  white: '#FFFFFF',
  greenOpen: '#D4FCE2',
  occupied: '#FCD8D4',
  paid: '#D4DCFC',
  cleaning: '#F5FCD4',
} as const;

export const TABLE_STATUS_COLORS: Record<TableStatus, string> = {
  open: COLORS.greenOpen,
  occupied: COLORS.occupied,
  paid: COLORS.paid,
  cleaning: COLORS.cleaning,
} as const;
