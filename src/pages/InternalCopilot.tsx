// ============================================================
// Leela Intelligence Platform — Internal Copilot (PIN Protected)
// PIN: 1986 — Founding year of The Leela
// ============================================================

import { useState } from 'react';
import { PINGate } from '../components/PINGate';
import { ChatInterface } from '../components/ChatInterface';

const INTERNAL_SUGGESTIONS = [
  'What is the MICE capacity at The Leela Mumbai?',
  'List all F&B outlets at The Leela Palace Bengaluru',
  'Wedding package details for The Leela Chennai',
  'Room count and category breakdown for Leela Kovalam',
];

export function InternalCopilot() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <PINGate onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <ChatInterface
      mode="internal"
      suggestions={INTERNAL_SUGGESTIONS}
      placeholder="Ask about room counts, F&B outlets, MICE capacity, or packages..."
    />
  );
}
