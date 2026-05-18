// ============================================================
// Leela Intelligence Platform v2 — Message Bubble with Source Badges
// ============================================================
// Changes from v1:
//   - SourceBadge component replaces plain source pills
//   - Shows source tier (official/press/competitive) per citation
//   - sourceTypes from message used to colour-code badges
// ============================================================

import type { Message, SourceType } from '../types';

interface MessageBubbleProps {
  message: Message;
}

// ── Source badge config ────────────────────────────────────────────────────

const SOURCE_BADGE: Record<SourceType, { label: string; bg: string; color: string }> = {
  official   : { label: 'Official',    bg: '#21469F', color: '#FFFFFF'  },
  press      : { label: 'Press',       bg: '#C9A84C', color: '#1A1A2E' },
  competitive: { label: 'Competitive', bg: '#1A1A2E', color: '#FFFFFF'  },
  ugc        : { label: 'Reviews',     bg: '#EDE8DF', color: '#1A1A2E' },
};

function SourceBadge({ sourceType }: { sourceType: SourceType }) {
  const config = SOURCE_BADGE[sourceType] ?? SOURCE_BADGE.official;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor : config.bg,
        color           : config.color,
        fontFamily      : "'Jost', sans-serif",
        fontSize        : '0.65rem',
        letterSpacing   : '0.04em',
      }}
    >
      {config.label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const formatTime = (date: Date) =>
    new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = 0.9;
    utterance.pitch = 1.0;
    utterance.lang  = 'en-IN';
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => window.speechSynthesis.cancel();

  const renderContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j}>{part.slice(2, -2)}</strong>
              : <span key={j}>{part}</span>
          )}
          {i < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-1.5">
        <div className="max-w-[75%] md:max-w-[60%]">
          <div
            className="px-4 py-3 rounded-lg text-sm leading-relaxed"
            style={{
              backgroundColor : '#EDE8DF',
              border          : '0.5px solid #666666',
              color           : '#1A1A2E',
              fontFamily      : "'Jost', sans-serif",
              fontSize        : '0.875rem',
            }}
          >
            {message.content}
          </div>
          <p className="text-right mt-1 text-xs" style={{ color: '#8A8A8A' }}>
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-1.5">
      {/* Leela avatar */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5"
        style={{
          backgroundColor : '#21469F',
          color           : '#FFFFFF',
          fontFamily      : "'Cormorant Garamond', serif",
          fontSize        : '0.75rem',
          letterSpacing   : '0.05em',
        }}
      >
        L
      </div>

      <div className="flex-1 min-w-0 max-w-[80%] md:max-w-[70%]">
        <div
          className="px-4 py-3 rounded-lg text-sm leading-relaxed"
          style={{
            backgroundColor : '#FFFFFF',
            borderLeft      : '2px solid #21469F',
            color           : '#1A1A2E',
            fontFamily      : "'Jost', sans-serif",
            boxShadow       : '0 2px 8px rgba(0,0,0,0.06)',
            fontSize        : '0.875rem',
            lineHeight      : '1.7',
          }}
        >
          {message.isStreaming && !message.content ? (
            <span style={{ color: '#8A8A8A' }}>Searching knowledge base...</span>
          ) : (
            renderContent(message.content)
          )}
        </div>

        {/* ── v2: Source badges with tier colour coding ── */}
        {message.sources && message.sources.length > 0 && !message.isStreaming && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {/* Source type badges — one per unique type */}
            {message.sourceTypes && message.sourceTypes.length > 0 && (
              <>
                {message.sourceTypes.map((type, idx) => (
                  <SourceBadge key={idx} sourceType={type} />
                ))}
                <span style={{ color: '#EDE8DF' }}>·</span>
              </>
            )}

            {/* Source name pills */}
            {message.sources.map((source, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs"
                style={{
                  backgroundColor : '#F8F5F0',
                  color           : '#1A1A2E',
                  border          : '1px solid #EDE8DF',
                  borderRadius    : '4px',
                  fontFamily      : "'Jost', sans-serif",
                  fontSize        : '0.68rem',
                }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <rect x="0.5" y="0.5" width="7" height="7" rx="0.5" stroke="#21469F" strokeOpacity="0.5" />
                  <path d="M2 4h4M2 2.5h4M2 5.5h2.5" stroke="#21469F" strokeWidth="0.8" strokeLinecap="round" />
                </svg>
                {source}
              </span>
            ))}
          </div>
        )}

        {/* Timestamp + voice controls */}
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs" style={{ color: '#8A8A8A', fontFamily: "'Jost', sans-serif" }}>
            {formatTime(message.timestamp)}
          </p>
          {!message.isStreaming && (
            <>
              <button
                onClick={() => speakText(message.content)}
                style={{ color: '#8A8A8A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title="Read aloud"
              >
                🔊
              </button>
              <button
                onClick={stopSpeech}
                style={{ color: '#8A8A8A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title="Stop"
              >
                ⏹
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
