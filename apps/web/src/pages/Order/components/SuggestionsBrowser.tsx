// restmentor/apps/web/src/pages/Order/components/SuggestionsBrowser.tsx
import { useState, useEffect } from 'react';

interface Suggestion {
  itemId: string;
  itemName: string;
  price: string;
  target: string;
  reasons: string[];
}

interface SuggestionsBrowserProps {
  suggestions: Suggestion[];
  groupLetter: string;
  onAddItem: (menuItemId: string, menuItemName: string, quantity: number) => void;
  onClose: () => void;
}

export default function SuggestionsBrowser({
  suggestions,
  groupLetter,
  onAddItem,
  onClose,
}: SuggestionsBrowserProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(suggestions.map(s => [s.itemId, 0]))
  );

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const updateQuantity = (itemId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] ?? 0) + delta),
    }));
  };

  const handleConfirm = () => {
    suggestions.forEach(s => {
      const qty = quantities[s.itemId] ?? 0;
      if (qty > 0) onAddItem(s.itemId, s.itemName, qty);
    });
    onClose();
  };

  const totalSelected = Object.values(quantities).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ zIndex: 50, fontFamily: 'var(--font-family)' }}>

      {/* Frosted glass top area — larger, no text */}
<div
        className="shrink-0"
        style={{
          paddingTop: 'calc(var(--section-top) + 60px)',
          backgroundColor: 'rgba(238, 238, 238, 0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      />

      {/* White content sheet */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          backgroundColor: 'var(--color-white)',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)',
        }}
      >
        {/* Header inside white sheet */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            paddingLeft: 'var(--page-padding)',
            paddingRight: 'var(--page-padding)',
            paddingTop: '20px',
            paddingBottom: '16px',
          }}
        >
          <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'var(--font-semibold)', letterSpacing: '0.5px' }}>
            GROUP {groupLetter}
          </span>
          <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'var(--font-semibold)', letterSpacing: '0.5px', opacity: 0.5 }}>
            SUGGESTIONS
          </span>
        </div>

        {/* Scrollable list */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}
        >
          <div style={{ border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            {suggestions.map((s, index) => (
              <div key={s.itemId}>
                <div style={{ padding: '16px' }}>
                  {/* Name + price */}
                  <div className="flex items-start justify-between mb-3">
                    <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', flex: 1, marginRight: '16px' }}>
                      {s.itemName}
                    </span>
                    <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'var(--font-semibold)', flexShrink: 0 }}>
                      {Number(s.price).toFixed(2)}
                    </span>
                  </div>

                  {/* Reasons */}
                  <div className="flex flex-col gap-1 mb-4">
                    {s.reasons.map((reason, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'var(--font-semibold)', minWidth: '20px', opacity: 0.4 }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase', lineHeight: 1.4 }}>
                          {reason}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => updateQuantity(s.itemId, -1)}
                      className="flex items-center justify-center border-none cursor-pointer"
                      style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-green)', color: 'var(--color-primary)', fontSize: '18px', fontWeight: 'var(--font-regular)', fontFamily: 'var(--font-family)' }}
                    >−</button>
                    <span style={{ color: 'var(--color-primary)', fontSize: '16px', fontWeight: 'var(--font-regular)', minWidth: '20px', textAlign: 'center', fontFamily: 'var(--font-family)' }}>
                      {quantities[s.itemId] ?? 0}
                    </span>
                    <button
                      onClick={() => updateQuantity(s.itemId, 1)}
                      className="flex items-center justify-center border-none cursor-pointer"
                      style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-green)', color: 'var(--color-primary)', fontSize: '18px', fontWeight: 'var(--font-regular)', fontFamily: 'var(--font-family)' }}
                    >+</button>
                  </div>
                </div>

                {index < suggestions.length - 1 && (
                  <div style={{ height: '1px', backgroundColor: 'var(--color-separator)' }} />
                )}
              </div>
            ))}
          </div>
        </div>

{/* Bottom buttons */}
        <div style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingTop: '16px', paddingBottom: '36px' }}>
<button
            onClick={totalSelected > 0 ? handleConfirm : undefined}
            className="w-full h-[52px] text-base flex items-center justify-center border-none mb-[4px] transition-opacity"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-white)',
              fontFamily: 'var(--font-family)',
              fontWeight: 'var(--font-semibold)',
              letterSpacing: '0.3px',
              borderRadius: 'var(--radius-md)',
              opacity: totalSelected > 0 ? 1 : 0.35,
              cursor: totalSelected > 0 ? 'pointer' : 'not-allowed',
              boxShadow: totalSelected > 0 ? 'var(--shadow-button)' : 'none',
            }}
          >
            Add {totalSelected > 0 ? totalSelected : ''} {totalSelected > 1 ? 'Items' : 'Item'} to Order
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 bg-transparent border-none cursor-pointer hover:opacity-70 transition-opacity flex items-center justify-center gap-1.5"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family)', fontSize: '14px', fontWeight: 'var(--font-medium)', opacity: 0.5 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
        
        </div>

      </div>
    </div>
  );
}
