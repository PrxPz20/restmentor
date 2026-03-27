// restmentor/apps/kitchen/src/App.tsx
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// ── Types ────────────────────────────────────────────────────
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

interface DisplayOrder {
  uid: string;
  tableLabel: string;
  roundNumber: number;
  items: IncomingItem[];
  receivedAt: Date;
  isNew: boolean;
}

// ── Constants ────────────────────────────────────────────────
const DESTINATION = 'kitchen' as const;
const API_URL = 'http://localhost:3001';
const STORAGE_KEY = 'rm_kitchen_restaurantId';
const MAX_ORDERS = 30;
const NEW_HIGHLIGHT_MS = 6000;

// ── Helpers ──────────────────────────────────────────────────
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--color-bg)',
    }}>
      <div style={{
        background: 'var(--color-white)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        padding: '40px 32px',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
      }}>
        <div style={{ marginBottom: '32px' }}>
          <span style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font)' }}>Rest</span>
          <span style={{ fontSize: '28px', fontWeight: 300, fontFamily: 'var(--font)' }}>Mentor</span>
          <sup style={{ fontSize: '11px', fontWeight: 400, marginLeft: '2px' }}>©</sup>
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', fontFamily: 'var(--font)' }}>
          Kitchen Display Setup
        </h1>
        <p style={{ fontSize: '14px', fontWeight: 300, opacity: 0.6, marginBottom: '28px', lineHeight: 1.5, fontFamily: 'var(--font)' }}>
          Enter your Restaurant ID to start receiving orders in real time.
        </p>

        <input
          type="text"
          placeholder="Restaurant ID"
          value={value}
          onChange={e => { setValue(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 'var(--radius-input)',
            border: error ? '1.5px solid #e53e3e' : '1.5px solid #e0e0e0',
            fontSize: '15px',
            fontFamily: 'var(--font)',
            fontWeight: 400,
            color: 'var(--color-primary)',
            outline: 'none',
            marginBottom: error ? '8px' : '20px',
            background: 'var(--color-bg)',
          }}
        />

        {error && (
          <p style={{ fontSize: '13px', color: '#e53e3e', marginBottom: '16px', textAlign: 'left', fontFamily: 'var(--font)' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '14px',
            background: 'var(--color-primary)',
            color: 'var(--color-white)',
            border: 'none',
            borderRadius: 'var(--radius-input)',
            fontSize: '15px',
            fontFamily: 'var(--font)',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '20px',
          }}
        >
          Connect
        </button>

        <p style={{ fontSize: '12px', fontWeight: 300, opacity: 0.5, lineHeight: 1.5, fontFamily: 'var(--font)' }}>
          Ask your restaurant admin for the Restaurant ID.
        </p>
      </div>
    </div>
  );
}

// ── Order Card ───────────────────────────────────────────────
function OrderCard({ order }: { order: DisplayOrder }) {
  return (
    <div style={{
      background: 'var(--color-white)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
      animation: order.isNew
        ? 'slideIn 0.3s ease, glowFade 6s ease forwards'
        : 'slideIn 0.3s ease',
      border: order.isNew ? '2px solid var(--color-green-border)' : '2px solid transparent',
      transition: 'border-color 0.5s ease',
    }}>
      {/* Card Header */}
      <div style={{
        background: 'var(--color-primary)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ color: 'var(--color-white)', fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font)' }}>
          {order.tableLabel}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            background: 'var(--color-green)',
            color: 'var(--color-primary)',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font)',
            padding: '3px 10px',
            borderRadius: '100px',
          }}>
            Round {order.roundNumber}
          </span>
          {order.isNew && (
            <span style={{
              background: 'var(--color-green-border)',
              color: 'var(--color-primary)',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font)',
              padding: '3px 10px',
              borderRadius: '100px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              New
            </span>
          )}
        </div>
      </div>

      {/* Items List */}
      <div style={{ padding: '16px 18px' }}>
        {order.items.map((item, idx) => (
          <div key={idx} style={{
            paddingBottom: idx < order.items.length - 1 ? '12px' : 0,
            marginBottom: idx < order.items.length - 1 ? '12px' : 0,
            borderBottom: idx < order.items.length - 1 ? '1px solid rgba(3,40,19,0.07)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              {item.quantity > 1 && (
                <span style={{ fontSize: '16px', fontWeight: 300, fontFamily: 'var(--font)', opacity: 0.5, flexShrink: 0 }}>
                  ×{item.quantity}
                </span>
              )}
              <span style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font)', lineHeight: 1.3 }}>
                {item.name}
              </span>
            </div>
            {item.notes && (
              <p style={{
                fontSize: '13px',
                fontWeight: 300,
                fontFamily: 'var(--font)',
                opacity: 0.6,
                marginTop: '4px',
                fontStyle: 'italic',
              }}>
                Note: {item.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Card Footer */}
      <div style={{
        padding: '10px 18px',
        background: 'rgba(3,40,19,0.03)',
        borderTop: '1px solid rgba(3,40,19,0.06)',
      }}>
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
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 24px',
      opacity: 0.4,
    }}>
      <div style={{ fontSize: '56px', marginBottom: '16px' }}>🍳</div>
      <p style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font)', marginBottom: '8px' }}>No pending orders</p>
      <p style={{ fontSize: '14px', fontWeight: 300, fontFamily: 'var(--font)' }}>Orders will appear here in real time</p>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────
export default function KitchenDisplay() {
  const [restaurantId, setRestaurantId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) || ''
  );
  
  const [connected, setConnected] = useState(false);
  const [orders, setOrders] = useState<DisplayOrder[]>(() => {
    try {
      const saved = localStorage.getItem('rm_kitchen_orders');
      if (!saved) return [];
      const parsed = JSON.parse(saved) as DisplayOrder[];
      return parsed.map(o => ({ ...o, receivedAt: new Date(o.receivedAt), isNew: false }));
    } catch { return []; }
  });
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('rm_kitchen_orders', JSON.stringify(orders));
    } catch { /* storage full */ }
  }, [orders]);

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

      const newOrder: DisplayOrder = {
        uid: `${data.tableId}-${data.roundNumber}-${Date.now()}`,
        tableLabel: data.tableLabel,
        roundNumber: data.roundNumber,
        items: relevantItems,
        receivedAt: new Date(),
        isNew: true,
      };

      setOrders(prev => [newOrder, ...prev].slice(0, MAX_ORDERS));

      setTimeout(() => {
        setOrders(prev =>
          prev.map(o => o.uid === newOrder.uid ? { ...o, isNew: false } : o)
        );
      }, NEW_HIGHLIGHT_MS);
    });

    return () => { socket.disconnect(); };
  }, [restaurantId]);

  function handleReset() {
    socketRef.current?.disconnect();
    localStorage.removeItem(STORAGE_KEY);
    setRestaurantId('');
    setConnected(false);
    setOrders([]);
    localStorage.removeItem('rm_kitchen_orders');
  }

  if (!restaurantId) {
    return (
      <SetupScreen onConnect={(id) => {
        localStorage.setItem(STORAGE_KEY, id);
        setRestaurantId(id);
      }} />
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-bg)',
    }}>
      {/* Header */}
      <header style={{
        background: 'var(--color-white)',
        boxShadow: 'var(--shadow-card)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font)' }}>Rest</span>
            <span style={{ fontSize: '20px', fontWeight: 300, fontFamily: 'var(--font)' }}>Mentor</span>
            <sup style={{ fontSize: '10px', marginLeft: '2px' }}>©</sup>
          </div>
          <div style={{
            background: 'var(--color-bg)',
            padding: '4px 14px',
            borderRadius: '100px',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'var(--font)',
            color: 'var(--color-primary)',
          }}>
            🍳 Kitchen Display
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: connected ? '#22c55e' : '#ef4444',
              boxShadow: connected ? '0 0 0 2px rgba(34,197,94,0.3)' : '0 0 0 2px rgba(239,68,68,0.3)',
            }} />
            <span style={{ fontSize: '12px', fontWeight: 400, fontFamily: 'var(--font)', opacity: 0.6 }}>
              {connected ? 'Live' : 'Reconnecting...'}
            </span>
          </div>

          {orders.length > 0 && (
            <div style={{
              background: 'var(--color-primary)',
              color: 'var(--color-white)',
              borderRadius: '100px',
              padding: '3px 12px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font)',
            }}>
              {orders.length} {orders.length === 1 ? 'order' : 'orders'}
            </div>
          )}

          <button
            onClick={handleReset}
            title="Change restaurant"
            style={{
              background: 'transparent',
              border: '1.5px solid rgba(3,40,19,0.15)',
              borderRadius: 'var(--radius-input)',
              padding: '6px 14px',
              fontSize: '12px',
              fontFamily: 'var(--font)',
              fontWeight: 500,
              color: 'var(--color-primary)',
              cursor: 'pointer',
              opacity: 0.6,
            }}
          >
            ⚙ Setup
          </button>
        </div>
      </header>

      {orders.length === 0 ? (
        <EmptyState />
      ) : (
        <main style={{
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
          alignItems: 'start',
        }}>
          {orders.map(order => (
            <OrderCard key={order.uid} order={order} />
          ))}
        </main>
      )}
    </div>
  );
}
