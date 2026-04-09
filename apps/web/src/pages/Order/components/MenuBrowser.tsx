import { API_BASE } from '../../../config';
// restmentor/apps/web/src/pages/Order/components/MenuBrowser.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  addedItemIds: string[];
}

const GENDER_CONFIG = [
  { key: 'male' as GenderTarget, label: 'Male', icon: menIcon },
  { key: 'female' as GenderTarget, label: 'Female', icon: femaleIcon },
  { key: 'kid' as GenderTarget, label: 'Kid', icon: kidIcon },
];

export default function MenuBrowser({ activeGender, onSelectItem, onClose, onSwitchGender, addedItemIds }: MenuBrowserProps) {
  const [menu, setMenu] = useState<MenuCategoryData[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/menu`, {
        credentials: 'include',
      });

      if (response.status === 401) { localStorage.clear(); navigate('/login'); return; }

      const data = await response.json();
      setMenu(data.menu);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
    }
  };

const handleItemTap = (itemId: string, itemName: string) => {
    onSelectItem(itemId, itemName);
  };

  const toggleCategory = (catId: string) => {
    setExpandedCategory(expandedCategory === catId ? null : catId);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 50 }}>
        <div className="w-[22px] h-[22px] border-[2.5px] rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'var(--color-white)' }} />
      </div>
    );
  }

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
              <img src={g.icon} alt={g.label} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
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

        {/* Menu Accordion */}
        <div className="pb-10" style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
          {menu.map((category) => {
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
                          backgroundColor: addedItemIds.includes(item.id) ? 'var(--color-green)' : 'transparent',
                          borderRadius: addedItemIds.includes(item.id) ? 'var(--radius-sm)' : '0',
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
                          {addedItemIds.includes(item.id) && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
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
