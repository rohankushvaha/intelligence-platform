// ============================================================
// Leela Intelligence Platform — Guest Concierge Mode
// ============================================================

import { ChatInterface } from '../components/ChatInterface';

const GUEST_SUGGESTIONS = [
  'What dining options does The Leela New Delhi have?',
  'Which properties have an ESPA spa?',
  'Tell me about The Leela Udaipur experience',
  'What is the DISCOVERY loyalty programme?',
];

export function GuestConcierge() {
  return (
    <ChatInterface
      mode="guest"
      suggestions={GUEST_SUGGESTIONS}
      placeholder="Ask about properties, dining, experiences, or your stay..."
    />
  );
}
