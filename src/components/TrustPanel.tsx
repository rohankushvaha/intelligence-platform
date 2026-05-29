// ============================================================
// Leela Intelligence Platform v2 — Trust Panel
// ============================================================
// Replaces the bare "Source · All | Official | Press" filter row
// with a framed evidence control panel.
//
// Left:  Shield icon + "Leela Knowledge Base" + subline
// Right: Source filter chips (All / Official / Press)
//
// The framing shifts perception from "toggle" to "evidence control"
// — a subtle but meaningful trust signal for an AI product.
// ============================================================

import type { SourceFilter } from '../types';

interface TrustPanelProps {
  sourceFilter    : SourceFilter;
  onFilterChange  : (filter: SourceFilter) => void;
  /** Pass true for investor mode — hides Competitive chip */
  investorMode?  : boolean;
}

const FILTERS: { value: SourceFilter; label: string; investorOnly?: boolean }[] = [
  { value: 'all',      label: 'All'      },
  { value: 'official', label: 'Official' },
  { value: 'press',    label: 'Press'    },
];

export function TrustPanel({ sourceFilter, onFilterChange, investorMode = false }: TrustPanelProps) {
  const visibleFilters = FILTERS.filter(f => !f.investorOnly || investorMode);

  return (
    <div
      style={{
        margin          : '0 16px 14px',
        background      : '#FFFFFF',
        border          : '0.5px solid #EDE8DF',
        borderRadius    : '8px',
        padding         : '10px 14px',
        display         : 'flex',
        alignItems      : 'center',
        justifyContent  : 'space-between',
        gap             : '12px',
        flexWrap        : 'wrap',
      }}
    >
      {/* ── Left: branding ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Shield icon */}
        <div
          style={{
            width           : '28px',
            height          : '28px',
            borderRadius    : '50%',
            background      : '#F8F5F0',
            border          : '1px solid #EDE8DF',
            display         : 'flex',
            alignItems      : 'center',
            justifyContent  : 'center',
            flexShrink      : 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
              stroke="#21469F"
              strokeWidth="1.5"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M9 12l2 2 4-4"
              stroke="#21469F"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Labels */}
        <div>
          <div
            style={{
              fontFamily    : "'Jost', sans-serif",
              fontSize      : '0.7rem',
              fontWeight    : 400,
              color         : '#1A1A2E',
              letterSpacing : '0.03em',
            }}
          >
            Leela Knowledge Base
          </div>
          <div
            style={{
              fontFamily    : "'Jost', sans-serif",
              fontSize      : '0.58rem',
              color         : '#8A8A8A',
              letterSpacing : '0.04em',
              marginTop     : '1px',
            }}
          >
            Answers sourced from verified Leela content
          </div>
        </div>
      </div>

      {/* ── Right: filter chips ── */}
      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
        {visibleFilters.map((f) => (
          <FilterChip
            key={f.value}
            label={f.label}
            isActive={sourceFilter === f.value}
            onClick={() => onFilterChange(f.value)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Single filter chip ─────────────────────────────────────────────────────

interface FilterChipProps {
  label     : string;
  isActive  : boolean;
  onClick   : () => void;
}

function FilterChip({ label, isActive, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily      : "'Jost', sans-serif",
        fontSize        : '0.58rem',
        letterSpacing   : '0.07em',
        textTransform   : 'uppercase',
        padding         : '4px 9px',
        borderRadius    : '20px',
        cursor          : 'pointer',
        transition      : 'all 0.18s ease',
        border          : `1px solid ${isActive ? '#21469F' : '#EDE8DF'}`,
        background      : isActive ? '#21469F' : 'transparent',
        color           : isActive ? '#FFFFFF' : '#8A8A8A',
        whiteSpace      : 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#C9A84C';
          (e.currentTarget as HTMLButtonElement).style.color = '#C9A84C';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#EDE8DF';
          (e.currentTarget as HTMLButtonElement).style.color = '#8A8A8A';
        }
      }}
    >
      {label}
    </button>
  );
}
