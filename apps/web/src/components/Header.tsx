// apps/web/src/components/Header.tsx
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.svg';

interface HeaderProps {
  userName?: string;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Header({ userName = 'User' }: HeaderProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Ignore network errors — always clear local state
    } finally {
      localStorage.clear();
      navigate('/login');
    }
  };

  return (
    <div
      className="flex items-center justify-between pt-5 pb-3"
      style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}
    >
      <img src={logo} alt="RestMentor" style={{ width: '189.89px' }} />
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-white)', fontWeight: 'var(--font-semibold)' }}
        >
          {getInitials(userName)}
        </div>
        <button
          onClick={handleLogout}
          title="Logout"
          className="bg-transparent border-none cursor-pointer p-1 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
