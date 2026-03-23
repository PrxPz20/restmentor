import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/Header';

interface ConfirmationState {
  roundNumber: number;
  kitchenItems: number;
  barItems: number;
  totalItems: number;
  sessionId: string;
  tableLabel: string;
}

export default function ConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const state = location.state as ConfirmationState | null;

  if (!state) {
    navigate('/tables');
    return null;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>

      <Header userName={user.name} />

      <div style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingTop: 'var(--section-top)' }}>

        {/* Success Card */}
        <div
          className="w-full p-6 flex flex-col items-center"
          style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)' }}
        >
          {/* Checkmark */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: 'var(--color-green)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-md)', fontWeight: 'var(--font-semibold)', marginBottom: '8px' }}>
            Order Sent!
          </span>

          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', textAlign: 'center', lineHeight: 1.5 }}>
            Round {state.roundNumber} has been sent to the kitchen and bar.
          </span>

          {/* Order Summary */}
          <div className="w-full mt-5">
            <div style={{ height: '1px', backgroundColor: 'var(--color-separator)', marginBottom: '16px' }} />

            <div className="flex items-center justify-between py-2">
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>Total Items</span>
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>{state.totalItems}</span>
            </div>

            {state.kitchenItems > 0 && (
              <div className="flex items-center justify-between py-2">
                <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>Sent to Kitchen</span>
                <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>{state.kitchenItems} items</span>
              </div>
            )}

            {state.barItems > 0 && (
              <div className="flex items-center justify-between py-2">
                <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>Sent to Bar</span>
                <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>{state.barItems} items</span>
              </div>
            )}

            <div className="flex items-center justify-between py-2">
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>Table</span>
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>{state.tableLabel}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <button
          onClick={() => navigate(`/sessions/${state.sessionId}/order`)}
          className="w-full h-[52px] text-base cursor-pointer flex items-center justify-center transition-opacity duration-200 hover:opacity-90 border-none mt-5"
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
          Add Another Round
        </button>

        <button
          onClick={() => navigate('/tables')}
          className="w-full h-[52px] text-base cursor-pointer flex items-center justify-center transition-opacity duration-200 hover:opacity-90 border-none mt-[5px] mb-[36px]"
          style={{
            backgroundColor: 'var(--color-cleaning)',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-family)',
            fontWeight: 'var(--font-semibold)',
            letterSpacing: '0.3px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          Back to Tables
        </button>
      </div>
    </div>
  );
}
