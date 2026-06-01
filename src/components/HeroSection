// ============================================================
// THE LEELA CONCIERGE OS
// Component: HeroSection
// ============================================================
// The hero occupies 80–90% of the first viewport.
// Goal: "I have entered The Leela." Not "I opened an application."
//
// Structure:
//   - Cinematic property background (CSS-simulated; swap for real
//     Leela images by updating PROPERTIES[n].bgImage)
//   - Editorial greeting typography
//   - Golden Concierge Orb at center
//   - Single command bar — no buttons, no chips, no cards
//   - Quick journey text links below bar (not buttons)
//   - Property tag top-right with auto-rotation every 15s
// ============================================================

import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { ConciergeOrb, type OrbState } from './ConciergeOrb';

// ── Property spotlight data ────────────────────────────────────────────────
// Replace bgGradient with real Leela image URLs when available:
// bgImage: 'url(/images/udaipur.jpg)'

interface PropertySpotlight {
  name     : string;
  location : string;
  region   : string;
  tagline  : string;
  // CSS gradient that simulates the mood of each property
  bgGradient: string;
}

const PROPERTIES: PropertySpotlight[] = [
  {
    name      : 'The Leela Palace Udaipur',
    location  : 'Lake Pichola',
    region    : 'Rajasthan',
    tagline   : 'A palace on still waters',
    bgGradient: 'linear-gradient(135deg, #1a0f05 0%, #3d2410 25%, #5a3820 50%, #2a1a08 75%, #0f0805 100%)',
  },
  {
    name      : 'The Leela Palace New Delhi',
    location  : 'Diplomatic Enclave',
    region    : 'New Delhi',
    tagline   : 'Where power meets elegance',
    bgGradient: 'linear-gradient(135deg, #0a0f1a 0%, #102035 25%, #1a3050 50%, #0d1a30 75%, #050a15 100%)',
  },
  {
    name      : 'The Leela Palace Jaipur',
    location  : 'Jawahar Circle',
    region    : 'Rajasthan',
    tagline   : 'The pink city in its finest form',
    bgGradient: 'linear-gradient(135deg, #1a0a0f 0%, #350f20 25%, #501530 50%, #2a0a1a 75%, #150510 100%)',
  },
  {
    name      : 'The Leela Palace Bengaluru',
    location  : 'Old Airport Road',
    region    : 'Karnataka',
    tagline   : 'Garden city luxury',
    bgGradient: 'linear-gradient(135deg, #050f0a 0%, #0f2a15 25%, #152a18 50%, #0a1f10 75%, #050f08 100%)',
  },
];

const JOURNEY_PROMPTS = [
  'Plan a celebration',
  'Discover dining',
  'Explore properties',
  'Curate an itinerary',
  'Spa & wellness',
];

// ── Props ──────────────────────────────────────────────────────────────────

