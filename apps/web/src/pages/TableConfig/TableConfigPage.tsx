// restmentor/apps/web/src/pages/TableConfig/TableConfigPage.tsx
import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from '../../components/Header';
import menIcon from '../../assets/men.png';
import femaleIcon from '../../assets/female.png';
import kidIcon from '../../assets/kid.png';

interface PersonaRow {
  key: string;
  label: string;
  icon: string;
}

const PERSONAS: PersonaRow[] = [
  { key: 'males', label: 'Males', icon: menIcon },
  { key: 'females', label: 'Females', icon: femaleIcon },
  { key: 'kids', label: 'Kids', icon: kidIcon },
];

export default function TableConfigPage() {
  const { id: tableId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ males: 0, females: 0, kids: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const tableLabel = (location.state as { tableLabel?: string })?.tableLabel || 'Table';

  const updateCount = (key: string, delta: number) => {
    setCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key as keyof typeof prev] || 0) + delta),
    }));
  };

  const totalGuests = counts.males + counts.females + counts.kids;

  const handleComplete = async () => {
    if (totalGuests === 0) {
      setError('Please add at least one guest');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/tables/${tableId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          guestMales: counts.males,
          guestFemales: counts.females,
          guestKids: counts.kids,
        }),
      });

      if (response.status === 401) {
        localStorage.clear();
        navigate('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to create session');
        setIsLoading(false);
        return;
      }

      navigate(`/sessions/${data.sessionId}/order`);
    } catch {
      setError('Unable to connect to server');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>

      <Header userName={user.name} />

      <div style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingTop: 'var(--section-top)' }}>

        {/* Subheader */}
        <div className="flex items-center justify-between mb-4">
          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>Configuration</span>
          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.5 }}>
            {tableLabel}
          </span>
        </div>

        {/* Personas Card */}
        <div className="w-full p-5 mb-5" style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px' }}>PERSONAS</span>
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>Quantity</span>
          </div>

          <div style={{ paddingTop: '8px', paddingBottom: '20px' }}>
            <div style={{ height: '1px', backgroundColor: 'var(--color-separator)' }} />
          </div>

          <div className="flex flex-col gap-5">
            {PERSONAS.map((persona) => (
              <div key={persona.key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={persona.icon} alt={persona.label} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                  <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-md)', fontWeight: 'var(--font-regular)' }}>{persona.label}</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => updateCount(persona.key, -1)}
                    className="w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer transition-opacity hover:opacity-80 active:scale-95"
                    style={{ backgroundColor: 'var(--color-green)' }}
                  >
                    <svg width="14" height="2" viewBox="0 0 14 2">
                      <line x1="0" y1="1" x2="14" y2="1" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <span className="w-6 text-center" style={{ color: 'var(--color-primary)', fontSize: 'var(--text-md)', fontWeight: 'var(--font-medium)' }}>
                    {counts[persona.key as keyof typeof counts]}
                  </span>
                  <button
                    onClick={() => updateCount(persona.key, 1)}
                    className="w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer transition-opacity hover:opacity-80 active:scale-95"
                    style={{ backgroundColor: 'var(--color-green)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14">
                      <line x1="7" y1="0" x2="7" y2="14" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
                      <line x1="0" y1="7" x2="14" y2="7" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tip */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center justify-center" style={{ backgroundColor: 'var(--color-white)', padding: '18px 14px', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}>
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px' }}>TIP</span>
          </div>
          <div style={{ backgroundColor: 'var(--color-green)', padding: '18px 14px', borderRadius: 'var(--radius-sm)', flex: 1 }}>
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>
              Execute this step before you approach the table.
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-1.5 mb-3" style={{ color: 'var(--color-error)', fontSize: '13px', fontWeight: 'var(--font-medium)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2" className="shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Complete Button */}
        <button
          onClick={handleComplete}
          disabled={isLoading}
          className="w-full h-[52px] text-base cursor-pointer flex items-center justify-center transition-opacity duration-200 hover:opacity-90 disabled:opacity-80 disabled:cursor-not-allowed border-none"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-white)',
            boxShadow: 'var(--shadow-button)',
            fontFamily: 'var(--font-family)',
            fontWeight: 'var(--font-semibold)',
            letterSpacing: '0.3px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {isLoading ? (
            <div className="w-[22px] h-[22px] border-[2.5px] border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Complete'
          )}
        </button>
      </div>
    </div>
  );
}
