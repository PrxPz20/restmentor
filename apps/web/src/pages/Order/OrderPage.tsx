// restmentor/apps/web/src/pages/Order/OrderPage.tsx
import { API_BASE } from '../../config';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import Header from '../../components/Header';
import MenuBrowser from './components/MenuBrowser';
import SuggestionsBrowser from './components/SuggestionsBrowser';
import menIcon from '../../assets/men.png';
import femaleIcon from '../../assets/female.png';
import kidIcon from '../../assets/kid.png';
import aiSuggestionIcon from '../../assets/ai_suggestion_icon.png';

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
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [hasModifiedOrders, setHasModifiedOrders] = useState(false);
  const [suggestionsByGender, setSuggestionsByGender] = useState<Record<string, any[]>>({});
  const [loadingGenders, setLoadingGenders] = useState<Set<string>>(new Set());
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionGender, setActiveSuggestionGender] = useState<string | null>(null);
  const [guestEditorOpen, setGuestEditorOpen] = useState(false);
  const [guestCounts, setGuestCounts] = useState({ males: 0, females: 0, kids: 0 });
  const [localCounts, setLocalCounts] = useState({ males: 0, females: 0, kids: 0 });
  const [isUpdatingGuests, setIsUpdatingGuests] = useState(false);
  const [menu, setMenu] = useState<any[]>([]);
  const ignoringStatusChange = useRef(false);
  const initRef = useRef(false);

  const updateLocalCount = (key: string, delta: number) => {
    setLocalCounts(prev => ({
      ...prev,
      [key]: Math.max(0, prev[key as keyof typeof prev] + delta),
    }));
  };

  // Guard — redirect if no valid session
  if (!sessionId || sessionId === 'null') {
    return <Navigate to="/tables" replace />;
  }

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    loadSessionInfo();
    loadOrders();
    restoreSuggestions();
    loadMenu();

    // ── WebSocket: redirect if table status changes ───────
    let socketInstance: Socket | null = null;

    const initSocket = () => {
      let restaurantId = '';
      try {
        const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
        restaurantId = restaurant?.id ?? '';
      } catch { }

      if (!restaurantId) return;

      const socket = io(API_BASE || 'http://localhost:3001', {
        query: { restaurantId },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
      socketInstance = socket;
      socketRef.current = socket;

      socket.on('reconnect', () => {
        // Refresh orders after reconnect to catch any missed updates
        loadOrders();
      });

      socket.on('table:status_changed', async ({ tableId, newStatus }: { tableId: string; newStatus: string }) => {
        if (ignoringStatusChange.current) return;
        try {
          const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`, { credentials: 'include' });
          if (!res.ok) return;
          const data = await res.json();
          if (data.session.table_id === tableId && (newStatus === 'open' || newStatus === 'cleaning')) {
            navigate('/tables');
          }
        } catch { }
      });
    };

    initSocket();

    return () => { socketInstance?.disconnect(); };
  }, []);

  useEffect(() => {
    if (!editingItemId) return;
    function handleClickOutside() { setEditingItemId(null); }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingItemId]);

  const loadSessionInfo = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const sessionRes = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!sessionRes.ok) return;
      const sessionData = await sessionRes.json();
      const s = sessionData.session;
      setGuestCounts({
        males: s.guest_males ?? 0,
        females: s.guest_females ?? 0,
        kids: s.guest_kids ?? 0,
      });
      if (s.table_label) setTableLabel(s.table_label);
    } catch (err: any) {
      clearTimeout(timeout);
      // fail silently — session info is non-critical
    }
  };

  const loadOrders = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/orders`, {
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (response.status === 401) { localStorage.clear(); navigate('/login'); return; }

      const data = await response.json();
      setOrders(data.orders);

      if (data.orders.length === 0 || data.orders.every((o: OrderData) => o.status !== 'draft')) {
        await createNewOrder(); // returns order ID, does NOT call loadOrders again
      } else {
        const draft = data.orders.find((o: OrderData) => o.status === 'draft');
        if (draft) {
          setCurrentOrderId(draft.id);
          if (draft.items && draft.items.length > 0) setHasPendingChanges(true);
        }
      }

      const hasModified = data.orders.some((o: OrderData) => o.status === 'modified');
      setHasModifiedOrders(hasModified);

      setIsLoading(false);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        setError('Loading orders timed out. Please refresh.');
      } else {
        setError('Unable to load orders');
      }
      setIsLoading(false);
    }
  };

  const createNewOrder = async (): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/orders`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.status === 401) { localStorage.clear(); navigate('/login'); return null; }

      const data = await response.json();
      setCurrentOrderId(data.order.id);
      return data.order.id;
    } catch {
      setError('Failed to create order');
      return null;
    }
  };

  const handleAddItem = async (menuItemId: string, menuItemName?: string) => {
    if (!currentOrderId || !activeGender) return;

    try {
      const response = await fetch(`${API_BASE}/api/orders/${currentOrderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ menuItemId, genderTarget: activeGender, quantity: 1 }),
      });

      if (response.status === 409) {
        navigate('/tables');
        return;
      }

      setHasPendingChanges(true);
      await loadOrders();

      if (menuItemName && activeGender !== 'shared') {
        fetchSuggestions(activeGender, menuItemName);
      }
    } catch {
      setError('Failed to add item');
    }
  };

  const editTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const socketRef = useRef<Socket | null>(null);

  const handleEditItem = (orderId: string, itemId: string, newQuantity: number) => {
    // Optimistic UI update
    setOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      items: o.items
        .map(i => i.id === itemId ? { ...i, quantity: newQuantity } : i)
        .filter(i => i.quantity > 0),
    } : o));

    setHasPendingChanges(true);

    // Debounce actual API call by 400ms
    if (editTimers.current[itemId]) clearTimeout(editTimers.current[itemId]);
    editTimers.current[itemId] = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/api/orders/${orderId}/items/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ quantity: newQuantity }),
        });
        await loadOrders();
      } catch {
        setError('Failed to update item');
        await loadOrders();
      }
    }, 400);
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
    if (!currentOrderId) return;

    if (allItems.length === 0 && !hasModifiedOrders) {
      setError('Add some items before processing the order');
      return;
    }

    setIsSending(true);
    setError('');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${API_BASE}/api/orders/${currentOrderId}/send`, {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to send order');
        setIsSending(false);
        return;
      }

      setHasPendingChanges(false);
      setSuggestionsByGender({});
      fetch(`${API_BASE}/api/sessions/${sessionId}/suggestions`, {
        method: 'DELETE',
        credentials: 'include',
      }).catch(() => { });
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
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        setError('Order timed out. Please try again.');
      } else {
        setError('Unable to send order');
      }
      setIsSending(false);
    }
  };

  const handleMarkAsPaid = () => {
    navigate(`/sessions/${sessionId}/confirm-payment`);
  };

  const handleCleaningRequest = async () => {
    try {
      const sessionRes = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
        credentials: 'include',
      });

      if (!sessionRes.ok) return;
      const sessionData = await sessionRes.json();
      const tableId = sessionData.session.table_id;

      ignoringStatusChange.current = true;
      await fetch(`${API_BASE}/api/tables/${tableId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'cleaning' }),
      });

      navigate(`/tables/${tableId}/cleaning`);
    } catch {
      setError('Failed to send cleaning request');
      ignoringStatusChange.current = false;
    }
  };

  const handleAddAISuggestedItem = async (menuItemId: string, _menuItemName: string, quantity: number) => {
    if (!currentOrderId || !activeSuggestionGender) return;
    try {
      await fetch(`${API_BASE}/api/orders/${currentOrderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          menuItemId,
          genderTarget: activeSuggestionGender,
          quantity,
          aiSuggested: true,
        }),
      });
      setHasPendingChanges(true);
      await loadOrders();
    } catch {
      setError('Failed to add suggested item');
    }
  };

  const handleConfirmGuests = async (newCounts: { males: number; females: number; kids: number }) => {
    if (!sessionId) return;
    setIsUpdatingGuests(true);
    try {
      // Update guest counts
      await fetch(`${API_BASE}/api/sessions/${sessionId}/guests`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          guestMales: newCounts.males,
          guestFemales: newCounts.females,
          guestKids: newCounts.kids,
        }),
      });

      // Re-init AI with new counts
      await fetch(`${API_BASE}/api/sessions/${sessionId}/ai-init`, {
        method: 'POST',
        credentials: 'include',
      });

      // Clear stale suggestions
      await fetch(`${API_BASE}/api/sessions/${sessionId}/suggestions`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setSuggestionsByGender({});

      // Update local counts
      setGuestCounts(newCounts);
      setGuestEditorOpen(false);

      // Fire background suggestions for genders that already have items
      const gendersWithItems = Object.keys(groupedByGender);
      gendersWithItems.forEach(gender => {
        const items = groupedByGender[gender];
        if (items && items.length > 0) {
          const lastItem = items[items.length - 1];
          fetchSuggestions(gender, lastItem.menuItemName);
        }
      });
    } catch {
      setError('Failed to update guests');
    } finally {
      setIsUpdatingGuests(false);
    }
  };

  const loadMenu = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/menu`, { credentials: 'include' });
      if (response.status === 401) { localStorage.clear(); navigate('/login'); return; }
      const data = await response.json();
      setMenu(data.menu ?? []);
    } catch {
      // fail silently — menu will retry when browser opens
    }
  };

  const restoreSuggestions = async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/suggestions`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (Object.keys(data.suggestionsByGender ?? {}).length > 0) {
          setSuggestionsByGender(data.suggestionsByGender);
        }
      }
    } catch {
      // fail silently
    }
  };

  const fetchSuggestions = async (genderTarget: string, lastAddedItemName: string, isRetry = false) => {
    if (!sessionId || genderTarget === 'shared') return;
    setLoadingGenders(prev => new Set(prev).add(genderTarget));
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ genderTarget, lastAddedItemName }),
      });
      if (response.ok) {
        const data = await response.json();
        const suggestions = data.suggestions ?? [];

        if (suggestions.length === 0 && !isRetry) {
          await fetch(`${API_BASE}/api/sessions/${sessionId}/ai-init`, {
            method: 'POST',
            credentials: 'include',
          });
          await fetchSuggestions(genderTarget, lastAddedItemName, true);
          return;
        }

        setSuggestionsByGender(prev => ({
          ...prev,
          [genderTarget]: suggestions,
        }));
      }
    } catch {
      // fail silently — suggestions are a bonus
    } finally {
      setLoadingGenders(prev => { const next = new Set(prev); next.delete(genderTarget); return next; });
    }
  };

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

  const GENDER_ORDER = ['male', 'female', 'kid'];
  const sortedGenderKeys = Object.keys(groupedByGender).sort((a, b) => {
    return GENDER_ORDER.indexOf(a) - GENDER_ORDER.indexOf(b);
  });

  const sortedGroupedByGender: Record<string, typeof genderedItems> = {};
  sortedGenderKeys.forEach((key) => {
    sortedGroupedByGender[key] = groupedByGender[key]!;
  });

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>
        <div className="w-[22px] h-[22px] border-[2.5px] rounded-full animate-spin" style={{ borderColor: 'rgba(3, 40, 19, 0.2)', borderTopColor: 'var(--color-primary)' }} />
      </main>
    );
  }

  const activeSuggestionGroupLetter = activeSuggestionGender
    ? String.fromCharCode(65 + sortedGenderKeys.indexOf(activeSuggestionGender))
    : 'A';

  const totalLocal = localCounts.males + localCounts.females + localCounts.kids;

  const guestEditorOverlay = guestEditorOpen ? (
    <div className="fixed inset-0 flex flex-col" style={{ zIndex: 50, fontFamily: 'var(--font-family)' }}>
      <div className="shrink-0" style={{ paddingTop: 'calc(var(--section-top) + 60px)', backgroundColor: 'rgba(238, 238, 238, 0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} />
      <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--color-white)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
        <div className="flex items-center justify-between shrink-0" style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingTop: '20px', paddingBottom: '16px' }}>
          <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'var(--font-semibold)', letterSpacing: '0.5px' }}>EDIT GUESTS</span>
          <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'var(--font-semibold)', letterSpacing: '0.5px', opacity: 0.5 }}>{tableLabel}</span>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
          <div style={{ border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            {[
              { key: 'males', label: 'Male', icon: menIcon },
              { key: 'females', label: 'Female', icon: femaleIcon },
              { key: 'kids', label: 'Kid', icon: kidIcon },
            ].map((g, i, arr) => (
              <div key={g.key} style={{ padding: '16px', borderBottom: i < arr.length - 1 ? '1px solid var(--color-separator)' : 'none' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={g.icon} alt={g.label} width="24" height="24" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                    <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase' }}>{g.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateLocalCount(g.key, -1)} className="flex items-center justify-center border-none cursor-pointer" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-green)', color: 'var(--color-primary)', fontSize: '18px', fontWeight: 'var(--font-regular)', fontFamily: 'var(--font-family)' }}>−</button>
                    <span style={{ color: 'var(--color-primary)', fontSize: '16px', fontWeight: 'var(--font-regular)', minWidth: '20px', textAlign: 'center' }}>{localCounts[g.key as keyof typeof localCounts]}</span>
                    <button onClick={() => updateLocalCount(g.key, 1)} className="flex items-center justify-center border-none cursor-pointer" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-green)', color: 'var(--color-primary)', fontSize: '18px', fontWeight: 'var(--font-regular)', fontFamily: 'var(--font-family)' }}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingTop: '16px', paddingBottom: '36px' }}>
          <button
            onClick={() => handleConfirmGuests(localCounts)}
            disabled={isUpdatingGuests || totalLocal === 0}
            className="w-full h-[52px] text-base flex items-center justify-center border-none mb-[4px] transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-white)', fontFamily: 'var(--font-family)', fontWeight: 'var(--font-semibold)', letterSpacing: '0.3px', borderRadius: 'var(--radius-md)', boxShadow: totalLocal > 0 ? 'var(--shadow-button)' : 'none', opacity: totalLocal > 0 && !isUpdatingGuests ? 1 : 0.35, cursor: totalLocal > 0 && !isUpdatingGuests ? 'pointer' : 'not-allowed' }}
          >
            {isUpdatingGuests ? (
              <div className="w-[22px] h-[22px] border-[2.5px] border-white/30 border-t-white rounded-full animate-spin" />
            ) : 'Confirm Guests'}
          </button>
          <button
            onClick={() => setGuestEditorOpen(false)}
            className="w-full py-2 bg-transparent border-none cursor-pointer hover:opacity-70 transition-opacity flex items-center justify-center gap-1.5"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family)', fontSize: '14px', fontWeight: 'var(--font-medium)', opacity: 0.5 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Cancel
            <span style={{ width: '14px', flexShrink: 0 }} />
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const activeSuggestionFiltered = activeSuggestionGender
    ? (suggestionsByGender[activeSuggestionGender] ?? []).filter(
      (s: any) => !new Set(allItems.map(i => i.menuItemId)).has(s.itemId)
    )
    : [];

  const suggestionsOverlay = suggestionsOpen && activeSuggestionGender ? (
    <SuggestionsBrowser
      suggestions={activeSuggestionFiltered}
      groupLetter={activeSuggestionGroupLetter}
      onAddItem={handleAddAISuggestedItem}
      onClose={() => { setSuggestionsOpen(false); setActiveSuggestionGender(null); }}
    />
  ) : null;

  const genderItems: Record<string, number> = activeGender && activeGender !== 'shared'
    ? allItems
      .filter(i => i.genderTarget === activeGender)
      .reduce((acc, i) => ({ ...acc, [i.menuItemId]: (acc[i.menuItemId] ?? 0) + i.quantity }), {} as Record<string, number>)
    : activeGender === 'shared'
      ? allItems
        .filter(i => i.genderTarget === 'shared')
        .reduce((acc, i) => ({ ...acc, [i.menuItemId]: (acc[i.menuItemId] ?? 0) + i.quantity }), {} as Record<string, number>)
      : {};

  const menuOverlay = menuOpen && activeGender ? (
    <MenuBrowser
      activeGender={activeGender}
      onSelectItem={(id, name) => handleAddItem(id, name)}
      onClose={() => { setMenuOpen(false); setActiveGender(null); }}
      onSwitchGender={(g) => setActiveGender(g)}
      genderItems={genderItems}
      menu={menu}
    />
  ) : null;

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--color-background)', fontFamily: 'var(--font-family)' }}>

      {guestEditorOverlay}
      {suggestionsOverlay}
      {menuOverlay}

      <Header userName={user.name} />

      <div style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingTop: 'var(--section-top)' }}>

        {/* Subheader */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => { setLocalCounts({ ...guestCounts }); setGuestEditorOpen(true); }}
            className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer hover:opacity-70 transition-opacity active:opacity-50 p-0"
          >
            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>Order</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={() => navigate('/tables')}
            className="flex items-center gap-1 bg-transparent border-none cursor-pointer hover:opacity-70 transition-opacity active:opacity-50"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.5, padding: 0 }}
          >
            {tableLabel}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
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
                style={{ backgroundColor: 'var(--color-green)', borderRadius: 'var(--radius-sm)', height: '110px' }}
              >
                {editingItemId === item.id ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditItem(item.orderId, item.id, item.quantity - 1); }}
                        className="flex items-center justify-center border-none cursor-pointer"
                        style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.7)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 'var(--font-bold)', fontFamily: 'var(--font-family)' }}
                      >−</button>
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-md)', fontWeight: 'var(--font-bold)', minWidth: '20px', textAlign: 'center', fontFamily: 'var(--font-family)' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditItem(item.orderId, item.id, item.quantity + 1); }}
                        className="flex items-center justify-center border-none cursor-pointer"
                        style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.7)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 'var(--font-bold)', fontFamily: 'var(--font-family)' }}
                      >+</button>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditItem(item.orderId, item.id, 0); }}
                      className="border-none cursor-pointer"
                      style={{ fontSize: '11px', fontWeight: 'var(--font-medium)', fontFamily: 'var(--font-family)', color: 'var(--color-primary)', opacity: 0.5, background: 'transparent', padding: 0 }}
                    >Remove</button>
                  </div>
                ) : (
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
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-regular)' }}>x{item.quantity}</span>
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-regular)' }}>€{Number(item.menuItemPrice).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            ))}

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
            {([
              { key: 'male' as GenderTarget, label: 'Male', icon: menIcon },
              { key: 'female' as GenderTarget, label: 'Female', icon: femaleIcon },
              { key: 'kid' as GenderTarget, label: 'Kid', icon: kidIcon },
            ]).map((gender) => (
              <button
                key={gender.key}
                onClick={() => handleGenderTap(gender.key)}
                className="flex flex-col items-center justify-center gap-2 py-4 border-none cursor-pointer transition-transform active:scale-95"
                style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', fontFamily: 'var(--font-family)' }}
              >
                <img src={gender.icon} alt={gender.label} width="28" height="28" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
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
                    <div className="flex items-center justify-between mb-3">
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px' }}>
                        GROUP {groupLetter}
                      </span>
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-light)', opacity: 0.3 }}>
                        €{items.reduce((sum, i) => sum + Number(i.menuItemPrice) * i.quantity, 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <img src={genderIcon} alt={genderLabel} width="28" height="28" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-md)', fontWeight: 'var(--font-semibold)' }}>{genderLabel}</span>
                    </div>

                    {items.map((item, itemIndex) => (
                      <div key={item.id}>
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
                              <span className="flex items-center gap-1">
                                <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' }}>
                                  {item.menuItemName}
                                </span>
                                {item.aiSuggested && (
                                  <span className="flex items-center gap-0.5" style={{ backgroundColor: 'var(--color-green)', borderRadius: '4px', padding: '1px 5px' }}>
                                    <svg viewBox="0 0 24 24" width="8" height="8" style={{ flexShrink: 0 }}>
                                      <path d="M12 0 C12 0 13.5 8.5 24 12 C13.5 15.5 12 24 12 24 C12 24 10.5 15.5 0 12 C10.5 8.5 12 0 12 0Z" fill="#032813" />
                                    </svg>
                                    <span style={{ color: 'var(--color-primary)', fontSize: '9px', fontWeight: 'var(--font-semibold)', letterSpacing: '0.3px' }}>AI</span>
                                  </span>
                                )}
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
                          <div
                            className="flex items-center justify-between py-2 ml-1"
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{ borderBottom: itemIndex < items.length - 1 ? '1px solid var(--color-separator)' : 'none', borderRadius: 'var(--radius-sm)' }}
                          >
                            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', flex: 1, marginRight: '12px' }}>
                              {item.menuItemName}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditItem(item.orderId, item.id, item.quantity - 1)}
                                className="flex items-center justify-center border-none cursor-pointer"
                                style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--color-background)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 'var(--font-bold)', fontFamily: 'var(--font-family)' }}
                              >−</button>
                              <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', minWidth: '20px', textAlign: 'center', fontFamily: 'var(--font-family)' }}>
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleEditItem(item.orderId, item.id, item.quantity + 1)}
                                className="flex items-center justify-center border-none cursor-pointer"
                                style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--color-background)', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 'var(--font-bold)', fontFamily: 'var(--font-family)' }}
                              >+</button>
                              <button
                                onClick={() => handleEditItem(item.orderId, item.id, 0)}
                                className="border-none cursor-pointer flex items-center justify-center"
                                style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--color-background)', color: 'var(--color-error)', opacity: 0.7, border: 'none', cursor: 'pointer', flexShrink: 0 }}
                                title="Remove item"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setEditingItemId(null)}
                                className="border-none cursor-pointer flex items-center justify-center"
                                style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--color-background)', color: 'var(--color-primary)', opacity: 0.5, border: 'none', cursor: 'pointer', flexShrink: 0 }}
                                title="Cancel"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {(() => {
                      const orderedMenuItemIds = new Set(allItems.map(i => i.menuItemId));
                      const groupSuggestions = (suggestionsByGender[gender] ?? []).filter(
                        (s: any) => !orderedMenuItemIds.has(s.itemId)
                      );
                      const isLoading = loadingGenders.has(gender);
                      if (groupSuggestions.length === 0 && !isLoading) return null;
                      return (
                        <div
                          className="flex items-center mt-4 p-4"
                          style={{ backgroundColor: 'var(--color-green)', borderRadius: 'var(--radius-sm)', alignItems: 'center', justifyContent: 'space-between', cursor: isLoading ? 'default' : 'pointer' }}
                          onClick={() => { if (!isLoading && groupSuggestions.length > 0) { setActiveSuggestionGender(gender); setSuggestionsOpen(true); } }}
                        >
                          {isLoading ? (
                            <>
                              <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0 }}>
                                <span style={{ position: 'absolute', top: 0, left: 0, width: '22px', height: '22px', animation: 'sparkle-main 1.8s ease-in-out infinite' }}>
                                  <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 0 C12 0 13.5 8.5 24 12 C13.5 15.5 12 24 12 24 C12 24 10.5 15.5 0 12 C10.5 8.5 12 0 12 0Z" fill="#032813" /></svg>
                                </span>
                                <span style={{ position: 'absolute', bottom: '2px', right: 0, width: '16px', height: '16px', animation: 'sparkle-small-1 1.8s ease-in-out infinite 0.3s' }}>
                                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 0 C12 0 13.5 8.5 24 12 C13.5 15.5 12 24 12 24 C12 24 10.5 15.5 0 12 C10.5 8.5 12 0 12 0Z" fill="#032813" /></svg>
                                </span>
                                <span style={{ position: 'absolute', top: '4px', right: '2px', width: '10px', height: '10px', animation: 'sparkle-small-2 1.8s ease-in-out infinite 0.6s' }}>
                                  <svg viewBox="0 0 24 24" width="10" height="10"><path d="M12 0 C12 0 13.5 8.5 24 12 C13.5 15.5 12 24 12 24 C12 24 10.5 15.5 0 12 C10.5 8.5 12 0 12 0Z" fill="#032813" /></svg>
                                </span>
                              </div>
                              <div style={{ flex: 1, display: 'flex', gap: '24px', paddingLeft: '16px' }}>
                                {[0, 1].map((i) => (
                                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                                    <div style={{ height: '12px', borderRadius: '6px', background: 'linear-gradient(90deg, rgba(3,40,19,0.08) 25%, rgba(3,40,19,0.15) 50%, rgba(3,40,19,0.08) 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.6s infinite linear', width: i === 0 ? '80%' : '70%' }} />
                                    <div style={{ height: '10px', borderRadius: '6px', background: 'linear-gradient(90deg, rgba(3,40,19,0.08) 25%, rgba(3,40,19,0.15) 50%, rgba(3,40,19,0.08) 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.6s infinite linear', width: i === 0 ? '40%' : '35%' }} />
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              <img src={aiSuggestionIcon} alt="AI" width="36" height="36" style={{ width: '36px', height: '36px', objectFit: 'contain', flexShrink: 0, animation: 'fadeSlideUp 0.4s ease-out' }} />
                              <div style={{ animation: 'fadeSlideUp 0.4s ease-out 0.1s both', display: 'flex', flex: 1, gap: '16px', paddingLeft: '16px' }}>
                                {groupSuggestions.slice(0, 2).map((s: any) => (
                                  <div key={s.itemId} className="flex flex-col" style={{ flex: 1 }}>
                                    <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'var(--font-regular)' }}>{s.itemName}</span>
                                    <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'var(--font-light)' }}>€{Number(s.price).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
              {/* Shared + Grand Total */}
              {(() => {
                const sharedTotal = sharedItems.reduce((sum, i) => sum + Number(i.menuItemPrice) * i.quantity, 0);
                const genderedTotal = genderedItems.reduce((sum, i) => sum + Number(i.menuItemPrice) * i.quantity, 0);
                const grandTotal = sharedTotal + genderedTotal;
                if (grandTotal === 0) return null;
                return (
                  <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-separator)', paddingTop: '12px' }}>
                    {sharedTotal > 0 && (
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.5 }}>Shared</span>
                        <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.5 }}>€{sharedTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>Total</span>
                      <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>€{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Process Order Button */}
        <button
          onClick={handleProcessOrder}
          disabled={isSending || (!hasPendingChanges && !hasModifiedOrders)}
          className="w-full h-[52px] text-base flex items-center justify-center transition-opacity duration-200 border-none mb-[5px]"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-white)',
            boxShadow: hasPendingChanges ? 'var(--shadow-button)' : 'none',
            fontFamily: 'var(--font-family)',
            fontWeight: 'var(--font-semibold)',
            letterSpacing: '0.3px',
            borderRadius: 'var(--radius-md)',
            opacity: (hasPendingChanges || hasModifiedOrders) && !isSending ? 1 : 0.4,
            cursor: (hasPendingChanges || hasModifiedOrders) && !isSending ? 'pointer' : 'not-allowed',
          }}
        >
          {isSending ? (
            <div className="w-[22px] h-[22px] border-[2.5px] border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Process Order'
          )}
        </button>

        {/* Mark as Paid Button — only show when there are sent orders */}
        {allItems.length > 0 && (
          <button
            onClick={handleMarkAsPaid}
            className="w-full h-[52px] text-base cursor-pointer flex items-center justify-center transition-opacity duration-200 hover:opacity-90 border-none mb-[5px]"
            style={{ backgroundColor: 'var(--color-paid)', color: 'var(--color-primary)', fontFamily: 'var(--font-family)', fontWeight: 'var(--font-semibold)', letterSpacing: '0.3px', borderRadius: 'var(--radius-md)' }}
          >
            Mark as Paid
          </button>
        )}

        {/* Cleaning Request Button */}
        <button
          onClick={handleCleaningRequest}
          className="w-full h-[52px] text-base cursor-pointer flex items-center justify-center transition-opacity duration-200 hover:opacity-90 border-none mb-[36px]"
          style={{ backgroundColor: 'var(--color-cleaning)', color: 'var(--color-primary)', fontFamily: 'var(--font-family)', fontWeight: 'var(--font-semibold)', letterSpacing: '0.3px', borderRadius: 'var(--radius-md)' }}
        >
          Cleaning Request
        </button>

      </div>
    </main>
  );
}
