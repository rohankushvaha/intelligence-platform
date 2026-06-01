// ============================================================
// THE LEELA CONCIERGE OS
// Component: ConciergeOrb
// ============================================================
// The Golden Concierge Orb is the signature product element.
// It is the embodiment of hospitality, intelligence, and service.
// It is not decoration. It is the brand icon of the platform.
//
// States:
//   idle       — subtle slow pulse. Gold glow breathes.
//   hover      — brighter, slightly larger. Invites interaction.
//   listening  — rapid inner pulse. Gold ring expands.
//   thinking   — rotating shimmer. Indicates AI processing.
//   responding — warm expansion. Signals answer arriving.
//
// Inspired by:
//   Rolls-Royce Spirit of Ecstasy
//   Apple Siri Orb
//   OpenAI Voice Orb
// ============================================================

import { useState, useEffect } from 'react';

export type OrbState = 'idle' | 'hover' | 'listening' | 'thinking' | 'responding';

interface ConciergeOrbProps {
  state?    : OrbState;
  size?     : number;   // diameter in px, default 52
  onClick?  : () => void;
  className?: string;
}

export function ConciergeOrb({
  state   = 'idle',
  size    = 52,
  onClick,
  className = '',
}: ConciergeOrbProps) {
  const [internalState, setInternalState] = useState<OrbState>(state);

  useEffect(() => { setInternalState(state); }, [state]);

  const handleMouseEnter = () => {
    if (internalState === 'idle') setInternalState('hover');
  };
  const handleMouseLeave = () => {
    if (internalState === 'hover') setInternalState('idle');
  };

  return (
    <>
      <style>{`
        @keyframes orbIdle {
          0%, 100% { box-shadow: 0 0 ${size * 0.4}px rgba(191,161,107,0.22), 0 0 ${size * 0.7}px rgba(191,161,107,0.08); }
          50%       { box-shadow: 0 0 ${size * 0.6}px rgba(191,161,107,0.38), 0 0 ${size * 1.0}px rgba(191,161,107,0.14); }
        }
        @keyframes orbHover {
          0%, 100% { box-shadow: 0 0 ${size * 0.6}px rgba(212,184,122,0.5), 0 0 ${size * 1.2}px rgba(191,161,107,0.2); transform: scale(1.04); }
          50%       { box-shadow: 0 0 ${size * 0.8}px rgba(212,184,122,0.6), 0 0 ${size * 1.5}px rgba(191,161,107,0.25); transform: scale(1.06); }
        }
        @keyframes orbListening {
          0%, 100% { box-shadow: 0 0 ${size * 0.5}px rgba(232,208,138,0.6), 0 0 ${size * 1.4}px rgba(191,161,107,0.3); transform: scale(1.0); }
          50%       { box-shadow: 0 0 ${size * 1.0}px rgba(232,208,138,0.8), 0 0 ${size * 2.0}px rgba(191,161,107,0.4); transform: scale(1.08); }
        }
        @keyframes orbThinking {
          0%   { transform: scale(1.0) rotate(0deg); filter: brightness(0.9); }
          25%  { transform: scale(1.03) rotate(90deg); filter: brightness(1.1); }
          50%  { transform: scale(1.0) rotate(180deg); filter: brightness(0.95); }
          75%  { transform: scale(1.03) rotate(270deg); filter: brightness(1.1); }
          100% { transform: scale(1.0) rotate(360deg); filter: brightness(0.9); }
        }
        @keyframes orbResponding {
          0%   { transform: scale(1.0); box-shadow: 0 0 ${size * 0.5}px rgba(232,208,138,0.4); }
          40%  { transform: scale(1.1); box-shadow: 0 0 ${size * 1.2}px rgba(232,208,138,0.7), 0 0 ${size * 2.5}px rgba(191,161,107,0.3); }
          100% { transform: scale(1.0); box-shadow: 0 0 ${size * 0.4}px rgba(191,161,107,0.22); }
        }
        @keyframes orbShimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
      `}</style>

      <div
        className={className}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role={onClick ? 'button' : 'img'}
        aria-label={`Leela Concierge Orb — ${internalState}`}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        style={{
          width        : size,
          height       : size,
          borderRadius : '50%',
          cursor       : onClick ? 'pointer' : 'default',
          flexShrink   : 0,
          position     : 'relative',
          overflow     : 'visible',

          // Core gradient — mimics a physical gold sphere with light from top-left
          background: internalState === 'thinking'
            ? `conic-gradient(from 0deg, #BFA16B, #E8D08A, #D4B87A, #8B6B3A, #BFA16B)`
            : `radial-gradient(circle at 32% 32%, #F0D98A 0%, #D4B87A 25%, #BFA16B 50%, #8B6B3A 75%, #5A4020 100%)`,

          // State-driven animation
          animation: {
            idle       : `orbIdle 3.5s ease-in-out infinite`,
            hover      : `orbHover 1.2s ease-in-out infinite`,
            listening  : `orbListening 0.8s ease-in-out infinite`,
            thinking   : `orbThinking 1.8s linear infinite`,
            responding : `orbResponding 0.9s ease-out forwards`,
          }[internalState],

          // Inner highlight — gives 3D depth
          boxShadow: `inset 0 ${size * 0.08}px ${size * 0.16}px rgba(255,255,255,0.3), inset 0 -${size * 0.04}px ${size * 0.08}px rgba(0,0,0,0.2)`,

          transition: 'transform 0.3s ease',
        }}
      >
        {/* Inner star mark */}
        <div
          aria-hidden="true"
          style={{
            position   : 'absolute',
            inset      : 0,
            display    : 'flex',
            alignItems : 'center',
            justifyContent : 'center',
            fontSize   : size * 0.35,
            color      : 'rgba(10,16,40,0.5)',
            fontFamily : "'Cormorant Garamond', serif",
            userSelect : 'none',
            lineHeight : 1,
          }}
        >
          ✦
        </div>
      </div>
    </>
  );
}
