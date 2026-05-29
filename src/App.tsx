// ============================================================
// Leela Intelligence Platform v2 — Root Application
// ============================================================
// Changes from v1:
//   - InternalCopilot removed from navigation and routes
//   - ModeSelector now only shows guest + investor
//   - Header subtitle reflects active mode (not hardcoded)
//   - "Powered by Gemini" → "Powered by Groq"
//   - GuestConcierge receives new ConciergeCardConfig[] format
// ============================================================

import { useState }           from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ModeSelector }       from './components/ModeSelector';
import { GuestConcierge }     from './pages/GuestConcierge';
import { InvestorAssistant }  from './pages/InvestorAssistant';
import { AdminPanel }         from './pages/AdminPanel';
import { BulkIngest }         from './pages/BulkIngest';
import type { Mode }          from './types';

// ── Mode metadata — drives header subtitle ─────────────────────────────────

const MODE_SUBTITLE: Record<Exclude<Mode, 'internal'>, string> = {
  guest    : 'Guest Concierge',
  investor : 'Investor Intelligence',
};

// ── Main LIP layout ────────────────────────────────────────────────────────

function LIPLayout() {
  const [activeMode, setActiveMode] = useState<Exclude<Mode, 'internal'>>('guest');

  return (
    <div
      style={{
        display         : 'flex',
        flexDirection   : 'column',
        height          : '100svh',
        backgroundColor : '#F8F5F0',
        fontFamily      : "'Jost', sans-serif",
      }}
    >
      {/* ── Header ── */}
      <header style={{ backgroundColor: '#1A1A2E', flexShrink: 0 }}>

        {/* Gold accent line — very top */}
        <div className="leela-gold-line" />

        <div style={{ padding: '12px 16px 0' }}>

          {/* Brand row */}
          <div
            style={{
              display         : 'flex',
              alignItems      : 'center',
              justifyContent  : 'space-between',
              marginBottom    : '10px',
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily    : "'Cormorant Garamond', serif",
                  color         : '#F8F5F0',
                  fontSize      : 'clamp(1rem, 3vw, 1.35rem)',
                  fontWeight    : 500,
                  margin        : 0,
                  letterSpacing : '0.02em',
                  lineHeight    : 1.2,
                }}
              >
                The Leela Intelligence Platform
              </h1>

              {/* Subtitle changes per mode — Gemini → Groq fix */}
              <p
                style={{
                  fontFamily    : "'Jost', sans-serif",
                  color         : '#4A4A6A',
                  fontSize      : '0.58rem',
                  letterSpacing : '0.18em',
                  margin        : '3px 0 0',
                  textTransform : 'uppercase',
                }}
              >
                Powered by Groq · {MODE_SUBTITLE[activeMode]}
              </p>
            </div>

            {/* Leela monogram */}
            <div
              style={{
                width           : '34px',
                height          : '34px',
                borderRadius    : '50%',
                border          : '1.5px solid rgba(201,168,76,0.45)',
                display         : 'flex',
                alignItems      : 'center',
                justifyContent  : 'center',
                flexShrink      : 0,
              }}
            >
              <span
                style={{
                  fontFamily    : "'Cormorant Garamond', serif",
                  color         : '#C9A84C',
                  fontSize      : '1rem',
                  fontWeight    : 500,
                  letterSpacing : '0.05em',
                }}
              >
                L
              </span>
            </div>
          </div>

          {/* Mode selector — 2 tabs only */}
          <ModeSelector
            activeMode={activeMode as Mode}
            onModeChange={(m) => setActiveMode(m as Exclude<Mode, 'internal'>)}
          />
        </div>
      </header>

      {/* ── Page content ── */}
      <main style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {activeMode === 'guest'    && <GuestConcierge    />}
        {activeMode === 'investor' && <InvestorAssistant />}
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          backgroundColor : '#1A1A2E',
          padding         : '7px 16px',
          flexShrink      : 0,
        }}
      >
        <p
          style={{
            fontFamily    : "'Jost', sans-serif",
            color         : '#4A4A6A',
            fontSize      : '0.6rem',
            letterSpacing : '0.06em',
            margin        : 0,
            textAlign     : 'center',
          }}
        >
          Leela Intelligence Platform v2 · Built by Rohan Kushvaha
        </p>
      </footer>
    </div>
  );
}

// ── App with router ────────────────────────────────────────────────────────

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<LIPLayout    />} />
        <Route path="/admin"      element={<AdminPanel   />} />
        <Route path="/bulk-ingest" element={<BulkIngest  />} />
        {/* Redirect any old /internal links to home */}
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
