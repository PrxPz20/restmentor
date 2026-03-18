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

  // Get table label passed via navigation state
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

    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const response = await fetch(`/api/tables/${tableId}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
    <div className="min-h-screen" style={{ backgroundColor: '#EEEEEE', fontFamily: "'Fira Sans', sans-serif" }}>

      {/* Header */}
      <Header userName={user.name} />

      {/* Content */}
      <div style={{ paddingLeft: '36px', paddingRight: '36px', paddingTop: '60px' }}>

        {/* Subheader */}
        <div className="flex items-center justify-between mb-4">
          <span style={{ color: '#032813', fontSize: '12px', fontWeight: 600 }}>Configuration</span>
          <span style={{ color: '#032813', fontSize: '12px', fontWeight: 300, opacity: 0.5 }}>
            {tableLabel}
          </span>
        </div>

        {/* Personas Card */}
        <div
          className="w-full p-5 mb-5"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: 'rgba(0, 0, 0, 0.05) 0px 8px 6px',
          }}
        >
          {/* Card header */}
          <div className="flex items-center justify-between">
            <span style={{ color: '#032813', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>PERSONAS</span>
            <span style={{ color: '#032813', fontSize: '12px', fontWeight: 300 }}>Quantity</span>
          </div>

          {/* Separator */}
          <div style={{ paddingTop: '8px', paddingBottom: '20px' }}>
            <div style={{ height: '1px', backgroundColor: '#EEEEEE' }} />
          </div>

          {/* Persona rows */}
          <div className="flex flex-col gap-5">
            {PERSONAS.map((persona) => (
              <div key={persona.key} className="flex items-center justify-between">
                {/* Icon + Label */}
                <div className="flex items-center gap-3">
                  <img src={persona.icon} alt={persona.label} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                  <span style={{ color: '#032813', fontSize: '16px', fontWeight: 400 }}>{persona.label}</span>
                </div>

                {/* Counter */}
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => updateCount(persona.key, -1)}
                    className="w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer transition-opacity hover:opacity-80 active:scale-95"
                    style={{ backgroundColor: '#D4FCE2' }}
                  >
                    <svg width="14" height="2" viewBox="0 0 14 2">
                      <line x1="0" y1="1" x2="14" y2="1" stroke="#032813" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <span
                    className="w-6 text-center"
                    style={{ color: '#032813', fontSize: '16px', fontWeight: 500 }}
                  >
                    {counts[persona.key as keyof typeof counts]}
                  </span>
                  <button
                    onClick={() => updateCount(persona.key, 1)}
                    className="w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer transition-opacity hover:opacity-80 active:scale-95"
                    style={{ backgroundColor: '#D4FCE2' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14">
                      <line x1="7" y1="0" x2="7" y2="14" stroke="#032813" strokeWidth="2" strokeLinecap="round" />
                      <line x1="0" y1="7" x2="14" y2="7" stroke="#032813" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tip */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center justify-center" style={{ backgroundColor: '#FFFFFF', padding: '18px 14px', borderRadius: '8px', flexShrink: 0 }}>
            <span style={{ color: '#032813', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px' }}>TIP</span>
          </div>
          <div style={{ backgroundColor: '#D4FCE2', padding: '18px 14px', borderRadius: '8px', flex: 1 }}>
            <span style={{ color: '#032813', fontSize: '12px', fontWeight: 300 }}>
              Execute this step before you approach the table.
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-1.5 mb-3 text-[13px] font-medium" style={{ color: '#c0392b' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" className="shrink-0">
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
          className="w-full h-[52px] rounded-xl text-base font-semibold cursor-pointer flex items-center justify-center transition-opacity duration-200 hover:opacity-90 disabled:opacity-80 disabled:cursor-not-allowed border-none"
          style={{
            backgroundColor: '#032813',
            color: '#FFFFFF',
            boxShadow: '0px 4px 8px rgba(3, 40, 19, 0.25)',
            fontFamily: "'Fira Sans', sans-serif",
            letterSpacing: '0.3px',
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
