import { useState } from 'react';

export default function LoginPage() {
  const [accountNumber, setAccountNumber] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!accountNumber || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!accountNumber.includes('/')) {
      setError('Account number must be in format: RestaurantName/WaiterNumber');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, password, rememberMe }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Login failed');
        setIsLoading(false);
        return;
      }

      // Store tokens
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('restaurant', JSON.stringify(data.restaurant));

      // Navigate to tables page (placeholder for now)
      window.location.href = '/tables';
    } catch {
      setError('Unable to connect to server');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ backgroundColor: '#EEEEEE', fontFamily: "'Fira Sans', sans-serif" }}>
      <div className="w-full max-w-[420px] flex flex-col items-center animate-fade-in">

        {/* Logo */}
        <div className="flex items-start mb-6 select-none">
          <span className="text-4xl font-bold leading-none" style={{ color: '#032813', letterSpacing: '-0.5px' }}>Rest</span>
          <span className="text-4xl font-light leading-none" style={{ color: '#032813', letterSpacing: '-0.5px' }}>Mentor</span>
          <span className="text-xs ml-0.5 mt-0.5 leading-none" style={{ color: '#032813' }}>©</span>
        </div>

        {/* Illustration Card */}
        <div className="w-full rounded-[20px] overflow-hidden mb-4" style={{ backgroundColor: '#FFFFFF', boxShadow: '0px 8px 6px rgba(0, 0, 0, 0.05)' }}>
          <div className="w-full flex items-center justify-center px-8 pt-6 pb-3">
            <svg viewBox="0 0 400 380" className="w-full max-w-[320px] h-auto">
              {/* Cloche */}
              <ellipse cx="145" cy="285" rx="70" ry="8" fill="#C0C0C0" opacity="0.3" />
              <path d="M85 280 Q85 210 145 190 Q205 210 205 280 Z" fill="#E8E8E8" stroke="#D0D0D0" strokeWidth="1.5" />
              <rect x="78" y="278" width="134" height="8" rx="4" fill="#D8D8D8" />
              <line x1="145" y1="188" x2="145" y2="170" stroke="#D0D0D0" strokeWidth="2" />
              <circle cx="145" cy="166" r="5" fill="#D8D8D8" />
              {/* Steam */}
              <path d="M125 160 Q120 145 125 130" stroke="#D0D0D0" strokeWidth="1.5" fill="none" strokeLinecap="round">
                <animate attributeName="d" values="M125 160 Q120 145 125 130;M125 158 Q118 143 126 128;M125 160 Q120 145 125 130" dur="2s" repeatCount="indefinite" />
              </path>
              <path d="M145 155 Q140 140 145 125" stroke="#D0D0D0" strokeWidth="1.5" fill="none" strokeLinecap="round">
                <animate attributeName="d" values="M145 155 Q140 140 145 125;M145 153 Q138 138 146 123;M145 155 Q140 140 145 125" dur="2.3s" repeatCount="indefinite" />
              </path>
              <path d="M165 160 Q160 145 165 130" stroke="#D0D0D0" strokeWidth="1.5" fill="none" strokeLinecap="round">
                <animate attributeName="d" values="M165 160 Q160 145 165 130;M165 158 Q158 143 166 128;M165 160 Q160 145 165 130" dur="1.8s" repeatCount="indefinite" />
              </path>
              {/* Arm to tray */}
              <path d="M205 280 Q220 270 240 258" stroke="#1a1a1a" strokeWidth="3" fill="none" />
              {/* Shadow */}
              <ellipse cx="300" cy="365" rx="50" ry="8" fill="#032813" opacity="0.08" />
              {/* Legs */}
              <rect x="278" y="310" width="14" height="60" rx="4" fill="#1a1a1a" />
              <rect x="308" y="310" width="14" height="60" rx="4" fill="#1a1a1a" />
              <ellipse cx="285" cy="370" rx="12" ry="5" fill="#111" />
              <ellipse cx="315" cy="370" rx="12" ry="5" fill="#111" />
              {/* Torso */}
              <path d="M265 200 Q260 250 270 310 L330 310 Q340 250 335 200 Z" fill="#1a1a1a" />
              <path d="M290 200 L300 260 L310 200" fill="white" />
              <path d="M293 202 L300 208 L307 202 L300 196 Z" fill="#1a1a1a" />
              <circle cx="300" cy="202" r="2.5" fill="#333" />
              {/* Arms */}
              <path d="M265 210 Q230 240 210 275" stroke="#1a1a1a" strokeWidth="12" fill="none" strokeLinecap="round" />
              <circle cx="208" cy="278" r="8" fill="#E8B298" />
              <path d="M335 215 Q350 250 335 290" stroke="#1a1a1a" strokeWidth="12" fill="none" strokeLinecap="round" />
              <rect x="328" y="282" width="16" height="22" rx="2" fill="#F5F5F5" stroke="#D0D0D0" strokeWidth="0.5" />
              {/* Head */}
              <ellipse cx="300" cy="175" rx="28" ry="32" fill="#E8B298" />
              <path d="M275 165 Q275 140 300 138 Q325 140 325 165 Q325 155 300 153 Q275 155 275 165 Z" fill="#1a1a1a" />
              <rect x="280" y="138" width="40" height="14" rx="2" fill="#1a1a1a" />
              <rect x="276" y="148" width="48" height="4" rx="1" fill="#222" />
              <path d="M289 172 Q292 170 295 172" stroke="#333" strokeWidth="1.5" fill="none" />
              <path d="M305 172 Q308 170 311 172" stroke="#333" strokeWidth="1.5" fill="none" />
              <path d="M300 176 Q298 182 300 184" stroke="#D4A080" strokeWidth="1.2" fill="none" />
              <path d="M290 188 Q295 185 300 187 Q305 185 310 188" stroke="#1a1a1a" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M294 192 Q300 196 306 192" stroke="#D4A080" strokeWidth="1" fill="none" />
              <ellipse cx="328" cy="175" rx="6" ry="8" fill="#E8B298" />
            </svg>
          </div>
        </div>

        {/* Form Card */}
        <div className="w-full rounded-[20px] p-6" style={{ backgroundColor: '#D4FCE2', boxShadow: '0px 8px 6px rgba(0, 0, 0, 0.05)' }}>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">

            {/* Account Number */}
            <input
              type="text"
              placeholder="Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full h-[50px] rounded-xl px-[18px] text-[15px] font-normal outline-none transition-shadow duration-200 focus:shadow-[0_0_0_2px_rgba(3,40,19,0.15)]"
              style={{ backgroundColor: '#FFFFFF', border: 'none', color: '#032813', boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.04)', fontFamily: "'Fira Sans', sans-serif" }}
              autoComplete="username"
            />

            {/* Password */}
            <div className="relative w-full">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-[50px] rounded-xl px-[18px] pr-12 text-[15px] font-normal outline-none transition-shadow duration-200 focus:shadow-[0_0_0_2px_rgba(3,40,19,0.15)]"
                style={{ backgroundColor: '#FFFFFF', border: 'none', color: '#032813', boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.04)', fontFamily: "'Fira Sans', sans-serif" }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-1.5 px-1 text-[13px] font-medium" style={{ color: '#c0392b', fontFamily: "'Fira Sans', sans-serif" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" className="shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {/* Remember Me + Forgot Password */}
            <div className="flex items-center justify-between px-1 py-0.5">
              <label className="flex items-center cursor-pointer select-none" onClick={() => setRememberMe(!rememberMe)}>
                <div
                  className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center shrink-0 transition-all duration-200"
                  style={{
                    backgroundColor: rememberMe ? '#032813' : '#FFFFFF',
                    border: rememberMe ? '2px solid #032813' : '2px solid #E0E0E0',
                  }}
                >
                  {rememberMe && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="ml-2.5 text-sm font-normal" style={{ color: '#032813' }}>Remember me</span>
              </label>
              <button type="button" className="text-sm font-normal opacity-70 hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer p-0" style={{ color: '#032813', fontFamily: "'Fira Sans', sans-serif" }}>
                Forgot Password
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-[52px] rounded-xl text-base font-semibold cursor-pointer flex items-center justify-center mt-1 transition-opacity duration-200 hover:opacity-90 disabled:opacity-80 disabled:cursor-not-allowed border-none"
              style={{ backgroundColor: '#032813', color: '#FFFFFF', boxShadow: '0px 4px 8px rgba(3, 40, 19, 0.25)', fontFamily: "'Fira Sans', sans-serif", letterSpacing: '0.3px' }}
            >
              {isLoading ? (
                <div className="w-[22px] h-[22px] border-[2.5px] border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Login'
              )}
            </button>
          </form>
        </div>

        {/* Create Account */}
        <button className="mt-5 text-[15px] font-medium py-2 px-4 bg-transparent border-none cursor-pointer hover:opacity-70 transition-opacity" style={{ color: '#032813', fontFamily: "'Fira Sans', sans-serif" }}>
          Create an Account
        </button>
      </div>
    </div>
  );
}
