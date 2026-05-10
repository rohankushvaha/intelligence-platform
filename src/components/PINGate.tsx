// ============================================================
// Leela Intelligence Platform — PIN Gate (Internal Mode)
// PIN: 1986 — Founding year of The Leela
// ============================================================

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';

interface PINGateProps {
  onSuccess: () => void;
}

const CORRECT_PIN = '1986';

export function PINGate({ onSuccess }: PINGateProps) {
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInput = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;

    setError(false);
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (value && index === 3) {
      const fullPin = [...newPin].join('');
      if (fullPin.length === 4) {
        validatePin(fullPin, newPin);
      }
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const fullPin = pin.join('');
      if (fullPin.length === 4) validatePin(fullPin, pin);
    }
  };

  const validatePin = (fullPin: string, _currentPin: string[]) => {
    if (fullPin === CORRECT_PIN) {
      onSuccess();
    } else {
      setError(true);
      setIsShaking(true);
      setPin(['', '', '', '']);
      setTimeout(() => {
        setIsShaking(false);
        inputRefs.current[0]?.focus();
      }, 600);
    }
  };

  const handleSubmit = () => {
    const fullPin = pin.join('');
    if (fullPin.length === 4) validatePin(fullPin, pin);
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-full py-16 px-6"
      style={{ backgroundColor: '#F8F5F0' }}
    >
      {/* Ornamental gold divider */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-px w-12" style={{ backgroundColor: '#C9A84C' }} />
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 2L11.8 7.4H17.6L12.9 10.6L14.7 16L10 12.8L5.3 16L7.1 10.6L2.4 7.4H8.2L10 2Z"
            fill="#C9A84C"
            opacity="0.8"
          />
        </svg>
        <div className="h-px w-12" style={{ backgroundColor: '#C9A84C' }} />
      </div>

      {/* Lock icon */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: '#EDE8DF', border: '1px solid #C9A84C' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="#21469F" strokeWidth="1.5" />
          <path
            d="M7 11V7a5 5 0 0110 0v4"
            stroke="#21469F"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="12" cy="16" r="1.5" fill="#21469F" />
        </svg>
      </div>

      <h2
        className="text-2xl mb-2 text-center"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          color: '#1A1A2E',
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}
      >
        Internal Access
      </h2>

      <p
        className="text-sm text-center mb-8 max-w-xs leading-relaxed"
        style={{
          fontFamily: "'Jost', sans-serif",
          color: '#8A8A8A',
          letterSpacing: '0.03em',
        }}
      >
        This section is for Leela sales & marketing teams. Enter your access PIN to continue.
      </p>

      {/* PIN inputs */}
      <div
        className={`flex gap-3 mb-4 ${isShaking ? 'animate-bounce' : ''}`}
        style={{
          animation: isShaking ? 'shake 0.4s ease' : 'none',
        }}
      >
        {pin.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleInput(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="w-12 h-12 text-center text-xl font-medium rounded-lg outline-none transition-all duration-200"
            style={{
              border: error
                ? '2px solid #dc2626'
                : digit
                ? '2px solid #21469F'
                : '1.5px solid #EDE8DF',
              backgroundColor: '#FFFFFF',
              color: '#1A1A2E',
              fontFamily: "'Jost', sans-serif",
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
            onFocus={(e) => {
              if (!error) {
                e.currentTarget.style.border = '2px solid #21469F';
              }
            }}
            onBlur={(e) => {
              if (!digit && !error) {
                e.currentTarget.style.border = '1.5px solid #EDE8DF';
              }
            }}
          />
        ))}
      </div>

      {error && (
        <p
          className="text-xs mb-4"
          style={{ color: '#dc2626', fontFamily: "'Jost', sans-serif" }}
        >
          Incorrect PIN. Please try again.
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={pin.join('').length !== 4}
        className="px-8 py-2.5 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: '#21469F',
          color: '#FFFFFF',
          fontFamily: "'Jost', sans-serif",
          letterSpacing: '0.08em',
          fontSize: '0.8rem',
          border: 'none',
          cursor: pin.join('').length !== 4 ? 'not-allowed' : 'pointer',
        }}
        onMouseEnter={(e) => {
          if (pin.join('').length === 4) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1a3a87';
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#21469F';
        }}
      >
        ACCESS
      </button>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
