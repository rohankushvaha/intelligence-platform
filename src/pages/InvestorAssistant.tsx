// ============================================================
// Leela Intelligence Platform v2 — Investor Assistant
// ============================================================
// Changes from v1:
//   - IRMetricCard added above the ChatInterface (dark navy, 3 KPIs)
//   - suggestions[] replaced with ConciergeCardConfig[] (cards)
//   - inputLabel passed as "IR Query" for the composer prefix
// ============================================================

import { ChatInterface }             from '../components/ChatInterface';
import type { ConciergeCardConfig }  from '../components/ConciergeCard';

// ── Investor concierge cards ───────────────────────────────────────────────

const INVESTOR_CARDS: ConciergeCardConfig[] = [
  {
    question : 'What was FY26 full year revenue?',
    display  : 'FY26 full-year revenue?',
    hint     : 'Financials · Revenue',
  },
  {
    question : 'What is the RevPAR for the owned portfolio?',
    display  : 'RevPAR — owned portfolio?',
    hint     : 'Performance · KPIs',
  },
  {
    question : 'Tell me about the Dubai expansion plans',
    display  : 'Dubai expansion timeline?',
    hint     : 'Pipeline · Growth',
  },
  {
    question : 'What is the FY30 EBITDA target?',
    display  : 'FY30 EBITDA target?',
    hint     : 'Strategy · Outlook',
  },
];

// ── IR metric snapshot (static — update from KB in Phase 4) ───────────────

const IR_METRICS = [
  { value: '₹2,408 Cr', label: 'FY26 Revenue'       },
  { value: '₹28,500',   label: 'RevPAR — Owned'     },
  { value: '₹1,200 Cr', label: 'EBITDA Target FY30' },
];

// ── Main page ──────────────────────────────────────────────────────────────

export function InvestorAssistant() {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#F8F5F0' }}>

      {/* ── IR Metric card — sits above the chat area ── */}
      <IRMetricCard />

      {/* ── Chat interface fills remaining space ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ChatInterface
          mode="investor"
          cards={INVESTOR_CARDS}
          placeholder="Ask about financials, RevPAR, pipeline, or disclosures…"
          inputLabel="IR Query"
        />
      </div>
    </div>
  );
}

// ── IR metric card ─────────────────────────────────────────────────────────

function IRMetricCard() {
  return (
    <div
      style={{
        margin          : '12px 16px 0',
        background      : '#1A1A2E',
        borderRadius    : '10px',
        padding         : '14px 18px 16px',
        flexShrink      : 0,
        position        : 'relative',
        overflow        : 'hidden',
      }}
    >
      {/* Gold accent line at bottom */}
      <div
        style={{
          position   : 'absolute',
          bottom     : 0,
          left       : 0,
          right      : 0,
          height     : '2px',
          background : 'linear-gradient(90deg, transparent, #C9A84C 30%, #E8D08A 50%, #C9A84C 70%, transparent)',
        }}
      />

      {/* Label */}
      <div
        style={{
          fontFamily    : "'Jost', sans-serif",
          fontSize      : '0.55rem',
          letterSpacing : '0.2em',
          textTransform : 'uppercase',
          color         : '#4A4A6A',
          marginBottom  : '12px',
        }}
      >
        Leela Palaces Hotels &amp; Resorts · IR Snapshot
      </div>

      {/* Metrics row */}
      <div
        style={{
          display               : 'grid',
          gridTemplateColumns   : 'repeat(3, 1fr)',
          gap                   : '12px',
        }}
      >
        {IR_METRICS.map((metric, i) => (
          <div key={i}>
            <div
              style={{
                fontFamily    : "'Cormorant Garamond', serif",
                fontSize      : 'clamp(1.1rem, 3vw, 1.4rem)',
                fontWeight    : 500,
                color         : '#F8F5F0',
                letterSpacing : '0.01em',
                lineHeight    : 1.2,
              }}
            >
              {metric.value}
            </div>
            <div
              style={{
                fontFamily    : "'Jost', sans-serif",
                fontSize      : '0.58rem',
                color         : '#4A4A6A',
                letterSpacing : '0.07em',
                marginTop     : '3px',
              }}
            >
              {metric.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
