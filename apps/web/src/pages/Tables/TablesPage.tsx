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
  open: '#D4FCE2',
  occupied: '#FCD8D4',
  paid: '#D4DCFC',
  cleaning: '#F5FCD4',
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EEEEEE', fontFamily: "'Fira Sans', sans-serif" }}>
        <div className="w-[22px] h-[22px] border-[2.5px] border-[#032813]/20 border-t-[#032813] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EEEEEE', fontFamily: "'Fira Sans', sans-serif" }}>

      {/* Header */}
      <Header userName={user.name} />

      {/* Subheader */}
      <div className="flex items-center justify-between pt-4 pb-2" style={{ paddingLeft: '36px', paddingRight: '36px', paddingTop: '60px' }}>
        <span style={{ color: '#032813', fontSize: '12px', fontWeight: 600 }}>Select Table</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setFilter(filter === 'open' ? 'all' : 'open')}
            className="bg-transparent border-none cursor-pointer p-0 transition-opacity"
            style={{
              color: '#032813',
              fontSize: '12px',
              fontWeight: 400,
              opacity: filter === 'open' ? 1 : 0.4,
              fontFamily: "'Fira Sans', sans-serif",
            }}
          >
            Open
          </button>
          <button
            onClick={() => setFilter(filter === 'occupied' ? 'all' : 'occupied')}
            className="bg-transparent border-none cursor-pointer p-0 transition-opacity"
            style={{
              color: '#032813',
              fontSize: '12px',
              fontWeight: 400,
              opacity: filter === 'occupied' ? 1 : 0.4,
              fontFamily: "'Fira Sans', sans-serif",
            }}
          >
            Occupied
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="py-2 text-sm" style={{ color: '#c0392b', paddingLeft: '36px', paddingRight: '36px' }}>{error}</div>
      )}

      {/* Table Grid */}
      <div className="grid grid-cols-2 gap-3" style={{ paddingLeft: '36px', paddingRight: '36px' }}>
        {filteredTables.map((table) => (
          <button
            key={table.id}
            onClick={() => handleTableTap(table)}
            className="text-left border-none cursor-pointer p-4 transition-transform duration-150 active:scale-[0.97]"
            style={{
              backgroundColor: STATUS_COLORS[table.status],
              borderRadius: '8px',
              boxShadow: 'rgba(0, 0, 0, 0.05) 0px 8px 6px',
              fontFamily: "'Fira Sans', sans-serif",
            }}
          >
            {/* Top row: Status + Seats */}
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: '#032813', fontSize: '12px', fontWeight: 600 }}>
                {STATUS_LABELS[table.status]}
              </span>
              <span style={{ color: '#032813', fontSize: '12px', fontWeight: 300 }}>
                6 Seats
              </span>
            </div>

            {/* Table number */}
            <div style={{ color: '#032813', fontSize: '36px', fontWeight: 900, lineHeight: 1.1 }}>
              {getTableNumber(table.label)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
