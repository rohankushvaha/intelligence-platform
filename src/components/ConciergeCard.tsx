// ============================================================
// Leela Intelligence Platform v2 — Concierge Card
// ============================================================
// Replaces the flat SuggestionChips with premium concierge cards.
// Each card has: category icon, question text, hint label.
// Gold left-border accent appears on hover.
// Used inside WelcomeState in ChatInterface.
// ============================================================

// ── Icon map for known card categories ────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  'Properties · Restaurants': '🍽',
  'Wellness · Experiences':   '✦',
  'Destinations · Heritage':  '◈',
  'Membership · Benefits':    '◇',
  'Financials · Revenue':     '◎',
  'Performance · KPIs':       '▲',
  'Pipeline · Growth':        '⊕',
  'Strategy · Outlook':       '◉',
};

const DEFAULT_ICON = '◇';

// ── Card config shape ──────────────────────────────────────────────────────

export interface ConciergeCardConfig {
  question: string; // Full question text sent to the model
  display: string;  // Shorter display version shown on the card
  hint: string;     // "Category · Subcategory" shown as helper text
}

// ── Single card ───────────────────────────────────────────────────────────

interface ConciergeCardProps {
  config: ConciergeCardConfig;
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export function ConciergeCard({ config, onSelect, disabled = false }: ConciergeCardProps) {
  const icon = CATEGORY_ICONS[config.hint] ?? DEFAULT_ICON;

  return (
    <button
      onClick={() => !disabled && onSelect(config.question)}
      disabled={disabled}
      style={{
        background: '#FFFFFF',
        border: '0.5px solid #EDE8DF',
        borderLeft: '2px solid transparent',
        borderRadius: '8px',
        padding: '12px 14px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease',
        opacity: disabled ? 0.5 : 1,
        width: '100%',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderLeftColor = '#C9A84C';
          el.style.borderColor = 'rgba(201,168,76,0.25)';
          el.style.boxShadow = '0 2px 12px rgba(201,168,76,0.07)';
          el.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderLeftColor = 'transparent';
          el.style.borderColor = '#EDE8DF';
          el.style.boxShadow = 'none';
          el.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '4px',
          background: '#F8F5F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          color: '#C9A84C',
          flexShrink: 0,
          fontFamily: "'Jost', sans-serif",
        }}
      >
        {icon}
      </div>

      {/* Question text */}
      <span
        style={{
          fontFamily: "'Jost', sans-serif",
          fontSize: '0.72rem',
          fontWeight: 400,
          color: '#1A1A2E',
          lineHeight: 1.4,
          letterSpacing: '0.01em',
        }}
      >
        {config.display}
      </span>

      {/* Category hint */}
      <span
        style={{
          fontFamily: "'Jost', sans-serif",
          fontSize: '0.6rem',
          color: '#8A8A8A',
          letterSpacing: '0.04em',
        }}
      >
        {config.hint}
      </span>
    </button>
  );
}

// ── Card grid wrapper ──────────────────────────────────────────────────────

interface ConciergeCardGridProps {
  cards: ConciergeCardConfig[];
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export function ConciergeCardGrid({ cards, onSelect, disabled = false }: ConciergeCardGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        width: '100%',
      }}
    >
      {cards.map((card, i) => (
        <ConciergeCard
          key={i}
          config={card}
          onSelect={onSelect}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
