// ============================================================
// Leela Intelligence Platform — Investor Relations Assistant
// ============================================================

import { ChatInterface } from '../components/ChatInterface';

const INVESTOR_SUGGESTIONS = [
  'What was FY26 full year revenue?',
  'What is the RevPAR for the owned portfolio?',
  'Tell me about the Dubai expansion',
  'What is the FY30 EBITDA target?',
];

export function InvestorAssistant() {
  return (
    <ChatInterface
      mode="investor"
      suggestions={INVESTOR_SUGGESTIONS}
      placeholder="Ask about financials, RevPAR, pipeline, or disclosures..."
    />
  );
}
