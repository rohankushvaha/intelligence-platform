// ============================================================
// Leela Intelligence Platform — Mode Tab Selector
// ============================================================

import type { Mode } from '../types';

interface ModeSelectorProps {
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
}

const MODES: Array<{ id: Mode; label: string; subtitle: string }> = [
  { id: 'guest', label: 'Guest Concierge', subtitle: 'Property & Stay Information' },
  { id: 'investor', label: 'Investor Assistant', subtitle: 'IR & Financial Intelligence' },
  { id: 'internal', label: 'Internal Copilot', subtitle: 'Sales & Marketing Intel' },
];

export function ModeSelector({ activeMode, onModeChange }: ModeSelectorProps) {
  return (
    <div
      className="flex gap-1 p-1 rounded-lg"
      style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
    >
      {MODES.map(({ id, label }) => {
        const isActive = activeMode === id;
        return (
          <button
            key={id}
            onClick={() => onModeChange(id)}
            className="relative flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200"
            style={{
              fontFamily: "'Jost', sans-serif",
              letterSpacing: '0.04em',
              backgroundColor: isActive ? '#21469F' : 'transparent',
              color: isActive ? '#FFFFFF' : '#C9A84C',
              border: isActive ? 'none' : '1px solid rgba(201,168,76,0.4)',
              fontWeight: isActive ? 500 : 400,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  'rgba(33,70,159,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
