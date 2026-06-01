// ============================================================
// THE LEELA CONCIERGE OS
// Component: ExperienceCards
// ============================================================
// Replaces the flat white ConciergeCardGrid with cinematic
// image-backed tiles. Each card occupies real visual space
// and communicates category through mood and imagery.
//
// Cards:
//   Dining      — warm amber/bronze — "11 Restaurants"
//   Wellness    — deep teal/green  — "ESPA Partnership"
//   Experiences — midnight blue    — "32 Experiences"
//   Investor    — pure navy        — IR metrics
//
// Hover: translateY(-4px) + expanded glow
// No buttons. No chip navigation. Just visual discovery.
// ============================================================

import type { ConciergeCardConfig } from './ConciergeCard';

// ── Experience category config ─────────────────────────────────────────────

export interface ExperienceCardConfig {
  id         : string;
  title      : string;
  subtitle   : string;
  micro      : string;      // "ESPA Partnership" / "11 Restaurants" etc.
  microLabel?: string;      // optional label above micro (e.g. "CURATED")
  mood       : string;      // CSS gradient — simulates property imagery mood
  query      : string;      // query sent to concierge on click
}

const DEFAULT_CARDS: ExperienceCardConfig[] = [
  {
    id       : 'dining',
    title    : 'Dining',
    subtitle : 'Signature culinary experiences',
    micro    : '11 Restaurants',
    mood     : 'linear-gradient(145deg, #1a0a05 0%, #4a2810 30%, #3a2010 60%, #1a0a05 100%)',
    query    : 'Tell me about dining experiences across The Leela properties',
  },
  {
    id       : 'wellness',
    title    : 'Wellness',
    subtitle : 'Rejuvenate mind, body and soul',
    micro    : 'ESPA Partnership',
    microLabel: 'Curated',
    mood     : 'linear-gradient(145deg, #050f0a 0%, #0a2a18 30%, #102a18 60%, #050f0a 100%)',
    query    : 'What wellness and spa experiences does The Leela offer?',
  },
  {
    id       : 'experiences',
    title    : 'Experiences',
    subtitle : 'Craft unforgettable moments',
    micro    : '32 Experiences',
    mood     : 'linear-gradient(145deg, #05080f 0%, #0a1535 30%, #102040 60%, #05080f 100%)',
    query    : 'What curated experiences can I book at The Leela?',
  },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface ExperienceCardsProps {
  cards?      : ExperienceCardConfig[];
  onSelect    : (query: string) => void;
  disabled?   : boolean;
  showInvestor?: boolean;

  // IR metrics for investor card
  irMetrics?: { value: string; label: string }[];
  onInvestorClick?: () => void;
}

// ── Helper to convert ConciergeCardConfig → ExperienceCardConfig ───────────
export function toExperienceCard(c: ConciergeCardConfig, mood: string): ExperienceCardConfig {
  return {
    id       : c.display,
    title    : c.display,
    subtitle : c.hint,
    micro    : c.hint,
    mood,
    query    : c.question,
  };
}

// ── Default IR metrics ─────────────────────────────────────────────────────

const DEFAULT_IR: { value: string; label: string }[] = [
  { value: '₹2,408 Cr', label: 'FY26 Revenue'    },
  { value: '₹28,500',   label: 'RevPAR — Owned'  },
  { value: '12',         label: 'Properties'      },
  { value: 'FY30',       label: 'EBITDA Target'   },
];

// ── Main component ─────────────────────────────────────────────────────────

export function ExperienceCards({
  cards          = DEFAULT_CARDS,
  onSelect,
  disabled       = false,
  showInvestor   = true,
  irMetrics      = DEFAULT_IR,
  onInvestorClick,
}: ExperienceCardsProps) {
  return (
    <section
      style={{ padding: '28px 48px 24px' }}
      aria-label="Curated experiences"
    >
      {/* Section label */}
      <p style={{
        fontFamily    : "'Inter', sans-serif",
        fontSize      : '0.6rem',
        letterSpacing : '0.2em',
        textTransform : 'uppercase',
        color         : 'rgba(249,247,242,0.35)',
        marginBottom  : '16px',
      }}>
        Curated for you
      </p>

      {/* Card grid */}
      <div style={{
        display              : 'grid',
        gridTemplateColumns  : showInvestor
          ? `repeat(${cards.length}, 1fr) 1.15fr`
          : `repeat(${cards.length}, 1fr)`,
        gap  : '14px',
        alignItems: 'stretch',
      }}>
        {/* Experience cards */}
        {cards.map((card) => (
          <ExperienceCard
            key={card.id}
            card={card}
            onSelect={onSelect}
            disabled={disabled}
          />
        ))}

        {/* Investor card — distinct dark treatment */}
        {showInvestor && (
          <InvestorCard
            metrics={irMetrics}
            onClick={onInvestorClick}
            disabled={disabled}
          />
        )}
      </div>
    </section>
  );
}

// ── Single experience card ─────────────────────────────────────────────────

function ExperienceCard({
  card, onSelect, disabled,
}: {
  card: ExperienceCardConfig;
  onSelect: (q: string) => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onSelect(card.query)}
      disabled={disabled}
      aria-label={`${card.title} — ${card.subtitle}`}
      style={{
        height       : '200px',
        borderRadius : '20px',
        position     : 'relative',
        overflow     : 'hidden',
        cursor       : disabled ? 'not-allowed' : 'pointer',
        border       : '1px solid rgba(191,161,107,0.1)',
        background   : card.mood,
        transition   : 'transform 0.25s ease, box-shadow 0.25s ease',
        textAlign    : 'left',
        padding      : 0,
        opacity      : disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = 'translateY(-4px)';
          el.style.boxShadow = '0 20px 50px rgba(0,0,0,0.5)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = 'none';
        }
      }}
    >
      {/* Bottom gradient overlay for text legibility */}
      <div
        aria-hidden="true"
        style={{
          position   : 'absolute',
          inset      : 0,
          background : 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Micro badge — top right */}
      {card.micro && (
        <div
          aria-hidden="true"
          style={{
            position      : 'absolute',
            top           : '14px',
            right         : '14px',
            background    : 'rgba(191,161,107,0.15)',
            border        : '1px solid rgba(191,161,107,0.3)',
            borderRadius  : '20px',
            padding       : '3px 10px',
            fontFamily    : "'Inter', sans-serif",
            fontSize      : '0.58rem',
            letterSpacing : '0.1em',
            color         : '#BFA16B',
          }}
        >
          {card.micro}
        </div>
      )}

      {/* Card text — bottom */}
      <div
        style={{
          position : 'absolute',
          bottom   : 0,
          left     : 0,
          right    : 0,
          padding  : '18px',
          zIndex   : 2,
        }}
      >
        {card.microLabel && (
          <div style={{
            fontFamily    : "'Inter', sans-serif",
            fontSize      : '0.55rem',
            letterSpacing : '0.18em',
            textTransform : 'uppercase',
            color         : '#BFA16B',
            marginBottom  : '5px',
            opacity       : 0.8,
          }}>
            {card.microLabel}
          </div>
        )}
        <div style={{
          fontFamily    : "'Cormorant Garamond', serif",
          fontSize      : '1.2rem',
          fontWeight    : 400,
          color         : '#F9F7F2',
          lineHeight    : 1.2,
          marginBottom  : '4px',
        }}>
          {card.title}
        </div>
        <div style={{
          fontFamily    : "'Inter', sans-serif",
          fontSize      : '0.65rem',
          color         : 'rgba(249,247,242,0.55)',
          letterSpacing : '0.03em',
        }}>
          {card.subtitle}
        </div>
      </div>
    </button>
  );
}

