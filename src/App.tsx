// ============================================================
// THE LEELA CONCIERGE OS — v3
// Root Application
// ============================================================
// Architecture change from v2:
//   - Left navigation rail (72px) replaces top header
//   - Max-width 1440px container — never full browser width
//   - Dark OS shell (#0A1028) replaces ivory background
//   - HeroSection replaces static welcome state
//   - ExperienceCards replaces ConciergeCardGrid
//   - Conversation panel slides up from bottom (no page nav)
//   - Investor mode = separate route (/investor), not a tab
//   - Admin routes preserved at /admin and /bulk-ingest
// ============================================================

import { useState }           from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HeroSection }        from './components/HeroSection';
import { ExperienceCards }    from './components/ExperienceCards';
import { ChatInterface }      from './components/ChatInterface';
import { AdminPanel }         from './pages/AdminPanel';
import { BulkIngest }         from './pages/BulkIngest';
import { InvestorAssistant }  from './pages/InvestorAssistant';
import type { ConciergeCardConfig } from './components/ConciergeCard';
import type { Mode } from './types';

// ── Guest concierge cards (carried forward — used in conversation mode) ────

const GUEST_CARDS: ConciergeCardConfig[] = [
  {
    question : 'What dining options does The Leela New Delhi have?',
    display  : 'Dining at The Leela New Delhi?',
    hint     : 'Properties · Restaurants',
  },
  {
    question : 'Which Leela properties have an ESPA spa?',
    display  : 'Which properties have ESPA spa?',
    hint     : 'Wellness · Experiences',
  },
  {
    question : 'Tell me about The Leela Udaipur experience',
    display  : "The Leela Udaipur — what's special?",
    hint     : 'Destinations · Heritage',
  },
  {
    question : 'What is the DISCOVERY loyalty programme?',
    display  : 'About DISCOVERY loyalty?',
    hint     : 'Membership · Benefits',
  },
];

// ── Nav items ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'concierge',    icon: '✦', label: 'Concierge'   },
  { id: 'stay',         icon: '⊡', label: 'Stay'        },
  { id: 'dining',       icon: '⬡', label: 'Dining'      },
  { id: 'wellness',     icon: '◎', label: 'Wellness'    },
  { id: 'experiences',  icon: '◈', label: 'Experiences' },
];

// ── Main Leela OS layout ───────────────────────────────────────────────────

type AppState = 'landing' | 'conversation';