interface HeroSectionProps {
  onQuery     : (query: string) => void;
  isLoading?  : boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export function HeroSection({ onQuery, isLoading = false }: HeroSectionProps) {
  const [activeProperty, setActiveProperty] = useState(0);
  const [input,          setInput]          = useState('');
  const [orbState,       setOrbState]       = useState<OrbState>('idle');
  const [transitioning,  setTransitioning]  = useState(false);
  const [timeOfDay,      setTimeOfDay]      = useState('');

  const inputRef   = useRef<HTMLInputElement>(null);
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Time of day greeting
  useEffect(() => {
    const h = new Date().getHours();
    if      (h < 12) setTimeOfDay('Good Morning');
    else if (h < 17) setTimeOfDay('Good Afternoon');
    else             setTimeOfDay('Good Evening');
  }, []);

  // Rotate property every 15 seconds
  useEffect(() => {
    rotationRef.current = setInterval(() => {
      setTransitioning(true);
      setTimeout(() => {
        setActiveProperty(p => (p + 1) % PROPERTIES.length);
        setTransitioning(false);
      }, 400);
    }, 15000);
    return () => { if (rotationRef.current) clearInterval(rotationRef.current); };
  }, []);

  // Sync orb state with loading
  useEffect(() => {
    if (isLoading) setOrbState('thinking');
    else if (orbState === 'thinking') setOrbState('responding');
  }, [isLoading]);

  const property = PROPERTIES[activeProperty];

  const handleSend = () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput('');
    setOrbState('responding');
    onQuery(q);
    setTimeout(() => setOrbState('idle'), 800);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleOrbClick = () => {
    inputRef.current?.focus();
    setOrbState('listening');
  };

  const handleInputFocus = () => {
    if (orbState === 'idle') setOrbState('listening');
  };

  const handleInputBlur = () => {
    if (orbState === 'listening') setOrbState('idle');
  };

  return (
    <section
      style={{
        position   : 'relative',
        minHeight  : '82vh',
        overflow   : 'hidden',
        display    : 'flex',
        flexDirection : 'column',
        justifyContent: 'flex-end',
        paddingBottom : '48px',
      }}
      aria-label="Leela Concierge hero — property spotlight and command center"
    >
      {/* ── Background — property mood ── */}
      <div
        aria-hidden="true"
        style={{
          position   : 'absolute',
          inset      : 0,
          background : property.bgGradient,
          transition : 'background 1.2s ease',
          opacity    : transitioning ? 0 : 1,
        }}
      />

      {/* Atmospheric overlay — adds depth, darkens bottom for legibility */}
      <div
        aria-hidden="true"
        style={{
          position   : 'absolute',
          inset      : 0,
          background : `
            radial-gradient(ellipse 80% 60% at 65% 45%, rgba(191,161,107,0.06) 0%, transparent 60%),
            linear-gradient(180deg,
              rgba(10,16,40,0.3) 0%,
              rgba(10,16,40,0.1) 30%,
              rgba(10,16,40,0.5) 70%,
              rgba(10,16,40,0.85) 100%
            )
          `,
        }}
      />

      {/* ── Property tag — top right ── */}
      <div
        style={{
          position      : 'absolute',
          top           : '28px',
          right         : '36px',
          background    : 'rgba(10,16,40,0.65)',
          border        : '1px solid rgba(191,161,107,0.25)',
          borderRadius  : '8px',
          padding       : '10px 16px',
          backdropFilter: 'blur(12px)',
          textAlign     : 'right',
          opacity       : transitioning ? 0 : 1,
          transition    : 'opacity 0.4s ease',
          zIndex        : 2,
        }}
      >
        <div style={{
          fontFamily    : "'Cormorant Garamond', serif",
          fontSize      : '0.95rem',
          fontWeight    : 400,
          color         : '#F9F7F2',
          letterSpacing : '0.01em',
        }}>
          {property.name}
        </div>
        <div style={{
          fontFamily    : "'Inter', sans-serif",
          fontSize      : '0.62rem',
          letterSpacing : '0.1em',
          textTransform : 'uppercase',
          color         : '#BFA16B',
          marginTop     : '3px',
        }}>
          {property.location} · {property.region}
        </div>
        {/* Property rotation dots */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', marginTop: '8px' }}>
          {PROPERTIES.map((_, i) => (
            <div
              key={i}
              onClick={() => { setActiveProperty(i); }}
              style={{
                width        : i === activeProperty ? '16px' : '5px',
                height       : '4px',
                borderRadius : '2px',
                background   : i === activeProperty ? '#BFA16B' : 'rgba(191,161,107,0.3)',
                cursor       : 'pointer',
                transition   : 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Hero copy — bottom-left ── */}
      <div
        style={{
          position  : 'relative',
          zIndex    : 2,
          padding   : '0 48px',
          maxWidth  : '700px',
          opacity   : transitioning ? 0 : 1,
          transform : transitioning ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
          marginBottom: '36px',
        }}
      >
        {/* Eyebrow */}
        <div style={{
          fontFamily    : "'Inter', sans-serif",
          fontSize      : '0.62rem',
          letterSpacing : '0.22em',
          textTransform : 'uppercase',
          color         : '#BFA16B',
          marginBottom  : '10px',
          display       : 'flex',
          alignItems    : 'center',
          gap           : '10px',
          opacity       : 0.8,
        }}>
          <span style={{ display: 'inline-block', width: '20px', height: '1px', background: '#BFA16B', opacity: 0.5 }} />
          The Leela Palaces Hotels &amp; Resorts
        </div>

        {/* Time greeting */}
        <div style={{
          fontFamily    : "'Inter', sans-serif",
          fontSize      : '0.88rem',
          fontWeight    : 300,
          color         : 'rgba(249,247,242,0.55)',
          letterSpacing : '0.04em',
          marginBottom  : '6px',
        }}>
          {timeOfDay}
        </div>

        {/* Main headline */}
        <h1 style={{
          fontFamily    : "'Cormorant Garamond', serif",
          fontSize      : 'clamp(2.4rem, 5vw, 3.6rem)',
          fontWeight    : 300,
          lineHeight    : 1.08,
          color         : '#F9F7F2',
          letterSpacing : '-0.01em',
          margin        : '0 0 14px',
        }}>
          Welcome to<br />The Leela
        </h1>

        <p style={{
          fontFamily    : "'Cormorant Garamond', serif",
          fontSize      : '1.05rem',
          fontWeight    : 300,
          fontStyle     : 'italic',
          color         : 'rgba(249,247,242,0.5)',
          letterSpacing : '0.02em',
          lineHeight    : 1.6,
          margin        : 0,
        }}>
          A discreet concierge crafted to guide every journey.
        </p>
      </div>

      {/* ── Command Center ── */}
      <div
        style={{
          position  : 'relative',
          zIndex    : 2,
          padding   : '0 48px',
        }}
      >
        {/* Orb + Command bar row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '14px' }}>
          <ConciergeOrb
            state={orbState}
            size={52}
            onClick={handleOrbClick}
          />

          {/* Command bar */}
          <div
            style={{
              flex          : 1,
              maxWidth      : '740px',
              background    : 'rgba(249,247,242,0.07)',
              border        : '1px solid rgba(191,161,107,0.25)',
              borderRadius  : '40px',
              height        : '56px',
              display       : 'flex',
              alignItems    : 'center',
              padding       : '0 8px 0 22px',
              backdropFilter: 'blur(16px)',
              transition    : 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(249,247,242,0.1)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(191,161,107,0.5)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(249,247,242,0.07)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(191,161,107,0.25)';
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder="How may I assist you today?"
              disabled={isLoading}
              aria-label="Concierge request"
              style={{
                flex          : 1,
                background    : 'transparent',
                border        : 'none',
                outline       : 'none',
                fontFamily    : "'Cormorant Garamond', serif",
                fontSize      : '1.08rem',
                fontWeight    : 300,
                fontStyle     : 'italic',
                color         : '#F9F7F2',
                letterSpacing : '0.01em',
              }}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label="Send request"
              style={{
                width        : '38px',
                height       : '38px',
                borderRadius : '50%',
                border       : 'none',
                cursor       : input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                display      : 'flex',
                alignItems   : 'center',
                justifyContent: 'center',
                flexShrink   : 0,
                transition   : 'all 0.2s ease',
                background   : input.trim() && !isLoading
                  ? 'linear-gradient(135deg, #D4B87A, #BFA16B)'
                  : 'rgba(255,255,255,0.08)',
                color        : input.trim() && !isLoading ? '#0A1028' : 'rgba(249,247,242,0.3)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Journey text prompts — not buttons, text links */}
        <div
          style={{
            display   : 'flex',
            gap       : '24px',
            flexWrap  : 'wrap',
            marginLeft: '70px',  // aligns with command bar (after orb)
          }}
        >
          {JOURNEY_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => !isLoading && onQuery(prompt)}
              disabled={isLoading}
              style={{
                background    : 'none',
                border        : 'none',
                borderBottom  : '1px solid transparent',
                cursor        : isLoading ? 'not-allowed' : 'pointer',
                fontFamily    : "'Inter', sans-serif",
                fontSize      : '0.72rem',
                fontWeight    : 300,
                color         : 'rgba(249,247,242,0.38)',
                letterSpacing : '0.04em',
                padding       : '4px 0',
                transition    : 'all 0.18s ease',
                opacity       : isLoading ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  (e.currentTarget as HTMLButtonElement).style.color = '#BFA16B';
                  (e.currentTarget as HTMLButtonElement).style.borderBottomColor = 'rgba(191,161,107,0.35)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(249,247,242,0.38)';
                  (e.currentTarget as HTMLButtonElement).style.borderBottomColor = 'transparent';
                }
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
