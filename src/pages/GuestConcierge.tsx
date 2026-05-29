// ============================================================
// Leela Intelligence Platform v2 — Guest Concierge Mode
// ============================================================
// Changes from v1:
//   - suggestions[] replaced with ConciergeCardConfig[] (cards)
//   - Each card has question, display text, and category hint
//   - inputLabel="Concierge" sets the composer prefix
// ============================================================

import { ChatInterface }            from '../components/ChatInterface';
import type { ConciergeCardConfig } from '../components/ConciergeCard';

const GUEST_CARDS: ConciergeCardConfig[] = [
  {
    question : 'What dining options does The Leela New Delhi have?',
    display  : 'Dining at The Leela New Delhi?',
    hint     : 'Properties · Restaurants',
  },
  {
    question : 'Which Leela properties have an ESPA spa?',
    display  : 'Which properties have ESPA spa?',
    hint     : 'Wellness · Experiences',
  },
  {
    question : 'Tell me about The Leela Udaipur experience',
    display  : 'The Leela Udaipur — what\'s special?',
    hint     : 'Destinations · Heritage',
  },
  {
    question : 'What is the DISCOVERY loyalty programme?',
    display  : 'About DISCOVERY loyalty?',
    hint     : 'Membership · Benefits',
  },
];

export function GuestConcierge() {
  return (
    <ChatInterface
      mode="guest"
      cards={GUEST_CARDS}
      placeholder="Ask about properties, dining, experiences, or your stay…"
      inputLabel="Concierge"
    />
  );
}