function LeelaOS() {
  const [appState,   setAppState]   = useState<AppState>('landing');
  const [activeNav,  setActiveNav]  = useState('concierge');
  const [activeMode, setActiveMode] = useState<Exclude<Mode, 'internal'>>('guest');
  const [firstQuery, setFirstQuery] = useState('');

  const handleHeroQuery = (query: string) => {
    setFirstQuery(query);
    setAppState('conversation');
  };

  const handleBackToLanding = () => {
    setAppState('landing');
    setFirstQuery('');
  };

  return (
    <div
      style={{
        display         : 'flex',
        height          : '100svh',
        backgroundColor : '#0A1028',
        maxWidth        : '1440px',
        margin          : '0 auto',
        position        : 'relative',
        overflow        : 'hidden',
      }}
    >
      {/* ── Left Navigation Rail ── */}
      <nav
        aria-label="Main navigation"
        style={{
          width           : '72px',
          backgroundColor : 'rgba(10,16,40,0.95)',
          borderRight     : '1px solid rgba(191,161,107,0.1)',
          display         : 'flex',
          flexDirection   : 'column',
          alignItems      : 'center',
          padding         : '20px 0',
          flexShrink      : 0,
          zIndex          : 20,
        }}
      >
        {/* Leela monogram */}
        <div
          style={{
            width           : '38px',
            height          : '38px',
            borderRadius    : '50%',
            border          : '1.5px solid rgba(191,161,107,0.4)',
            display         : 'flex',
            alignItems      : 'center',
            justifyContent  : 'center',
            marginBottom    : '22px',
            cursor          : 'pointer',
          }}
          onClick={handleBackToLanding}
          role="button"
          aria-label="Return to home"
          title="The Leela Concierge OS"
        >
          <span style={{
            fontFamily    : "'Cormorant Garamond', serif",
            color         : '#BFA16B',
            fontSize      : '1.1rem',
            fontWeight    : 500,
          }}>
            L
          </span>
        </div>

        {/* Nav items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activeNav === item.id}
              onClick={() => {
                setActiveNav(item.id);
                if (item.id === 'concierge') handleBackToLanding();
              }}
            />
          ))}

          {/* Divider */}
          <div style={{
            width      : '32px',
            height     : '1px',
            background : 'rgba(191,161,107,0.1)',
            margin     : '8px auto',
          }} />

          {/* Investor IR */}
          <NavItem
            icon="◑"
            label="IR"
            isActive={activeMode === 'investor'}
            onClick={() => setActiveMode(m => m === 'investor' ? 'guest' : 'investor')}
            badge="IR"
          />
        </div>

        {/* Settings — bottom */}
        <NavItem icon="⚙" label="Settings" isActive={false} onClick={() => {}} />
      </nav>

      {/* ── Main content ── */}
      <main
        style={{
          flex       : 1,
          overflow   : 'hidden',
          display    : 'flex',
          flexDirection: 'column',
          minWidth   : 0,
        }}
      >
        {/* Mode tabs — top right of main area */}
        <div
          style={{
            position : 'absolute',
            top      : '14px',
            right    : '20px',
            display  : 'flex',
            alignItems: 'center',
            gap      : '14px',
            zIndex   : 30,
          }}
        >
          <ModeTab
            label="Guest Concierge"
            isActive={activeMode === 'guest'}
            onClick={() => setActiveMode('guest')}
          />
          <div style={{ width: '1px', height: '14px', background: 'rgba(249,247,242,0.1)' }} />
          <ModeTab
            label="Investor"
            badge="IR"
            isActive={activeMode === 'investor'}
            onClick={() => setActiveMode('investor')}
          />
        </div>

        {/* ── Landing state ── */}
        {appState === 'landing' && activeMode === 'guest' && (
          <div
            style={{ flex: 1, overflowY: 'auto' }}
            className="leela-scroll"
          >
            <HeroSection
              onQuery={handleHeroQuery}
            />
            <ExperienceCards
              onSelect={handleHeroQuery}
              onInvestorClick={() => setActiveMode('investor')}
            />
            {/* Subtle live KB ribbon — for admins / power users only */}
            <KBRibbon />
          </div>
        )}

        {/* ── Conversation state ── */}
        {appState === 'conversation' && activeMode === 'guest' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Back to landing */}
            <div
              style={{
                padding       : '12px 20px',
                borderBottom  : '1px solid rgba(191,161,107,0.1)',
                display       : 'flex',
                alignItems    : 'center',
                gap           : '12px',
                flexShrink    : 0,
              }}
            >
              <button
                onClick={handleBackToLanding}
                style={{
                  background    : 'none',
                  border        : 'none',
                  cursor        : 'pointer',
                  display       : 'flex',
                  alignItems    : 'center',
                  gap           : '6px',
                  fontFamily    : "'Inter', sans-serif",
                  fontSize      : '0.68rem',
                  color         : 'rgba(249,247,242,0.4)',
                  letterSpacing : '0.06em',
                  padding       : '4px 0',
                  transition    : 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#BFA16B')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(249,247,242,0.4)')}
                aria-label="Return to home"
              >
                ← Back
              </button>

              <div style={{
                fontFamily    : "'Cormorant Garamond', serif",
                fontSize      : '0.9rem',
                color         : 'rgba(249,247,242,0.5)',
                fontStyle     : 'italic',
              }}>
                Guest Concierge
              </div>
            </div>

            {/* Chat interface */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ChatInterface
                mode="guest"
                cards={GUEST_CARDS}
                placeholder="Ask anything about The Leela…"
                inputLabel="Concierge"
              />
            </div>
          </div>
        )}

        {/* ── Investor mode ── */}
        {activeMode === 'investor' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <InvestorAssistant />
          </div>
        )}
      </main>
    </div>
  );
}

// ── Nav Item ───────────────────────────────────────────────────────────────

