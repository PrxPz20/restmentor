import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import MenuBrowser from './components/MenuBrowser';
import menIcon from '../../assets/men.png';
import femaleIcon from '../../assets/female.png';
import kidIcon from '../../assets/kid.png';

interface OrderItemData {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: string;
  genderTarget: string;
  quantity: number;
  aiSuggested: boolean;
  notes: string | null;
}

interface OrderData {
  id: string;
  round_number: number;
  status: string;
  items: OrderItemData[];
}

type GenderTarget = 'male' | 'female' | 'kid' | 'shared';

const GENDER_ICONS: Record<string, string> = {
  male: menIcon,
  female: femaleIcon,
  kid: kidIcon,
};

export default function OrderPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeGender, setActiveGender] = useState<GenderTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    if (!token) { navigate('/login'); return; }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) { localStorage.clear(); navigate('/login'); return; }

      const data = await response.json();
      setOrders(data.orders);

      // If no draft order exists, create one
      if (data.orders.length === 0 || data.orders.every((o: OrderData) => o.status !== 'draft')) {
        await createNewOrder();
      } else {
        const draft = data.orders.find((o: OrderData) => o.status === 'draft');
        if (draft) setCurrentOrderId(draft.id);
      }

      setIsLoading(false);
    } catch {
      setError('Unable to load orders');
      setIsLoading(false);
    }
  };

  const createNewOrder = async () => {
    if (!token) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      setCurrentOrderId(data.order.id);
      await loadOrders();
    } catch {
      setError('Failed to create order');
    }
  };

  const handleAddItem = async (menuItemId: string) => {
    if (!token || !currentOrderId || !activeGender) return;

    try {
      await fetch(`/api/orders/${currentOrderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ menuItemId, genderTarget: activeGender, quantity: 1 }),
      });

      await loadOrders();
    } catch {
      setError('Failed to add item');
    }
  };

  const handleGenderTap = (gender: GenderTarget) => {
    setActiveGender(gender);
    setMenuOpen(true);
  };

  const handleShareTap = () => {
    setActiveGender('shared');
    setMenuOpen(true);
  };

  // Gather all items across all orders
  const allItems = orders.flatMap((o) =>
    (o.items || []).map((item) => ({ ...item, roundNumber: o.round_number }))
  );
  const sharedItems = allItems.filter((i) => i.genderTarget === 'shared');
  const genderedItems = allItems.filter((i) => i.genderTarget !== 'shared');

  // Group gendered items by gender
  const groupedByGender: Record<string, typeof genderedItems> = {};
  genderedItems.forEach((item) => {
    if (!groupedByGender[item.genderTarget]) groupedByGender[item.genderTarget] = [];
    groupedByGender[item.genderTarget]!.push(item);
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>
        <div className="w-[22px] h-[22px] border-[2.5px] rounded-full animate-spin" style={{ borderColor: 'rgba(3, 40, 19, 0.2)', borderTopColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  const menuOverlay = menuOpen && activeGender ? (
    <MenuBrowser
      activeGender={activeGender}
      onSelectItem={handleAddItem}
      onClose={() => { setMenuOpen(false); setActiveGender(null); }}
      onSwitchGender={(g) => setActiveGender(g)}
    />
  ) : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>

      {menuOverlay}

      <Header userName={user.name} />

      <div style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingTop: 'var(--section-top)' }}>

        {/* Subheader */}
        <div className="flex items-center justify-between mb-2">
          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>Order</span>
          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.5 }}>
            Table 01
          </span>
        </div>

        {/* TO SHARE */}
        <div className="mb-6 p-4" style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)' }}>
          <div className="mb-2">
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px' }}>TO SHARE</span>
          </div>

          {/* Separator */}
          <div style={{ height: '1px', backgroundColor: 'var(--color-separator)', marginBottom: '10px' }} />

          <div className="grid grid-cols-4 gap-3">
            {/* Shared items */}
            {sharedItems.map((item, index) => (
              <div
                key={item.id}
                // className="flex flex-col justify-between p-3"
                className="flex flex-col justify-between p-3 overflow-hidden"
                style={{
                  backgroundColor: 'var(--color-green)',
                  borderRadius: 'var(--radius-sm)',
                  height: '110px',
                }}
              >
                <div className="flex flex-col items-center">
                  <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-md)', fontWeight: 'var(--font-medium)', textAlign: 'center' }}>
                    {String(index + 1)}
                  </span>
                  <span style={{ color: 'var(--color-primary)', fontSize: '10px', fontWeight: 'var(--font-medium)', textAlign: 'center', lineHeight: 1.2, marginTop: '2px' }}>
                    {item.menuItemName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-regular)' }}>
                    x{item.quantity}
                  </span>
                  <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-regular)' }}>
                    {Number(item.menuItemPrice).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}

            {/* Add button */}
            <button
              onClick={handleShareTap}
              className="flex items-center justify-center border-none cursor-pointer transition-opacity hover:opacity-80 active:scale-95"
              style={{
                backgroundColor: 'var(--color-green)',
                borderRadius: 'var(--radius-sm)',
                height: '110px',
              }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.6)',
                  boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <line x1="8" y1="0" x2="8" y2="16" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="0" y1="8" x2="16" y2="8" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </button>

          </div>
        </div>

        {/* NEW ORDER */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px' }}>NEW ORDER</span>
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>Individual Order</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'male' as GenderTarget, label: 'Male', icon: menIcon },
              { key: 'female' as GenderTarget, label: 'Female', icon: femaleIcon },
              { key: 'kid' as GenderTarget, label: 'Kid', icon: kidIcon },
            ].map((gender) => (
              <button
                key={gender.key}
                onClick={() => handleGenderTap(gender.key)}
                className="flex flex-col items-center justify-center gap-2 py-4 border-none cursor-pointer transition-transform active:scale-95"
                style={{
                  backgroundColor: 'var(--color-white)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-card)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                <img src={gender.icon} alt={gender.label} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-md)', fontWeight: 'var(--font-regular)' }}>{gender.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SEGMENTS */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px' }}>SEGMENTS</span>
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>Grouping Personas with similar choices</span>
          </div>

          {Object.keys(groupedByGender).length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-6"
              style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)' }}
            >
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.4 }}>Currently Empty</span>
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.4 }}>Add some orders</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {Object.entries(groupedByGender).map(([gender, items]) => (
                <div
                  key={gender}
                  className="p-4"
                  style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <img src={GENDER_ICONS[gender] || menIcon} alt={gender} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                    <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', textTransform: 'capitalize' }}>{gender}</span>
                  </div>
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-1.5">
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-regular)' }}>
                        {item.menuItemName} x{item.quantity}
                      </span>
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>
                        ${Number(item.menuItemPrice).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TIP */}
        <div className="flex items-stretch gap-2 mb-4">
          <div className="flex items-center justify-center" style={{ backgroundColor: 'var(--color-white)', padding: '18px 14px', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}>
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px' }}>TIP</span>
          </div>
          <div className="flex items-center" style={{ backgroundColor: 'var(--color-green)', padding: '18px 14px', borderRadius: 'var(--radius-sm)', flex: 1 }}>
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', lineHeight: 1.3 }}>
              Tap a suggested item to see quick talking points you can use when presenting it to the table.
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-1.5 mb-3" style={{ color: 'var(--color-error)', fontSize: '13px', fontWeight: 'var(--font-medium)' }}>
            {error}
          </div>
        )}

        {/* Process Order Button */}
        <button
          className="w-full h-[52px] text-base cursor-pointer flex items-center justify-center transition-opacity duration-200 hover:opacity-90 border-none mb-8"
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
          Process Order
        </button>
      </div>
    </div>
  );
}
