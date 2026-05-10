// ============================================================
// Leela Intelligence Platform — Suggestion Chips
// ============================================================

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}

export function SuggestionChips({ suggestions, onSelect, disabled = false }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-3">
      {suggestions.map((suggestion, idx) => (
        <button
          key={idx}
          onClick={() => !disabled && onSelect(suggestion)}
          disabled={disabled}
          className="px-3 py-1.5 text-sm rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            border: '1px solid #21469F',
            color: '#21469F',
            backgroundColor: 'transparent',
            fontFamily: "'Jost', sans-serif",
            fontWeight: 300,
            letterSpacing: '0.05em',
            fontSize: '0.8rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#21469F';
              (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#21469F';
            }
          }}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