function NavItem({
  icon, label, isActive, onClick, badge,
}: {
  icon     : string;
  label    : string;
  isActive : boolean;
  onClick  : () => void;
  badge?   : string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        width           : '44px',
        height          : '44px',
        borderRadius    : '8px',
        border          : `1px solid ${isActive ? 'rgba(191,161,107,0.3)' : 'transparent'}`,
        background      : isActive ? 'rgba(191,161,107,0.1)' : 'transparent',
        cursor          : 'pointer',
        display         : 'flex',
        flexDirection   : 'column',
        alignItems      : 'center',
        justifyContent  : 'center',
        gap             : '3px',
        transition      : 'all 0.18s ease',
        position        : 'relative',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(191,161,107,0.06)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(191,161,107,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
        }
      }}
    >
      <span style={{
        fontFamily    : "'Cormorant Garamond', serif",
        fontSize      : '14px',
        color         : isActive ? '#BFA16B' : 'rgba(249,247,242,0.35)',
        transition    : 'color 0.18s ease',
        lineHeight    : 1,
      }}>
        {icon}
      </span>
      <span style={{
        fontFamily    : "'Inter', sans-serif",
        fontSize      : '8px',
        letterSpacing : '0.06em',
        textTransform : 'uppercase',
        color         : isActive ? '#BFA16B' : 'rgba(249,247,242,0.3)',
        transition    : 'color 0.18s ease',
      }}>
        {badge || label}
      </span>
    </button>
  );
}

// ── Mode Tab ───────────────────────────────────────────────────────────────

function ModeTab({
  label, isActive, onClick, badge,
}: {
  label    : string;
  isActive : boolean;
  onClick  : () => void;
  badge?   : string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background    : 'none',
        border        : 'none',
        borderBottom  : `1.5px solid ${isActive ? '#BFA16B' : 'transparent'}`,
        cursor        : 'pointer',
        fontFamily    : "'Inter', sans-serif",
        fontSize      : '0.65rem',
        fontWeight    : isActive ? 400 : 300,
        letterSpacing : '0.1em',
        textTransform : 'uppercase',
        color         : isActive ? '#F9F7F2' : 'rgba(249,247,242,0.35)',
        padding       : '4px 0 6px',
        transition    : 'all 0.2s ease',
        display       : 'flex',
        alignItems    : 'center',
        gap           : '6px',
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(249,247,242,0.65)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(249,247,242,0.35)';
      }}
    >
      {label}
      {badge && (
        <span style={{
          fontFamily    : "'Inter', sans-serif",
          fontSize      : '0.5rem',
          letterSpacing : '0.1em',
          color         : '#BFA16B',
          border        : '1px solid rgba(191,161,107,0.35)',
          borderRadius  : '2px',
          padding       : '1px 4px',
          lineHeight    : 1.4,
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ── KB Ribbon — subtle, bottom of landing ─────────────────────────────────

function KBRibbon() {
  return (
    <div
      style={{
        margin         : '8px 48px 24px',
        background     : 'rgba(255,255,255,0.03)',
        border         : '1px solid rgba(191,161,107,0.1)',
        borderRadius   : '40px',
        padding        : '9px 24px',
        display        : 'flex',
        alignItems     : 'center',
        justifyContent : 'center',
        gap            : '20px',
        flexWrap       : 'wrap',
      }}
    >
      {[
        { dot: '#3CB371', text: 'Live Knowledge' },
        { text: '12 Properties',        val: true },
        { text: '3,236 Sources',         val: true },
        { text: '98% Official Content',  val: true },
        { text: 'Updated 3 mins ago'              },
      ].map((item, i, arr) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {i > 0 && (
            <div style={{ width: '1px', height: '10px', background: 'rgba(191,161,107,0.12)' }} />
          )}
          <div style={{
            display       : 'flex',
            alignItems    : 'center',
            gap           : '5px',
            fontFamily    : "'Inter', sans-serif",
            fontSize      : '0.6rem',
            letterSpacing : '0.08em',
            textTransform : 'uppercase',
            color         : 'rgba(249,247,242,0.35)',
            whiteSpace    : 'nowrap',
          }}>
            {item.dot && (
              <span style={{
                width        : '5px',
                height       : '5px',
                borderRadius : '50%',
                background   : item.dot,
                display      : 'inline-block',
                animation    : 'dotPulse 2.5s ease-in-out infinite',
              }} />
            )}
            {item.text}
          </div>
        </div>
      ))}
      <style>{`
        @keyframes dotPulse {
          0%,100% { opacity:1 } 50% { opacity:0.4 }
        }
      `}</style>
    </div>
  );
}

// ── App router ─────────────────────────────────────────────────────────────

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<LeelaOS      />} />
        <Route path="/admin"       element={<AdminPanel   />} />
        <Route path="/bulk-ingest" element={<BulkIngest   />} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
