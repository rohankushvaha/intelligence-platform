// ============================================================
// Leela Intelligence Platform v2 — Context Strip
// ============================================================
// A slim horizontal bar shown below the hero title.
// Displays live metadata: KB status, property count, chunk count,
// and active source tier. Fills the dead space between the hero
// and the concierge cards without adding dashboard clutter.
//
// Data is static for now; wire to fetchKBStats() in Phase 4
// when LangSmith observability is added.
// ============================================================

interface ContextStripProps {
  /** Override the default chunk count (e.g. from a live stats call) */
  chunkCount?: number;
  /** Override the default property count */
  propertyCount?: number;
  /** Custom additional item to show (e.g. current property context) */
  contextLabel?: string;
}

interface StripItem {
  type: 'status' | 'meta' | 'source';
  label: string;
  dotColor?: string;
  icon?: string;
}

export function ContextStrip({
  chunkCount    = 3236,
  propertyCount = 12,
  contextLabel,
}: ContextStripProps) {

  const items: StripItem[] = [
    { type: 'status', label: 'Knowledge Base Live',     dotColor: '#3CB371' },
    { type: 'meta',   label: `${propertyCount} Properties`, icon: '◈' },
    { type: 'meta',   label: `${chunkCount.toLocaleString()} Sources`, icon: '◎' },
    ...(contextLabel ? [{ type: 'source' as const, label: contextLabel, dotColor: '#C9A84C' }] : [
      { type: 'source', label: 'Official Sources', dotColor: '#C9A84C' },
    ]),
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        padding: '9px 20px',
        borderTop: '1px solid #EDE8DF',
        borderBottom: '1px solid #EDE8DF',
        margin: '0 20px',
        flexWrap: 'wrap',
      }}
    >
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Separator (not before first item) */}
          {i > 0 && (
            <div
              style={{
                width: '1px',
                height: '11px',
                background: '#EDE8DF',
                flexShrink: 0,
              }}
            />
          )}

          {/* Item */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontFamily: "'Jost', sans-serif",
              fontSize: '0.6rem',
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: '#8A8A8A',
              whiteSpace: 'nowrap',
            }}
          >
            {/* Dot indicator (for status / source items) */}
            {item.dotColor && (
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: item.dotColor,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
            )}

            {/* Text icon (for meta items) */}
            {item.icon && (
              <span style={{ color: '#C9A84C', fontSize: '9px' }}>{item.icon}</span>
            )}

            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
