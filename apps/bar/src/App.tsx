import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// ── Types ────────────────────────────────────────────────────
type ItemStatus = 'normal' | 'removed' | 'updated';

interface DisplayItem {
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
  destination: 'kitchen' | 'bar';
  genderTarget: string;
  status: ItemStatus;
  previousQuantity?: number;
}

interface DisplayOrder {
  uid: string;
  tableLabel: string;
  roundNumber: number;
  items: DisplayItem[];
  receivedAt: Date;
  isNew: boolean;
  isModified: boolean;
}

interface IncomingItem {
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
  destination: 'kitchen' | 'bar';
  genderTarget: string;
}

interface IncomingOrder {
  tableId: string;
  tableLabel: string;
  roundNumber: number;
  items: IncomingItem[];
}

interface ModificationEntry {
  itemName: string;
  newQuantity: number;
  action: 'removed' | 'quantity_updated';
  roundNumber: number;
}

interface OrderModification {
  tableLabel: string;
  roundNumber: number;
  destination: 'kitchen' | 'bar';
  items: ModificationEntry[];
}

// ── Constants ────────────────────────────────────────────────
const DESTINATION = 'bar' as const;
const API_URL = 'http://localhost:3001';
const STORAGE_KEY = 'rm_bar_restaurantId';
const ORDERS_STORAGE_KEY = 'rm_bar_orders';
const MAX_ORDERS = 30;
const NEW_HIGHLIGHT_MS = 6000;
const MOD_HIGHLIGHT_MS = 60000;

// ── Helpers ──────────────────────────────────────────────────
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeCardKey(tableLabel: string, roundNumber: number): string {
  return `${tableLabel}::${roundNumber}`;
}

function serializeOrders(orders: Map<string, DisplayOrder>): string {
  return JSON.stringify(Array.from(orders.entries()).map(([k, v]) => [k, {
    ...v,
    receivedAt: v.receivedAt.toISOString(),
  }]));
}

function deserializeOrders(raw: string): Map<string, DisplayOrder> {
  try {
    const entries = JSON.parse(raw) as [string, any][];
    return new Map(entries.map(([k, v]) => [k, {
      ...v,
      receivedAt: new Date(v.receivedAt),
      isNew: false,
      isModified: false,
      items: v.items.map((i: any) => ({ ...i, status: 'normal' as ItemStatus })),
    }]));
  } catch { return new Map(); }
}

