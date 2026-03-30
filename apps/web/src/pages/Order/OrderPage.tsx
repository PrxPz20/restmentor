// restmentor/apps/web/src/pages/Order/OrderPage.tsx
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
  const [isSending, setIsSending] = useState(false);
  const [tableLabel, setTableLabel] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

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

      const sessionRes = await fetch(`/api/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        const tablesRes = await fetch('/api/tables', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (tablesRes.ok) {
          const tablesData = await tablesRes.json();
          const table = tablesData.tables.find((t: any) => t.id === sessionData.session.table_id);
          if (table) setTableLabel(table.label);
        }
      }

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

  // ── Edit item quantity or remove (quantity = 0) ──────
  const handleEditItem = async (orderId: string, itemId: string, newQuantity: number) => {
    if (!token) return;

    try {
      await fetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: newQuantity }),
      });

      setEditingItemId(null);
      await loadOrders();
    } catch {
      setError('Failed to update item');
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

  const handleProcessOrder = async () => {
    if (!token || !currentOrderId) return;

    if (allItems.length === 0) {
      setError('Add some items before processing the order');
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const response = await fetch(`/api/orders/${currentOrderId}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to send order');
        setIsSending(false);
        return;
      }

      navigate(`/sessions/${sessionId}/confirmed`, {
        state: {
          sessionId,
          roundNumber: data.roundNumber,
          kitchenItems: data.kitchenItems,
          barItems: data.barItems,
          totalItems: data.totalItems,
          tableLabel: tableLabel,
        },
      });
    } catch {
      setError('Unable to send order');
      setIsSending(false);
    }
  };

  const handleCleaningRequest = async () => {
    if (!token) return;

    try {
      const sessionRes = await fetch(`/api/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!sessionRes.ok) return;
      const sessionData = await sessionRes.json();
      const tableId = sessionData.session.table_id;

      await fetch(`/api/tables/${tableId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'cleaning' }),
      });

      navigate(`/tables/${tableId}/cleaning`);
    } catch {
      setError('Failed to send cleaning request');
    }
  };

  // ── Flatten all items, tracking which order each belongs to ──
  const allItems = orders.flatMap((o) =>
    (o.items || []).map((item) => ({ ...item, roundNumber: o.round_number, orderId: o.id, orderStatus: o.status }))
  );
  const sharedItems = allItems.filter((i) => i.genderTarget === 'shared');
  const genderedItems = allItems.filter((i) => i.genderTarget !== 'shared');

  const groupedByGender: Record<string, typeof genderedItems> = {};
  genderedItems.forEach((item) => {
    if (!groupedByGender[item.genderTarget]) groupedByGender[item.genderTarget] = [];
    groupedByGender[item.genderTarget]!.push(item);
  });

  const sortedGenderKeys = Object.keys(groupedByGender).sort((a, b) => {
    if (a === 'kid') return 1;
    if (b === 'kid') return -1;
    return 0;
  });

  const sortedGroupedByGender: Record<string, typeof genderedItems> = {};
  sortedGenderKeys.forEach((key) => {
    sortedGroupedByGender[key] = groupedByGender[key]!;
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
            {tableLabel}
          </span>
        </div>

        {/* TO SHARE */}
        <div className="mb-4 p-4" style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)' }}>
          <div className="mb-2">
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px' }}>TO SHARE</span>
          </div>
          <div style={{ height: '1px', backgroundColor: 'var(--color-separator)', marginBottom: '10px' }} />
          <div className="grid grid-cols-3 gap-3">
            {sharedItems.map((item, index) => (
              <div
                key={item.id}
                onClick={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                className="flex flex-col justify-between p-3 overflow-hidden cursor-pointer transition-opacity active:opacity-80"
                style={{
                  backgroundColor: 'var(--color-green)',
                  borderRadius: 'var(--radius-sm)',
                  height: '110px',
                }}
              >
                {editingItemId === item.id ? (
                  // ── Edit controls for shared item ──
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditItem(item.orderId, item.id, item.quantity - 1); }}
                        className="flex items-center justify-center border-none cursor-pointer"
                        style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.7)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 'var(--font-bold)', fontFamily: 'var(--font-family)' }}
                      >
                        −
                      </button>
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-md)', fontWeight: 'var(--font-bold)', minWidth: '20px', textAlign: 'center', fontFamily: 'var(--font-family)' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditItem(item.orderId, item.id, item.quantity + 1); }}
                        className="flex items-center justify-center border-none cursor-pointer"
                        style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.7)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 'var(--font-bold)', fontFamily: 'var(--font-family)' }}
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditItem(item.orderId, item.id, 0); }}
                      className="border-none cursor-pointer"
                      style={{ fontSize: '11px', fontWeight: 'var(--font-medium)', fontFamily: 'var(--font-family)', color: 'var(--color-primary)', opacity: 0.5, background: 'transparent', padding: 0 }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  // ── Normal shared item view ──
                  <>
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
                        €{Number(item.menuItemPrice).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Add shared button */}
            <button
              onClick={handleShareTap}
              className="flex items-center justify-center border-none cursor-pointer transition-opacity hover:opacity-80 active:scale-95"
              style={{ backgroundColor: 'var(--color-green)', borderRadius: 'var(--radius-sm)', height: '110px' }}
            >
              <div className="flex items-center justify-center" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.6)', boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <line x1="8" y1="0" x2="8" y2="16" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="0" y1="8" x2="16" y2="8" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        {/* NEW ORDER */}
        <div className="mb-4">
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
                style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', fontFamily: 'var(--font-family)' }}
              >
                <img src={gender.icon} alt={gender.label} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-md)', fontWeight: 'var(--font-regular)' }}>{gender.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SEGMENTS */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px' }}>SEGMENTS</span>
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>Grouping Personas with similar choices</span>
          </div>

          {Object.keys(groupedByGender).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6" style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)' }}>
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.4 }}>Currently Empty</span>
              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.4 }}>Add some orders</span>
            </div>
          ) : (
            <div className="p-5" style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)' }}>
              {Object.entries(sortedGroupedByGender).map(([gender, items], groupIndex) => {
                const groupLetter = String.fromCharCode(65 + groupIndex);
                const genderLabel = gender.charAt(0).toUpperCase() + gender.slice(1);
                const genderIcon = GENDER_ICONS[gender] || menIcon;

                return (
                  <div key={gender}>
                    {groupIndex > 0 && (
                      <div style={{ height: '1px', backgroundColor: 'var(--color-separator)', marginBottom: '10px', marginTop: '16px' }} />
                    )}

                    <div className="mb-3">
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px' }}>
                        GROUP {groupLetter}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <img src={genderIcon} alt={genderLabel} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-md)', fontWeight: 'var(--font-semibold)' }}>
                        {genderLabel}
                      </span>
                    </div>

                    {items.map((item, itemIndex) => (
                      <div key={item.id}>
                        {/* ── Normal item row ── */}
                        {editingItemId !== item.id ? (
                          <div
                            className="flex items-start justify-between py-2 ml-1 cursor-pointer transition-opacity active:opacity-70"
                            onClick={() => setEditingItemId(item.id)}
                            style={{ borderBottom: itemIndex < items.length - 1 ? '1px solid var(--color-separator)' : 'none' }}
                          >
                            <div className="flex items-start gap-3">
                              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', minWidth: '24px' }}>
                                {item.menuItemId.slice(-4).replace(/\D/g, '').slice(0, 2) || '00'}
                              </span>
                              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>
                                {item.menuItemName}
                              </span>
                            </div>
                            <div className="flex items-center gap-3" style={{ flexShrink: 0, marginLeft: '16px' }}>
                              {item.quantity > 1 && (
                                <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.5 }}>
                                  x{item.quantity}
                                </span>
                              )}
                              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>
                                €{Number(item.menuItemPrice).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          // ── Inline edit controls ──
                          <div
                            className="flex items-center justify-between py-2 ml-1"
                            style={{
                              borderBottom: itemIndex < items.length - 1 ? '1px solid var(--color-separator)' : 'none',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', flex: 1, marginRight: '12px' }}>
                              {item.menuItemName}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditItem(item.orderId, item.id, item.quantity - 1)}
                                className="flex items-center justify-center border-none cursor-pointer"
                                style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--color-background)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 'var(--font-bold)', fontFamily: 'var(--font-family)' }}
                              >
                                −
                              </button>
                              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', minWidth: '20px', textAlign: 'center', fontFamily: 'var(--font-family)' }}>
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleEditItem(item.orderId, item.id, item.quantity + 1)}
                                className="flex items-center justify-center border-none cursor-pointer"
                                style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--color-background)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 'var(--font-bold)', fontFamily: 'var(--font-family)' }}
                              >
                                +
                              </button>
                              <button
                                onClick={() => handleEditItem(item.orderId, item.id, 0)}
                                className="border-none cursor-pointer"
                                style={{ fontSize: '11px', fontWeight: 'var(--font-medium)', fontFamily: 'var(--font-family)', color: 'var(--color-primary)', opacity: 0.4, background: 'transparent', padding: '0 4px' }}
                              >
                                Remove
                              </button>
                              <button
                                onClick={() => setEditingItemId(null)}
                                className="border-none cursor-pointer"
                                style={{ fontSize: '11px', fontWeight: 'var(--font-medium)', fontFamily: 'var(--font-family)', color: 'var(--color-primary)', opacity: 0.4, background: 'transparent', padding: '0 4px' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {items.some((i) => i.aiSuggested) && (
                      <div className="flex items-center gap-3 mt-4 p-4" style={{ backgroundColor: 'var(--color-green)', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontSize: '20px' }}>✦</span>
                        {items.filter((i) => i.aiSuggested).map((item) => (
                          <div key={item.id} className="flex flex-col">
                            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>
                              {item.menuItemName}
                            </span>
                            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-regular)' }}>
                              {Number(item.menuItemPrice).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
              Tap any item to edit its quantity or remove it from the order.
            </span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 mb-3" style={{ color: 'var(--color-error)', fontSize: '13px', fontWeight: 'var(--font-medium)' }}>
            {error}
          </div>
        )}

        {/* Process Order Button */}
        <button
          onClick={handleProcessOrder}
          disabled={isSending}
          className="w-full h-[52px] text-base cursor-pointer flex items-center justify-center transition-opacity duration-200 hover:opacity-90 disabled:opacity-80 disabled:cursor-not-allowed border-none mb-[5px]"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-white)', boxShadow: 'var(--shadow-button)', fontFamily: 'var(--font-family)', fontWeight: 'var(--font-semibold)', letterSpacing: '0.3px', borderRadius: 'var(--radius-md)' }}
        >
          {isSending ? (
            <div className="w-[22px] h-[22px] border-[2.5px] border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Process Order'
          )}
        </button>

        {/* Cleaning Request Button */}
        <button
          onClick={handleCleaningRequest}
          className="w-full h-[52px] text-base cursor-pointer flex items-center justify-center transition-opacity duration-200 hover:opacity-90 border-none mb-[36px]"
          style={{ backgroundColor: 'var(--color-cleaning)', color: 'var(--color-primary)', fontFamily: 'var(--font-family)', fontWeight: 'var(--font-semibold)', letterSpacing: '0.3px', borderRadius: 'var(--radius-md)' }}
        >
          Cleaning Request
        </button>

      </div>
    </div>
  );
}
