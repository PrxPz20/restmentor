import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const response = await fetch('/api/tables', {
        headers: { Authorization: `Bearer ${token}` },
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>
        <div className="w-[22px] h-[22px] border-[2.5px] rounded-full animate-spin" style={{ borderColor: 'rgba(3, 40, 19, 0.2)', borderTopColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>

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
    </div>
  );
}
