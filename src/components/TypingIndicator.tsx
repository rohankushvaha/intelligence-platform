// ============================================================
// Leela Intelligence Platform — Typing Indicator
// ============================================================

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-2">
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
        style={{ backgroundColor: '#21469F', color: '#FFFFFF', fontFamily: "'Cormorant Garamond', serif" }}
      >
        L
      </div>
      <div
        className="flex items-center gap-1.5 px-4 py-3 rounded-lg"
        style={{
          backgroundColor: '#FFFFFF',
          borderLeft: '2px solid #21469F',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full typing-dot"
          style={{ backgroundColor: '#21469F' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full typing-dot"
          style={{ backgroundColor: '#21469F' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full typing-dot"
          style={{ backgroundColor: '#21469F' }}
        />
      </div>
    </div>
  );
}
