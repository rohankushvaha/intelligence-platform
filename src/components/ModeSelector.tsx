// ============================================================
// Leela Intelligence Platform v2 — Mode Selector
// ============================================================
// Changes from v1:
//   - Internal Copilot tab removed entirely
//   - Active state: gold underline bar (not filled blue button)
//   - Investor tab has a small "IR" badge for instant context
//   - Hover state: gold text instead of blue background
// ============================================================

import type { Mode } from '../types';

interface ModeSelectorProps {
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
}

export function ModeSelector({ activeMode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="flex" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>

      {/* ── Guest Concierge tab ── */}
      <ModeTab
        id="guest"
        label="Guest Concierge"
        isActive={activeMode === 'guest'}
        onClick={() => onModeChange('guest')}
      />

      {/* Thin vertical divider between tabs */}
      <div
        style={{
          width: '1px',
          background: 'rgba(255,255,255,0.06)',
          margin: '8px 0',
          flexShrink: 0,
        }}
      />

      {/* ── Investor Assistant tab ── */}
      <ModeTab
        id="investor"
        label="Investor"
        badge="IR"
        isActive={activeMode === 'investor'}
        onClick={() => onModeChange('investor')}
      />
    </div>
  );
}

// ── Individual tab button ──────────────────────────────────────────────────

interface ModeTabProps {
  id: string;
  label: string;
  badge?: string;
  isActive: boolean;
  onClick: () => void;
}

function ModeTab({ label, badge, isActive, onClick }: ModeTabProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '10px 8px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          const label = e.currentTarget.querySelector('.tab-label') as HTMLElement;
          if (label) label.style.color = '#C9A84C';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          const label = e.currentTarget.querySelector('.tab-label') as HTMLElement;
          if (label) label.style.color = '#4A4A6A';
        }
      }}
    >
      {/* Label + optional badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          className="tab-label"
          style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: '0.68rem',
            fontWeight: 400,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: isActive ? '#F8F5F0' : '#4A4A6A',
            transition: 'color 0.2s ease',
          }}
        >
          {label}
        </span>

        {/* IR badge — investor mode only */}
        {badge && (
          <span
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: '0.5rem',
              letterSpacing: '0.12em',
              color: '#C9A84C',
              border: '1px solid rgba(201,168,76,0.35)',
              borderRadius: '2px',
              padding: '1px 4px',
              lineHeight: 1.4,
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Gold underline indicator — visible only on active tab */}
      <div
        style={{
          height: '2px',
          width: isActive ? '28px' : '0px',
          borderRadius: '1px',
          background: '#C9A84C',
          marginTop: '6px',
          transition: 'width 0.25s ease',
        }}
      />
    </button>
  );
}
