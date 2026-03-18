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
  return (
    <div className="flex items-center justify-between pt-5 pb-3" style={{ paddingLeft: '36px', paddingRight: '36px' }}>
      <img src={logo} alt="RestMentor" style={{ width: '189.89px' }} />
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
          style={{ backgroundColor: '#032813', color: '#FFFFFF' }}
        >
          {getInitials(userName)}
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#032813" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      </div>
    </div>
  );
}
