interface ContextStripProps {
  chunkCount?    : number;
  propertyCount? : number;
  contextLabel?  : string;
}

type StripItemType = 'status' | 'meta' | 'source';

interface StripItem {
  type      : StripItemType;
  label     : string;
  dotColor? : string;
  icon?     : string;
}

export function ContextStrip({
  chunkCount    = 3236,
  propertyCount = 12,
  contextLabel,
}: ContextStripProps) {

  const items: StripItem[] = [
    { type: 'status', label: 'Knowledge Base Live',                   dotColor: '#3CB371' },
    { type: 'meta',   label: `${propertyCount} Properties`,            icon: '◈'          },
    { type: 'meta',   label: `${chunkCount.toLocaleString()} Sources`, icon: '◎'          },
    contextLabel
      ? { type: 'source' as const, label: contextLabel,       dotColor: '#C9A84C' }
      : { type: 'source' as const, label: 'Official Sources', dotColor: '#C9A84C' },
  ];

  return (
    <div
      style={{
        display        : 'flex',
        alignItems     : 'center',
        justifyContent : 'center',
        gap            : '14px',
        padding        : '9px 20px',
        borderTop      : '1px solid #EDE8DF',
        borderBottom   : '1px solid #EDE8DF',
        margin         : '0 20px',
        flexWrap       : 'wrap',
      }}
    >
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {i > 0 && (
            <div style={{ width: '1px', height: '11px', background: '#EDE8DF', flexShrink: 0 }} />
          )}
          <div
            style={{
              display       : 'flex',
              alignItems    : 'center',
              gap           : '5px',
              fontFamily    : "'Jost', sans-serif",
              fontSize      : '0.6rem',
              letterSpacing : '0.09em',
              textTransform : 'uppercase',
              color         : '#8A8A8A',
              whiteSpace    : 'nowrap',
            }}
          >
            {item.dotColor && (
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: item.dotColor, flexShrink: 0, display: 'inline-block' }} />
            )}
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
