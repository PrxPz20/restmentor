// apps/web/src/pages/ConfirmPayment/ConfirmPaymentPage.tsx
import { API_BASE } from '../../config';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import menIcon from '../../assets/men.png';
import femaleIcon from '../../assets/female.png';
import kidIcon from '../../assets/kid.png';
import moneyImg from '../../assets/money.svg';

interface SessionInfo {
  table_id: string;
  guest_males: number;
  guest_females: number;
  guest_kids: number;
}

interface OrderSummary {
  totalItems: number;
  aiSuggestedItems: number;
}

export default function ConfirmPaymentPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [summary, setSummary] = useState<OrderSummary>({ totalItems: 0, aiSuggestedItems: 0 });
  const [tableLabel, setTableLabel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load session info
      const sessionRes = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
        credentials: 'include',
      });
      if (!sessionRes.ok) { navigate('/tables'); return; }
      const sessionData = await sessionRes.json();
      const s = sessionData.session;
      setSession(s);

      // Load table label
      const tablesRes = await fetch(`${API_BASE}/api/tables`, { credentials: 'include' });
      if (tablesRes.ok) {
        const tablesData = await tablesRes.json();
        const table = tablesData.tables.find((t: any) => t.id === s.table_id);
        if (table) setTableLabel(table.label);
      }

      // Load order summary
      const ordersRes = await fetch(`${API_BASE}/api/sessions/${sessionId}/orders`, {
        credentials: 'include',
      });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        const allItems = ordersData.orders.flatMap((o: any) => o.items || []);
        const totalItems = allItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
        const aiSuggestedItems = allItems
          .filter((i: any) => i.aiSuggested)
          .reduce((sum: number, i: any) => sum + i.quantity, 0);
        setSummary({ totalItems, aiSuggestedItems });
      }

      setIsLoading(false);
    } catch {
      setError('Failed to load session data');
      setIsLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!session) return;
    setIsConfirming(true);
    setError('');
    try {
      // Mark as paid
      await fetch(`${API_BASE}/api/tables/${session.table_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'paid' }),
      });

      // Immediately set to cleaning
      await fetch(`${API_BASE}/api/tables/${session.table_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'cleaning' }),
      });

      navigate('/tables');
    } catch {
      setError('Failed to confirm payment');
      setIsConfirming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>
        <div className="w-[22px] h-[22px] border-[2.5px] rounded-full animate-spin" style={{ borderColor: 'rgba(3, 40, 19, 0.2)', borderTopColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  const totalGuests = (session?.guest_males ?? 0) + (session?.guest_females ?? 0) + (session?.guest_kids ?? 0);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>
      <Header userName={user.name} />

      <div className="flex flex-col items-center" style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingTop: 'var(--section-top)' }}>

        {/* Title */}
        <span style={{ color: 'var(--color-primary)', fontSize: '20px', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px', marginBottom: '8px' }}>
          CONFIRM PAYMENT
        </span>

        {/* Money Illustration */}
        <img src={moneyImg} alt="Payment illustration" className="w-full max-w-[320px] h-auto" style={{ marginTop: '16px', marginBottom: '16px' }} />

        {/* Subtitle */}
        <span style={{ color: 'var(--color-primary)', fontSize: '15px', fontWeight: 'var(--font-semibold)', textAlign: 'center', lineHeight: 1.4, marginBottom: '24px' }}>
          {tableLabel}
        </span>

{/* Guests + Order Summary — combined box */}
        <div className="w-full mb-4 p-4" style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)' }}>
          
          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px' }}>GUESTS</span>
          <div style={{ height: '1px', backgroundColor: 'var(--color-separator)', margin: '10px 0' }} />
          {[
            { icon: menIcon, label: 'Male', count: session?.guest_males ?? 0 },
            { icon: femaleIcon, label: 'Female', count: session?.guest_females ?? 0 },
            { icon: kidIcon, label: 'Kid', count: session?.guest_kids ?? 0 },
          ].filter(g => g.count > 0).map((g, i, arr) => (
            <div key={g.label} className="flex items-center justify-between py-2" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-separator)' : 'none' }}>
              <div className="flex items-center gap-2">
                <img src={g.icon} alt={g.label} style={{ width: '20px', height: '20px', objectFit: 'contain', opacity: 0.7 }} />
                <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>{g.label}</span>
              </div>
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>{g.count}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2">
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.5 }}>Total guests</span>
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>{totalGuests}</span>
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--color-separator)', margin: '16px 0 10px' }} />

          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px' }}>ORDER SUMMARY</span>
          <div style={{ height: '1px', backgroundColor: 'var(--color-separator)', margin: '10px 0' }} />
          <div className="flex justify-between py-2">
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>Total items ordered</span>
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>{summary.totalItems}</span>
          </div>
          <div style={{ height: '1px', backgroundColor: 'var(--color-separator)' }} />
          <div className="flex justify-between py-2">
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>AI suggested items</span>
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" width="10" height="10">
                <path d="M12 0 C12 0 13.5 8.5 24 12 C13.5 15.5 12 24 12 24 C12 24 10.5 15.5 0 12 C10.5 8.5 12 0 12 0Z" fill="#032813"/>
              </svg>
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>{summary.aiSuggestedItems}</span>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="w-full mb-6 p-4 flex items-start gap-3" style={{ backgroundColor: 'var(--color-paid)', borderRadius: 'var(--radius-sm)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', lineHeight: 1.4 }}>
            This action is final. Confirming payment will close the table and mark it for cleaning.
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 mb-3" style={{ color: 'var(--color-error)', fontSize: '13px', fontWeight: 'var(--font-medium)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Confirm Button */}
        <button
          onClick={handleConfirmPayment}
          disabled={isConfirming}
          className="w-full h-[52px] text-base flex items-center justify-center border-none mb-[5px] transition-opacity"
          style={{
            width: '100%',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-white)',
            fontFamily: 'var(--font-family)',
            fontWeight: 'var(--font-semibold)',
            letterSpacing: '0.3px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-button)',
            cursor: isConfirming ? 'not-allowed' : 'pointer',
            opacity: isConfirming ? 0.6 : 1,
          }}
        >
          {isConfirming ? (
            <div className="w-[22px] h-[22px] border-[2.5px] border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Confirm Payment'
          )}
        </button>

        <button
          onClick={() => navigate(-1)}
          className="w-full py-2 bg-transparent border-none cursor-pointer hover:opacity-70 transition-opacity flex items-center justify-center gap-1.5 mb-[36px]"
          style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family)', fontSize: '14px', fontWeight: 'var(--font-medium)', opacity: 0.5 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Cancel
        </button>

      </div>
    </div>
  );
}
