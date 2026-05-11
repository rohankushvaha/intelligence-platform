// ============================================================
// Leela Intelligence Platform — Message Bubble with Citations
// ============================================================

import type { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.lang = 'en-IN';
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
  };

  // Convert markdown-like **bold** and line breaks to JSX
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j}>{part.slice(2, -2)}</strong>;
            }
            return <span key={j}>{part}</span>;
          })}
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
              backgroundColor: '#EDE8DF',
              border: '0.5px solid #666666',
              color: '#1A1A2E',
              fontFamily: "'Jost', sans-serif",
              fontSize: '0.875rem',
            }}
          >
            {message.content}
          </div>
          <p
            className="text-right mt-1 text-xs"
            style={{ color: '#8A8A8A', fontFamily: "'Jost', sans-serif" }}
          >
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
          backgroundColor: '#21469F',
          color: '#FFFFFF',
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '0.75rem',
          letterSpacing: '0.05em',
        }}
      >
        L
      </div>

      <div className="flex-1 min-w-0 max-w-[80%] md:max-w-[70%]">
        <div
          className="px-4 py-3 rounded-lg text-sm leading-relaxed"
          style={{
            backgroundColor: '#FFFFFF',
            borderLeft: '2px solid #21469F',
            color: '#1A1A2E',
            fontFamily: "'Jost', sans-serif",
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            fontSize: '0.875rem',
            lineHeight: '1.7',
          }}
        >
          {message.isStreaming && !message.content ? (
            <span style={{ color: '#8A8A8A' }}>Searching knowledge base...</span>
          ) : (
            renderContent(message.content)
          )}
        </div>

        {/* Citation pills */}
        {message.sources && message.sources.length > 0 && !message.isStreaming && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.sources.map((source, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: '#21469F',
                  color: '#FFFFFF',
                  borderRadius: '4px',
                  fontFamily: "'Jost', sans-serif",
                  fontSize: '0.7rem',
                  letterSpacing: '0.02em',
                }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <rect x="0.5" y="0.5" width="7" height="7" rx="0.5" stroke="currentColor" strokeOpacity="0.5" />
                  <path d="M2 4h4M2 2.5h4M2 5.5h2.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
                </svg>
                {source}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1">
          <p
            className="text-xs"
            style={{ color: '#8A8A8A', fontFamily: "'Jost', sans-serif" }}
          >
            {formatTime(message.timestamp)}
          </p>
          {!message.isStreaming && (
            <>
              <button
                onClick={() => speakText(message.content)}
                style={{ color: '#8A8A8A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}
                title="Read aloud"
              >
                🔊
              </button>
              <button
                onClick={stopSpeech}
                style={{ color: '#8A8A8A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}
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
