// restmentor/apps/web/src/pages/Confirmation/ConfirmationPage.tsx
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import chefImg from '../../assets/chef.png';

interface ConfirmationState {
  sessionId: string;
  roundNumber: number;
  kitchenItems: number;
  barItems: number;
  totalItems: number;
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

      <div className="flex flex-col items-center" style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingTop: 'var(--section-top)' }}>

        {/* Title */}
        <span style={{ color: 'var(--color-primary)', fontSize: '20px', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px', marginBottom: '8px' }}>
          ORDER PROCESSED
        </span>

        {/* Chef Illustration */}
        <img src={chefImg} alt="Chef illustration" className="w-full max-w-[320px] h-auto my-4" />

        {/* Subtitle */}
        <span style={{ color: 'var(--color-primary)', fontSize: '15px', fontWeight: 'var(--font-regular)', textAlign: 'center', lineHeight: 1.4 }}>
          Check back to the table to add<br />more items later.
        </span>


        {/* Order Summary */}
        <div className="w-full mt-6 p-5" style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between py-2">
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>Round</span>
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>{state.roundNumber}</span>
          </div>
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

        {/* Buttons */}
        <div className="w-full mt-8">
          <button
            onClick={() => navigate(`/sessions/${state.sessionId}/order`)}
            className="w-full h-[52px] text-base cursor-pointer flex items-center justify-center transition-opacity duration-200 hover:opacity-90 border-none mb-[5px]"
            style={{
              backgroundColor: 'var(--color-green)',
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-family)',
              fontWeight: 'var(--font-semibold)',
              letterSpacing: '0.3px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            Back to Overview
          </button>

          <button
            onClick={() => navigate('/tables')}
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
            New Order
          </button>
        </div>
      </div>
    </div>
  );
}