// ── Setup Screen ─────────────────────────────────────────────
function SetupScreen({ onConnect }: { onConnect: (id: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) { setError('Please enter a Restaurant ID'); return; }
    onConnect(trimmed);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--color-bg)' }}>
      <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: '40px 32px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ marginBottom: '32px' }}>
          <span style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font)' }}>Rest</span>
          <span style={{ fontSize: '28px', fontWeight: 300, fontFamily: 'var(--font)' }}>Mentor</span>
          <sup style={{ fontSize: '11px', fontWeight: 400, marginLeft: '2px' }}>©</sup>
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', fontFamily: 'var(--font)' }}>Bar Display Setup</h1>
        <p style={{ fontSize: '14px', fontWeight: 300, opacity: 0.6, marginBottom: '28px', lineHeight: 1.5, fontFamily: 'var(--font)' }}>
          Enter your Restaurant ID to start receiving orders in real time.
        </p>
        <input
          type="text"
          placeholder="Restaurant ID"
          value={value}
          onChange={e => { setValue(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={{ width: '100%', padding: '14px 16px', borderRadius: 'var(--radius-input)', border: error ? '1.5px solid var(--color-removed-text)' : '1.5px solid #e0e0e0', fontSize: '15px', fontFamily: 'var(--font)', fontWeight: 400, color: 'var(--color-primary)', outline: 'none', marginBottom: error ? '8px' : '20px', background: 'var(--color-bg)' }}
        />
        {error && <p style={{ fontSize: '13px', color: 'var(--color-removed-text)', marginBottom: '16px', textAlign: 'left', fontFamily: 'var(--font)' }}>{error}</p>}
        <button
          onClick={handleSubmit}
          style={{ width: '100%', padding: '14px', background: 'var(--color-primary)', color: 'var(--color-white)', border: 'none', borderRadius: 'var(--radius-input)', fontSize: '15px', fontFamily: 'var(--font)', fontWeight: 600, cursor: 'pointer', marginBottom: '20px' }}
        >
          Connect
        </button>
        <p style={{ fontSize: '12px', fontWeight: 300, opacity: 0.5, lineHeight: 1.5, fontFamily: 'var(--font)' }}>Ask your restaurant admin for the Restaurant ID.</p>
      </div>
    </div>
  );
}

// ── Order Card ───────────────────────────────────────────────
function OrderCard({ order }: { order: DisplayOrder }) {
  const borderColor = order.isModified
    ? 'var(--color-modified-border)'
    : order.isNew
      ? 'var(--color-green-border)'
      : 'transparent';

  const animation = order.isModified
    ? 'slideIn 0.3s ease, modifiedPulse 6s ease forwards'
    : order.isNew
      ? 'slideIn 0.3s ease, glowFade 6s ease forwards'
      : 'none';

  return (
    <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', animation, border: `2px solid ${borderColor}`, transition: 'border-color 1s ease' }}>
      {/* Card Header */}
      <div style={{ background: 'var(--color-primary)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--color-white)', fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font)' }}>
          {order.tableLabel}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: 'var(--color-green)', color: 'var(--color-primary)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font)', padding: '3px 10px', borderRadius: '100px' }}>
            Round {order.roundNumber}
          </span>
          {order.isNew && !order.isModified && (
            <span style={{ background: 'var(--color-green-border)', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font)', padding: '3px 10px', borderRadius: '100px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              New
            </span>
          )}
          {order.isModified && (
            <span style={{ background: 'var(--color-modified-border)', color: 'var(--color-white)', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font)', padding: '3px 10px', borderRadius: '100px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Modified
            </span>
          )}
        </div>
      </div>

      {/* Items List */}
      <div style={{ padding: '16px 18px' }}>
        {order.items.map((item, idx) => {
          const isRemoved = item.status === 'removed';
          const isUpdated = item.status === 'updated';

          return (
            <div key={idx} style={{
              borderBottom: idx < order.items.length - 1 ? '1px solid rgba(3,40,19,0.07)' : 'none',
              borderRadius: '8px',
              paddingTop: isRemoved || isUpdated ? '8px' : '0',
              paddingBottom: isRemoved || isUpdated ? '8px' : idx < order.items.length - 1 ? '12px' : '0',
              paddingLeft: isRemoved || isUpdated ? '10px' : '0',
              paddingRight: isRemoved || isUpdated ? '10px' : '0',
              marginTop: '0',
              marginBottom: idx < order.items.length - 1 ? '12px' : '0',
              marginLeft: isRemoved || isUpdated ? '-10px' : '0',
              marginRight: isRemoved || isUpdated ? '-10px' : '0',
              background: isRemoved
                ? 'var(--color-removed-bg)'
                : isUpdated
                  ? 'var(--color-updated-bg)'
                  : 'transparent',
              transition: 'background 0.5s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                {isRemoved && <span style={{ fontSize: '13px', flexShrink: 0, marginTop: '2px' }}>❌</span>}
                {isUpdated && <span style={{ fontSize: '13px', flexShrink: 0, marginTop: '2px' }}>✎</span>}
                {item.quantity > 1 && !isRemoved && (
                  <span style={{ fontSize: '16px', fontWeight: 300, fontFamily: 'var(--font)', opacity: 0.5, flexShrink: 0, color: isUpdated ? 'var(--color-updated-text)' : 'var(--color-primary)' }}>
                    ×{item.quantity}
                  </span>
                )}
                <span style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font)', lineHeight: 1.3, textDecoration: isRemoved ? 'line-through' : 'none', color: isRemoved ? 'var(--color-removed-text)' : isUpdated ? 'var(--color-updated-text)' : 'var(--color-primary)' }}>
                  {item.name}
                </span>
              </div>

              {isUpdated && item.previousQuantity !== undefined && (
                <p style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font)', color: 'var(--color-updated-text)', marginTop: '3px', marginLeft: '20px' }}>
                  qty: {item.previousQuantity} → {item.quantity}
                </p>
              )}

              {item.notes && !isRemoved && (
                <p style={{ fontSize: '13px', fontWeight: 300, fontFamily: 'var(--font)', opacity: 0.6, marginTop: '4px', fontStyle: 'italic' }}>
                  Note: {item.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Card Footer */}
      <div style={{ padding: '10px 18px', background: 'rgba(3,40,19,0.03)', borderTop: '1px solid rgba(3,40,19,0.06)' }}>
        <span style={{ fontSize: '12px', fontWeight: 300, fontFamily: 'var(--font)', opacity: 0.5 }}>
          Received at {formatTime(order.receivedAt)}
        </span>
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', opacity: 0.4 }}>
      <div style={{ fontSize: '56px', marginBottom: '16px' }}>🍹</div>
      <p style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font)', marginBottom: '8px' }}>No pending orders</p>
      <p style={{ fontSize: '14px', fontWeight: 300, fontFamily: 'var(--font)' }}>Orders will appear here in real time</p>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────
export default function BarDisplay() {
  const [restaurantId, setRestaurantId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) || ''
  );
  const [connected, setConnected] = useState(false);

  const [orderMap, setOrderMap] = useState<Map<string, DisplayOrder>>(() => {
    const saved = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!saved) return new Map();
    return deserializeOrders(saved);
  });

  const socketRef = useRef<Socket | null>(null);
  const modTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, serializeOrders(orderMap));
    } catch { /* storage full */ }
  }, [orderMap]);

  useEffect(() => {
    if (!restaurantId) return;

    const socket = io(API_URL, {
      query: { restaurantId },
      transports: ['websocket'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('order:new', (data: IncomingOrder) => {
      const relevantItems = data.items.filter(i => i.destination === DESTINATION);
      if (relevantItems.length === 0) return;

      const key = makeCardKey(data.tableLabel, data.roundNumber);
      const newOrder: DisplayOrder = {
        uid: `${data.tableId}-${data.roundNumber}-${Date.now()}`,
        tableLabel: data.tableLabel,
        roundNumber: data.roundNumber,
        items: relevantItems.map(i => ({ ...i, status: 'normal' })),
        receivedAt: new Date(),
        isNew: true,
        isModified: false,
      };

      setOrderMap(prev => {
        const next = new Map(prev);
        next.set(key, newOrder);
        if (next.size > MAX_ORDERS) {
          const oldestKey = Array.from(next.keys())[0]!;
          next.delete(oldestKey);
        }
        return next;
      });

      setTimeout(() => {
        setOrderMap(prev => {
          const next = new Map(prev);
          const card = next.get(key);
          if (card) next.set(key, { ...card, isNew: false });
          return next;
        });
      }, NEW_HIGHLIGHT_MS);
    });

    socket.on('order:modified', (data: OrderModification) => {
      if (data.destination !== DESTINATION) return;

      const key = makeCardKey(data.tableLabel, data.roundNumber);

      setOrderMap(prev => {
        const next = new Map(prev);
        const card = next.get(key);
        if (!card) return prev;

        const updatedItems = card.items.map(item => {
          const mod = data.items.find(m => m.itemName === item.name);
          if (!mod) return { ...item, status: 'normal' as ItemStatus };

          if (mod.action === 'removed') {
            return { ...item, status: 'removed' as ItemStatus };
          } else {
            return {
              ...item,
              status: 'updated' as ItemStatus,
              previousQuantity: item.quantity,
              quantity: mod.newQuantity,
            };
          }
        });

        next.set(key, { ...card, items: updatedItems, isModified: true, isNew: false });
        return next;
      });

      const existingTimer = modTimersRef.current.get(key);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        setOrderMap(prev => {
          const next = new Map(prev);
          const card = next.get(key);
          if (!card) return prev;

          const cleanedItems = card.items
            .filter(i => i.status !== 'removed')
            .map(i => ({ ...i, status: 'normal' as ItemStatus, previousQuantity: undefined }));

          if (cleanedItems.length === 0) {
            next.delete(key);
          } else {
            next.set(key, { ...card, items: cleanedItems, isModified: false });
          }
          return next;
        });
        modTimersRef.current.delete(key);
      }, MOD_HIGHLIGHT_MS);

      modTimersRef.current.set(key, timer);
    });

    return () => { socket.disconnect(); };
  }, [restaurantId]);

  function handleReset() {
    socketRef.current?.disconnect();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ORDERS_STORAGE_KEY);
    setRestaurantId('');
    setConnected(false);
    setOrderMap(new Map());
  }

  if (!restaurantId) {
    return (
      <SetupScreen onConnect={(id) => {
        localStorage.setItem(STORAGE_KEY, id);
        setRestaurantId(id);
      }} />
    );
  }

  const orders = Array.from(orderMap.values()).reverse();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      <header style={{ background: 'var(--color-white)', boxShadow: 'var(--shadow-card)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font)' }}>Rest</span>
            <span style={{ fontSize: '20px', fontWeight: 300, fontFamily: 'var(--font)' }}>Mentor</span>
            <sup style={{ fontSize: '10px', marginLeft: '2px' }}>©</sup>
          </div>
          <div style={{ background: 'var(--color-bg)', padding: '4px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font)', color: 'var(--color-primary)' }}>
            🍹 Bar Display
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444', boxShadow: connected ? '0 0 0 2px rgba(34,197,94,0.3)' : '0 0 0 2px rgba(239,68,68,0.3)' }} />
            <span style={{ fontSize: '12px', fontWeight: 400, fontFamily: 'var(--font)', opacity: 0.6 }}>
              {connected ? 'Live' : 'Reconnecting...'}
            </span>
          </div>

          {orders.length > 0 && (
            <div style={{ background: 'var(--color-primary)', color: 'var(--color-white)', borderRadius: '100px', padding: '3px 12px', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font)' }}>
              {orders.length} {orders.length === 1 ? 'order' : 'orders'}
            </div>
          )}

          <button
            onClick={handleReset}
            style={{ background: 'transparent', border: '1.5px solid rgba(3,40,19,0.15)', borderRadius: 'var(--radius-input)', padding: '6px 14px', fontSize: '12px', fontFamily: 'var(--font)', fontWeight: 500, color: 'var(--color-primary)', cursor: 'pointer', opacity: 0.6 }}
          >
            ⚙ Setup
          </button>
        </div>
      </header>

      {orders.length === 0 ? (
        <EmptyState />
      ) : (
        <main style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', alignItems: 'start' }}>
          {orders.map(order => (
            <OrderCard key={order.uid} order={order} />
          ))}
        </main>
      )}
    </div>
  );
}
