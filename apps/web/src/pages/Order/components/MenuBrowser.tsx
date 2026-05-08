// restmentor/apps/web/src/pages/Order/components/MenuBrowser.tsx
import { useState } from 'react';
import menIcon from '../../../assets/men.png';
import femaleIcon from '../../../assets/female.png';
import kidIcon from '../../../assets/kid.png';

type GenderTarget = 'male' | 'female' | 'kid' | 'shared';

interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  price: string;
  destination: string;
}

interface MenuCategoryData {
  id: string;
  name: string;
  sort_order: number;
  items: MenuItemData[];
}

interface MenuBrowserProps {
  activeGender: GenderTarget;
  onSelectItem: (menuItemId: string, menuItemName: string) => void;
  onClose: () => void;
  onSwitchGender: (gender: GenderTarget) => void;
  genderItems: Record<string, number>;
  menu: MenuCategoryData[];
}

const GENDER_CONFIG = [
  { key: 'male' as GenderTarget, label: 'Male', icon: menIcon },
  { key: 'female' as GenderTarget, label: 'Female', icon: femaleIcon },
  { key: 'kid' as GenderTarget, label: 'Kid', icon: kidIcon },
];

export default function MenuBrowser({ activeGender, onSelectItem, onClose, onSwitchGender, genderItems, menu }: MenuBrowserProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleItemTap = (itemId: string, itemName: string) => {
    onSelectItem(itemId, itemName);
  };

  const toggleCategory = (catId: string) => {
    setExpandedCategory(expandedCategory === catId ? null : catId);
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ zIndex: 50 }}>

      {/* Gender Toggle - frosted glass area */}
      {activeGender !== 'shared' ? (
        <div
          className="grid grid-cols-3 gap-3 pt-5 pb-3 shrink-0"
          style={{
            paddingLeft: 'var(--page-padding)',
            paddingRight: 'var(--page-padding)',
            backgroundColor: 'rgba(238, 238, 238, 0.4)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {GENDER_CONFIG.map((g) => (
            <button
              key={g.key}
              onClick={() => onSwitchGender(g.key)}
              className="flex flex-col items-center justify-center gap-2 py-3 border-none cursor-pointer transition-all"
              style={{
                backgroundColor: activeGender === g.key ? 'var(--color-green)' : 'var(--color-white)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-family)',
              }}
            >
              <img src={g.icon} alt={g.label} width="28" height="28" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
              <span style={{
                color: 'var(--color-primary)',
                fontSize: 'var(--text-md)',
                fontWeight: activeGender === g.key ? 'var(--font-medium)' : 'var(--font-light)',
              }}>
                {g.label}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div
          className="flex items-center justify-center pt-5 pb-3 shrink-0"
          style={{
            backgroundColor: 'rgba(238, 238, 238, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', opacity: 0.6 }}>Adding shared items for the table</span>
        </div>
      )}

      {/* White sheet with rounded top corners */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          backgroundColor: 'var(--color-white)',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)',
        }}
      >
        {/* Subheader */}
        <div className="flex items-center justify-between pt-5 pb-4" style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
          <button
            onClick={onClose}
            className="flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            NEW ORDER
          </button>
          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase' }}>
            {activeGender === 'shared' ? 'SHARED' : activeGender}
          </span>
        </div>

        {/* Search Bar */}
        <div style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingBottom: '12px' }}>
          <div className="flex items-center gap-2 px-3" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-sm)', height: '42px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu..."
              autoComplete="off"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                color: 'var(--color-primary)',
                fontFamily: 'var(--font-family)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-regular)',
              }}
            />
            {searchQuery.length > 0 && (
              <button
                onClick={() => setSearchQuery('')}
                className="flex items-center justify-center border-none cursor-pointer bg-transparent p-0"
                style={{ opacity: 0.4 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Menu Accordion */}
        <div className="pb-10" style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
          {searchQuery.trim().length > 0 ? (
            // ── Search results ─────────────────────────────
            (() => {
              const q = searchQuery.toLowerCase();
              const results = menu.flatMap(cat =>
                cat.items
                  .filter(item => item.name.toLowerCase().includes(q))
                  .map(item => ({ ...item, categoryName: cat.name }))
              );
              if (results.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-10">
                    <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.4 }}>No items found</span>
                    <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.3, marginTop: '4px' }}>Try a different search</span>
                  </div>
                );
              }
              return (
                <div style={{ border: '1px solid #707070', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  {results.map((item, index) => (
                    <button
                      key={item.id}
                      onClick={() => handleItemTap(item.id, item.name)}
                      className="w-full flex items-start justify-between py-4 px-5 border-none cursor-pointer text-left transition-all active:scale-[0.98]"
                      style={{
                        fontFamily: 'var(--font-family)',
                        borderBottom: index < results.length - 1 ? '1px solid var(--color-separator)' : 'none',
                        backgroundColor: genderItems[item.id] ? 'var(--color-green)' : 'transparent',
                      }}
                    >
                      <div className="flex flex-col">
                        <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase' }}>{item.name}</span>
                        <span style={{ color: 'var(--color-primary)', fontSize: '11px', fontWeight: 'var(--font-light)', opacity: 0.4, marginTop: '2px' }}>{item.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-2" style={{ flexShrink: 0, marginLeft: '16px' }}>
                        {genderItems[item.id] && (
                          <span style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-white)', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', fontWeight: 'var(--font-semibold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {genderItems[item.id]}
                          </span>
                        )}
                        <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-regular)' }}>€{Number(item.price).toFixed(2)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()
          ) : menu.map((category) => {
            const isExpanded = expandedCategory === category.id;

            return (
              <div key={category.id} className="mb-2">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between px-5 py-4 cursor-pointer bg-transparent"
                  style={{
                    fontFamily: 'var(--font-family)',
                    border: '1px solid #707070',
                    borderRadius: isExpanded ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
                  }}
                >
                  <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {category.name}
                  </span>
                  <span style={{ color: 'var(--color-primary)', fontSize: '18px', fontWeight: 'var(--font-light)', lineHeight: 1 }}>
                    {isExpanded ? '−' : '+'}
                  </span>
                </button>

                {/* Category Items */}
                {isExpanded && (
                  <div className="px-5 pt-2 pb-2 mt-[-4px]" style={{ border: '1px solid #707070', borderTop: 'none', borderBottomLeftRadius: 'var(--radius-sm)', borderBottomRightRadius: 'var(--radius-sm)' }}>
                    {category.items.map((item, index) => (
                      <button
                        key={item.id}
                        onClick={() => handleItemTap(item.id, item.name)}
                        className="w-full flex items-start justify-between py-4 border-none cursor-pointer text-left transition-all active:scale-[0.98]"
                        style={{
                          fontFamily: 'var(--font-family)',
                          borderBottom: index < category.items.length - 1 ? '1px solid var(--color-separator)' : 'none',
                          backgroundColor: genderItems[item.id] ? 'var(--color-green)' : 'transparent',
                          borderRadius: genderItems[item.id] ? 'var(--radius-sm)' : '0',
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-regular)', opacity: 0.5, minWidth: '20px' }}>
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <div className="flex flex-col">
                            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', textTransform: 'uppercase' }}>
                              {item.name}
                            </span>
                            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', opacity: 0.5, marginTop: '2px' }}>
                              {item.description || 'No allergens'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2" style={{ flexShrink: 0, marginLeft: '16px' }}>
                          {genderItems[item.id] && (
                            <span style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-white)', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', fontWeight: 'var(--font-semibold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {genderItems[item.id]}
                            </span>
                          )}
                          <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-regular)' }}>
                            €{Number(item.price).toFixed(2)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
