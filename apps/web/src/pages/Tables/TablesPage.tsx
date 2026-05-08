import { API_BASE } from '../../config';
// restmentor/apps/web/src/pages/Tables/TablesPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Header from '../../components/Header';

type TableStatus = 'open' | 'occupied' | 'paid' | 'cleaning';

interface TableData {
  id: string;
  label: string;
  status: TableStatus;
  current_session_id: string | null;
  sort_order: number;
}

const STATUS_COLORS: Record<TableStatus, string> = {
  open: 'var(--color-green)',
  occupied: 'var(--color-occupied)',
  paid: 'var(--color-paid)',
  cleaning: 'var(--color-cleaning)',
};

const STATUS_LABELS: Record<TableStatus, string> = {
  open: 'OPEN',
  occupied: 'OCCUPIED',
  paid: 'PAID',
  cleaning: 'CLEANING',
};

type FilterOption = 'all' | 'open' | 'occupied';

export default function TablesPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchTables();
  }, []);

  // ── WebSocket: subscribe to table status changes ──

  useEffect(() => {
    const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
    const restaurantId = restaurant.id as string;
    if (!restaurantId) return;

    const socket = io(API_BASE || "http://localhost:3001", {
      query: { restaurantId },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('table:status_changed', ({ tableId, newStatus }: { tableId: string; newStatus: string }) => {
      setTables(prev =>
        prev.map(t => t.id === tableId ? { ...t, status: newStatus as TableStatus } : t)
      );
    });

    return () => { socket.disconnect(); };
  }, []);

  const fetchTables = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tables`, {
        credentials: 'include',
      });

      if (response.status === 401) {
        localStorage.clear();
        navigate('/login');
        return;
      }

      const data = await response.json();
      setTables(data.tables);
      setIsLoading(false);
    } catch {
      setError('Unable to load tables');
      setIsLoading(false);
    }
  };

  const handleTableTap = (table: TableData) => {
    if (table.status === 'open') {
      navigate(`/tables/${table.id}/configure`, { state: { tableLabel: table.label } });
    } else if (table.status === 'occupied') {
      navigate(`/sessions/${table.current_session_id}/order`);
    } else if (table.status === 'cleaning') {
      navigate(`/tables/${table.id}/cleaning`);
    }
  };

  const getTableNumber = (label: string) => {
    const num = label.replace(/\D/g, '');
    return num.padStart(2, '0');
  };

  const filteredTables = tables.filter((t) => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>
        <div className="w-[22px] h-[22px] border-[2.5px] rounded-full animate-spin" style={{ borderColor: 'rgba(3, 40, 19, 0.2)', borderTopColor: 'var(--color-primary)' }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>

      <Header userName={user.name} />

      {/* Subheader */}
      <div className="flex items-center justify-between pb-2" style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingTop: 'var(--section-top)' }}>
        <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>Select Table</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setFilter(filter === 'open' ? 'all' : 'open')}
            className="bg-transparent border-none cursor-pointer p-0 transition-opacity"
            style={{
              color: 'var(--color-primary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-regular)',
              opacity: filter === 'open' ? 1 : 0.4,
              fontFamily: 'var(--font-family)',
            }}
          >
            Open
          </button>
          <button
            onClick={() => setFilter(filter === 'occupied' ? 'all' : 'occupied')}
            className="bg-transparent border-none cursor-pointer p-0 transition-opacity"
            style={{
              color: 'var(--color-primary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-regular)',
              opacity: filter === 'occupied' ? 1 : 0.4,
              fontFamily: 'var(--font-family)',
            }}
          >
            Occupied
          </button>
        </div>
      </div>

      {error && (
        <div className="py-2" style={{ color: 'var(--color-error)', paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', fontSize: 'var(--text-sm)' }}>{error}</div>
      )}

      {/* Table Grid */}
      <div className="grid grid-cols-2 gap-3" style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
        {filteredTables.map((table) => (
          <button
            key={table.id}
            onClick={() => handleTableTap(table)}
            className="text-left border-none cursor-pointer p-4 transition-transform duration-150 active:scale-[0.97]"
            style={{
              backgroundColor: STATUS_COLORS[table.status],
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-card)',
              fontFamily: 'var(--font-family)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>
                {STATUS_LABELS[table.status]}
              </span>
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>
                6 Seats
              </span>
            </div>
            <div style={{ color: 'var(--color-primary)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-heavy)', lineHeight: 1.1 }}>
              {getTableNumber(table.label)}
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}
