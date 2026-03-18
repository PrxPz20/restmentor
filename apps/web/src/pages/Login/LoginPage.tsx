import { useState } from 'react';
import logo from '../../assets/logo.svg';
import waiterImg from '../../assets/waiter.jpg';

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

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('restaurant', JSON.stringify(data.restaurant));

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
        <img src={logo} alt="RestMentor" className="h-10 mb-6" />

        {/* Illustration Card */}
        <div className="w-full rounded-[20px] overflow-hidden mb-4" style={{ backgroundColor: '#FFFFFF', boxShadow: '0px 8px 6px rgba(0, 0, 0, 0.05)' }}>
          <img
            src={waiterImg}
            alt="Waiter illustration"
            className="w-full block"
            style={{ objectFit: 'cover', objectPosition: 'center bottom' }}
          />
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
              className="w-full h-[50px] px-[18px] outline-none transition-shadow duration-200 focus:shadow-[0_0_0_2px_rgba(3,40,19,0.15)]"
              style={{
                backgroundColor: '#FFFFFF',
                border: 'none',
                color: '#032813',
                fontFamily: "'Fira Sans', sans-serif",
                fontSize: '12pt',
                fontWeight: 300,
                boxShadow: 'rgba(4, 36, 18, 0.16) 0px 3px 6px',
                borderRadius: '8px',
              }}
              autoComplete="username"
            />

            {/* Password */}
            <div className="relative w-full">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-[50px] px-[18px] pr-12 outline-none transition-shadow duration-200 focus:shadow-[0_0_0_2px_rgba(3,40,19,0.15)]"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: 'none',
                  color: '#032813',
                  fontFamily: "'Fira Sans', sans-serif",
                  fontSize: '12pt',
                  fontWeight: 300,
                  boxShadow: 'rgba(4, 36, 18, 0.16) 0px 3px 6px',
                  borderRadius: '8px',
                }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#032813" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#032813" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  className="w-[22px] h-[22px] flex items-center justify-center shrink-0 transition-all duration-200"
                  style={{
                    backgroundColor: rememberMe ? '#032813' : '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: 'rgba(4, 36, 18, 0.16) 0px 3px 6px',
                  }}
                >
                  {rememberMe && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span style={{ color: '#032813', fontSize: '12pt', fontWeight: 300, opacity: 1, letterSpacing: '0.4px', marginLeft: '10px', fontFamily: "'Fira Sans', sans-serif" }}>
                  Remember me
                </span>
              </label>
              <button
                type="button"
                className="bg-transparent border-none cursor-pointer p-0 hover:opacity-80 transition-opacity"
                style={{ color: '#032813', fontSize: '12pt', fontWeight: 300, opacity: 0.6, letterSpacing: '0.4px', fontFamily: "'Fira Sans', sans-serif" }}
              >
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
