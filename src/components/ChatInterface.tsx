// ============================================================
// Leela Intelligence Platform — Chat Interface Component
// ============================================================

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { SuggestionChips } from './SuggestionChips';
import { useRetrieval } from '../hooks/useRetrieval';
import { useChatStore } from '../hooks/useChat';
import type { Mode } from '../types';

interface ChatInterfaceProps {
  mode: Mode;
  suggestions: string[];
  placeholder: string;
}

export function ChatInterface({ mode, suggestions, placeholder }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { messages, isLoading, sendMessage } = useRetrieval(mode);
  const clearMessages = useChatStore((state) => state.clearMessages);

  const showSuggestions = messages.length === 0;
  const isTyping = isLoading && messages.length > 0 &&
    messages[messages.length - 1]?.role === 'assistant' &&
    messages[messages.length - 1]?.content === '';

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    await sendMessage(trimmed);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const handleClear = () => {
    clearMessages(mode);
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: '#F8F5F0' }}
    >
      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto py-4 leela-scroll"
        style={{ minHeight: 0 }}
      >
        {showSuggestions ? (
          <WelcomeState mode={mode} suggestions={suggestions} onSelect={handleSuggestion} isLoading={isLoading} />
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0"
        style={{
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #EDE8DF',
          padding: '12px 16px',
        }}
      >
        {/* Suggestions when chat is active */}
        {!showSuggestions && suggestions.length > 0 && (
          <div className="mb-2">
            <SuggestionChips
              suggestions={suggestions.slice(0, 2)}
              onSelect={handleSuggestion}
              disabled={isLoading}
            />
          </div>
        )}

        <div className="flex items-end gap-2">
          <div
            className="flex-1 flex items-end rounded-lg overflow-hidden"
            style={{
              border: '1px solid #EDE8DF',
              backgroundColor: '#FFFFFF',
              transition: 'border-color 200ms ease',
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = '#21469F';
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = '#EDE8DF';
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none outline-none px-4 py-3 text-sm bg-transparent disabled:opacity-50"
              style={{
                fontFamily: "'Jost', sans-serif",
                color: '#1A1A2E',
                minHeight: '44px',
                maxHeight: '120px',
                fontSize: '0.875rem',
                lineHeight: '1.5',
              }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#21469F',
              color: '#FFFFFF',
            }}
            onMouseEnter={(e) => {
              if (input.trim() && !isLoading) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1a3a87';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#21469F';
            }}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Clear button — only when messages exist */}
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-40"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #EDE8DF',
                color: '#8A8A8A',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#21469F';
                (e.currentTarget as HTMLButtonElement).style.color = '#21469F';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#EDE8DF';
                (e.currentTarget as HTMLButtonElement).style.color = '#8A8A8A';
              }}
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        <p
          className="text-center mt-2 text-xs"
          style={{ color: '#8A8A8A', fontFamily: "'Jost', sans-serif", letterSpacing: '0.03em' }}
        >
          AI responses are based on The Leela's knowledge base · Always verify critical details
        </p>
      </div>
    </div>
  );
}

// ===== Welcome state shown before first message =====

interface WelcomeStateProps {
  mode: Mode;
  suggestions: string[];
  onSelect: (s: string) => void;
  isLoading: boolean;
}

const MODE_WELCOME: Record<Mode, { title: string; subtitle: string }> = {
  guest: {
    title: 'Your Leela Concierge',
    subtitle: 'Ask me about properties, dining, spa, and experiences across The Leela collection',
  },
  investor: {
    title: 'Investor Intelligence',
    subtitle: 'Query financials, RevPAR, pipeline, and disclosures for Leela Palaces Hotels & Resorts',
  },
  internal: {
    title: 'Sales Intelligence Hub',
    subtitle: 'Pull property specs, F&B outlets, MICE capacity, and wedding packages instantly',
  },
};

function WelcomeState({ mode, suggestions, onSelect, isLoading }: WelcomeStateProps) {
  const welcome = MODE_WELCOME[mode];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      {/* Gold ornament */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px w-8" style={{ backgroundColor: '#C9A84C' }} />
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 1L12.2 7.2H18.8L13.5 10.8L15.7 17L10 13.4L4.3 17L6.5 10.8L1.2 7.2H7.8L10 1Z"
            fill="#C9A84C"
            opacity="0.7"
          />
        </svg>
        <div className="h-px w-8" style={{ backgroundColor: '#C9A84C' }} />
      </div>

      <h3
        className="text-2xl mb-3"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          color: '#1A1A2E',
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}
      >
        {welcome.title}
      </h3>
      <p
        className="text-sm leading-relaxed mb-8 max-w-sm"
        style={{
          fontFamily: "'Jost', sans-serif",
          color: '#8A8A8A',
          letterSpacing: '0.03em',
        }}
      >
        {welcome.subtitle}
      </p>

      <div className="w-full max-w-lg">
        <p
          className="text-xs mb-3 uppercase tracking-widest"
          style={{ color: '#8A8A8A', fontFamily: "'Jost', sans-serif" }}
        >
          Suggested Questions
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => !isLoading && onSelect(s)}
              disabled={isLoading}
              className="px-4 py-2 text-sm rounded-md transition-all duration-200 disabled:opacity-40"
              style={{
                border: '1px solid #21469F',
                color: '#21469F',
                backgroundColor: 'transparent',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 300,
                letterSpacing: '0.03em',
                fontSize: '0.8rem',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#21469F';
                  (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = '#21469F';
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
