// ============================================================
// Leela Intelligence Platform — Root Application
// ============================================================

import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ModeSelector } from './components/ModeSelector';
import { GuestConcierge } from './pages/GuestConcierge';
import { InvestorAssistant } from './pages/InvestorAssistant';
import { InternalCopilot } from './pages/InternalCopilot';
import { AdminPanel } from './pages/AdminPanel';
import { BulkIngest } from './pages/BulkIngest';
import type { Mode } from './types';

// ===== Main LIP Layout =====

function LIPLayout() {
  const [activeMode, setActiveMode] = useState<Mode>('guest');

  const renderPage = () => {
    switch (activeMode) {
      case 'guest': return <GuestConcierge />;
      case 'investor': return <InvestorAssistant />;
      case 'internal': return <InternalCopilot />;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100svh',
        backgroundColor: '#F8F5F0',
        fontFamily: "'Jost', sans-serif",
      }}
    >
      {/* ===== Header ===== */}
      <header style={{ backgroundColor: '#1A1A2E', flexShrink: 0 }}>
        {/* Gold accent line — very top */}
        <div className="leela-gold-line" />

        <div style={{ padding: '12px 16px 10px' }}>
          {/* Brand row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  color: '#F8F5F0',
                  fontSize: 'clamp(1.1rem, 3vw, 1.4rem)',
                  fontWeight: 500,
                  margin: 0,
                  letterSpacing: '0.02em',
                  lineHeight: 1.2,
                }}
              >
                The Leela Intelligence Platform
              </h1>
              <p
                style={{
                  fontFamily: "'Jost', sans-serif",
                  color: '#666666',
                  fontSize: '0.6rem',
                  letterSpacing: '0.2em',
                  margin: '3px 0 0',
                  textTransform: 'uppercase',
                }}
              >
                Powered by Gemini · RAG Knowledge Assistant
              </p>
            </div>

            {/* Leela monogram */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1.5px solid rgba(201,168,76,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  color: '#C9A84C',
                  fontSize: '1rem',
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                }}
              >
                L
              </span>
            </div>
          </div>

          {/* Mode selector */}
          <ModeSelector activeMode={activeMode} onModeChange={setActiveMode} />
        </div>
      </header>

      {/* ===== Chat content area ===== */}
      <main style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {renderPage()}
      </main>

      {/* ===== Footer ===== */}
      <footer style={{ backgroundColor: '#1A1A2E', padding: '8px 16px', flexShrink: 0 }}>
        <p
          style={{
            fontFamily: "'Jost', sans-serif",
            color: '#666666',
            fontSize: '0.65rem',
            letterSpacing: '0.06em',
            margin: 0,
            textAlign: 'center',
          }}
        >
          Leela Intelligence Platform v1.0 — Built by Rohan Kushvaha
        </p>
      </footer>
    </div>
  );
}

// ===== App with Router =====

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LIPLayout />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/bulk-ingest" element={<BulkIngest />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