// ── Investor card ──────────────────────────────────────────────────────────

function InvestorCard({
  metrics, onClick, disabled,
}: {
  metrics  : { value: string; label: string }[];
  onClick? : () => void;
  disabled : boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onClick?.()}
      disabled={disabled}
      aria-label="Investor Intelligence — IR metrics"
      style={{
        height       : '200px',
        borderRadius : '20px',
        position     : 'relative',
        overflow     : 'hidden',
        cursor       : disabled ? 'not-allowed' : 'pointer',
        border       : '1px solid rgba(191,161,107,0.15)',
        background   : 'linear-gradient(145deg, #06080f 0%, #0A1028 50%, #060810 100%)',
        transition   : 'transform 0.25s ease, box-shadow 0.25s ease',
        textAlign    : 'left',
        padding      : 0,
        opacity      : disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = 'translateY(-4px)';
          el.style.boxShadow = '0 20px 50px rgba(0,0,0,0.6)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = 'none';
        }
      }}
    >
      {/* IR metrics grid */}
      <div style={{
        display              : 'grid',
        gridTemplateColumns  : '1fr 1fr',
        gap                  : '10px',
        padding              : '18px',
      }}>
        {metrics.map((m, i) => (
          <div key={i}>
            <div style={{
              fontFamily    : "'Cormorant Garamond', serif",
              fontSize      : 'clamp(1rem, 2.5vw, 1.3rem)',
              color         : '#F9F7F2',
              fontWeight    : 400,
              letterSpacing : '0.01em',
              lineHeight    : 1.2,
            }}>
              {m.value}
            </div>
            <div style={{
              fontFamily    : "'Inter', sans-serif",
              fontSize      : '0.58rem',
              color         : 'rgba(249,247,242,0.38)',
              letterSpacing : '0.08em',
              marginTop     : '2px',
            }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom title */}
      <div
        style={{
          position : 'absolute',
          bottom   : 0,
          left     : 0,
          right    : 0,
          padding  : '14px 18px',
          background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.6))',
        }}
      >
        <div style={{
          fontFamily    : "'Inter', sans-serif",
          fontSize      : '0.55rem',
          letterSpacing : '0.18em',
          textTransform : 'uppercase',
          color         : '#BFA16B',
          marginBottom  : '3px',
          opacity       : 0.7,
        }}>
          Intelligence
        </div>
        <div style={{
          fontFamily    : "'Cormorant Garamond', serif",
          fontSize      : '1.1rem',
          fontWeight    : 400,
          color         : '#F9F7F2',
        }}>
          Investor IR
        </div>
      </div>

      {/* Gold bottom accent line */}
      <div
        aria-hidden="true"
        style={{
          position   : 'absolute',
          bottom     : 0,
          left       : 0,
          right      : 0,
          height     : '2px',
          background : 'linear-gradient(90deg, transparent, #BFA16B 35%, #E8D08A 50%, #BFA16B 65%, transparent)',
        }}
      />
    </button>
  );
}
