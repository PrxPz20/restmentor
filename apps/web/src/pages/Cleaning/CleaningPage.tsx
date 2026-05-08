import { API_BASE } from '../../config';
// restmentor/apps/web/src/pages/Cleaning/CleaningPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import ellipseImg from '../../assets/ellipse.png';
import cleaningImg from '../../assets/cleaning.png';

export default function CleaningPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleCleaningCompleted = async () => {
    if (!tableId) return;
    setIsLoading(true);

    try {
      await fetch(`${API_BASE}/api/tables/${tableId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'open' }),
      });

      navigate('/tables');
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>

      <Header userName={user.name} />

      <div className="flex flex-col items-center" style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingTop: 'var(--section-top)' }}>

        {/* Title */}
        <span style={{ color: 'var(--color-primary)', fontSize: '20px', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px', marginBottom: '16px' }}>
          CLEANING REQUEST
        </span>

        {/* Illustration */}
        <div className="relative flex items-center justify-center my-4" style={{ width: '260px', height: '260px' }}>
          <img src={ellipseImg} alt="" style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'contain' }} />
          <img src={cleaningImg} alt="Cleaning illustration" style={{ position: 'relative', zIndex: 1, width: '80%', height: '80%', objectFit: 'contain' }} />
        </div>

        {/* Subtitle */}
        <span style={{ color: 'var(--color-primary)', fontSize: '15px', fontWeight: 'var(--font-regular)', textAlign: 'center', lineHeight: 1.5, marginTop: '8px' }}>
          Cleaning request sent.<br />
          The table will become available once<br />
          cleaning is complete, provided no<br />
          guests are present.
        </span>

        {/* Buttons */}
        <div className="w-full mt-8">
          <button
            onClick={handleCleaningCompleted}
            disabled={isLoading}
            className="w-full h-[52px] text-base cursor-pointer flex items-center justify-center transition-opacity duration-200 hover:opacity-90 disabled:opacity-80 disabled:cursor-not-allowed border-none mb-[5px]"
            style={{
              backgroundColor: 'var(--color-cleaning)',
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-family)',
              fontWeight: 'var(--font-semibold)',
              letterSpacing: '0.3px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {isLoading ? (
              <div className="w-[22px] h-[22px] border-[2.5px] rounded-full animate-spin" style={{ borderColor: 'rgba(3,40,19,0.2)', borderTopColor: 'var(--color-primary)' }} />
            ) : (
              'Cleaning Completed'
            )}
          </button>

          <button
            onClick={async () => {
              try {
                await fetch(`${API_BASE}/api/tables/${tableId}/status`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ status: 'occupied' }),
                });
              } catch {
                // revert failed silently — navigate back anyway
              }
              navigate(-1);
            }}
            className="w-full h-[52px] text-base cursor-pointer flex items-center justify-center transition-opacity duration-200 hover:opacity-90 border-none mb-[36px]"
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
            Back
          </button>

        </div>
      </div>
    </main>
  );
}
