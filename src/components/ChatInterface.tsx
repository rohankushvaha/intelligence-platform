// ============================================================
// Leela Intelligence Platform v2 — Chat Interface
// ============================================================
// Changes from v1:
//   - WelcomeState now uses ConciergeCardGrid (not SuggestionChips)
//   - ContextStrip fills the dead hero space with live KB metadata
//   - TrustPanel replaces raw source filter chips
//   - Input border focus ring switches from navy → gold
//   - "Concierge / IR Query" tag prefix inside input field
//   - Competitive filter chip removed (internal mode removed)
//   - Header subtitle reflects active mode via prop
// ============================================================

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { MessageBubble }    from './MessageBubble';
import { TypingIndicator }  from './TypingIndicator';
import { ConciergeCardGrid, type ConciergeCardConfig } from './ConciergeCard';
import { ContextStrip }     from './ContextStrip';
import { useRetrieval }     from '../hooks/useRetrieval';
import { useChatStore }     from '../hooks/useChat';
import type { Mode, SourceFilter } from '../types';

// ── Props ──────────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  mode        : Mode;
  cards       : ConciergeCardConfig[];   // replaces `suggestions: string[]`
  placeholder : string;
  inputLabel  : string;                  // "Concierge" | "IR Query"
}

// ── Source filter options (no 'competitive' — internal mode removed) ───────

const FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'all',      label: 'All Sources' },
  { value: 'official', label: 'Official'    },
  { value: 'press',    label: 'Press'       },
];

// ── Main component ─────────────────────────────────────────────────────────

export function ChatInterface({ mode, cards, placeholder, inputLabel }: ChatInterfaceProps) {
  const [input,        setInput]        = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const inputWrapRef   = useRef<HTMLDivElement>(null);

  const { messages, isLoading, sendMessage } = useRetrieval(mode, sourceFilter);
  const clearMessages = useChatStore((state) => state.clearMessages);

  const showWelcome = messages.length === 0;
  const isTyping    = isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === 'assistant' &&
    messages[messages.length - 1]?.content === '';

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    await sendMessage(trimmed);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    clearMessages(mode);
    setInput('');
    setSourceFilter('all');
    inputRef.current?.focus();
  };

  // Focus/blur gold ring on the input wrapper
  const onFocus = () => {
    if (inputWrapRef.current) inputWrapRef.current.style.borderColor = '#C9A84C';
  };
  const onBlur = () => {
    if (inputWrapRef.current) inputWrapRef.current.style.borderColor = '#EDE8DF';
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: '#F8F5F0' }}
    >
      {/* ── Messages / Welcome area ── */}
      <div
        className="flex-1 overflow-y-auto leela-scroll"
        style={{ minHeight: 0 }}
      >
        {showWelcome ? (
          <WelcomeState
            mode={mode}
            cards={cards}
            onSelect={sendMessage}
            isLoading={isLoading}
          />
        ) : (
          <div className="py-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input area ── */}
      <div
        className="flex-shrink-0"
        style={{
          backgroundColor : '#FFFFFF',
          borderTop       : '1px solid #EDE8DF',
          padding         : '12px 16px 10px',
        }}
      >
        {/* Quick-fire chips once in a conversation */}
        {!showWelcome && cards.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {cards.slice(0, 2).map((card, i) => (
              <button
                key={i}
                onClick={() => !isLoading && sendMessage(card.question)}
                disabled={isLoading}
                style={{
                  fontFamily      : "'Jost', sans-serif",
                  fontSize        : '0.68rem',
                  letterSpacing   : '0.02em',
                  padding         : '4px 10px',
                  borderRadius    : '4px',
                  border          : '1px solid #EDE8DF',
                  background      : 'transparent',
                  color           : '#8A8A8A',
                  cursor          : isLoading ? 'not-allowed' : 'pointer',
                  transition      : 'all 0.15s ease',
                  opacity         : isLoading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#C9A84C';
                    (e.currentTarget as HTMLButtonElement).style.color = '#C9A84C';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#EDE8DF';
                    (e.currentTarget as HTMLButtonElement).style.color = '#8A8A8A';
                  }
                }}
              >
                {card.display}
              </button>
            ))}
          </div>
        )}

        {/* Source filter row */}
        <div className="flex items-center gap-1.5 mb-3">
          <span
            style={{
              fontFamily    : "'Jost', sans-serif",
              fontSize      : '0.58rem',
              letterSpacing : '0.14em',
              textTransform : 'uppercase',
              color         : '#8A8A8A',
              marginRight   : '2px',
            }}
          >
            Source
          </span>
          {FILTERS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSourceFilter(opt.value)}
              style={{
                fontFamily      : "'Jost', sans-serif",
                fontSize        : '0.6rem',
                letterSpacing   : '0.04em',
                padding         : '3px 10px',
                borderRadius    : '20px',
                border          : `1px solid ${sourceFilter === opt.value ? '#21469F' : '#EDE8DF'}`,
                background      : sourceFilter === opt.value ? '#21469F' : 'transparent',
                color           : sourceFilter === opt.value ? '#FFFFFF' : '#8A8A8A',
                cursor          : 'pointer',
                transition      : 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Composer row ── */}
        <div className="flex items-end gap-2">

          {/* Input wrapper with gold focus ring */}
          <div
            ref={inputWrapRef}
            className="flex-1 flex items-end rounded-lg overflow-hidden"
            style={{
              border          : '1px solid #EDE8DF',
              backgroundColor : '#FAFAF8',
              transition      : 'border-color 0.2s ease',
            }}
          >
            {/* "Concierge" / "IR Query" label prefix */}
            <div
              style={{
                padding         : '10px 10px',
                fontFamily      : "'Jost', sans-serif",
                fontSize        : '0.55rem',
                letterSpacing   : '0.14em',
                textTransform   : 'uppercase',
                color           : '#C9A84C',
                whiteSpace      : 'nowrap',
                borderRight     : '1px solid #EDE8DF',
                flexShrink      : 0,
                alignSelf       : 'flex-end',
                paddingBottom   : '11px',
              }}
            >
              {inputLabel}
            </div>

            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={onFocus}
              onBlur={onBlur}
              placeholder={placeholder}
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none outline-none bg-transparent disabled:opacity-50"
              style={{
                fontFamily  : "'Jost', sans-serif",
                fontSize    : '0.82rem',
                color       : '#1A1A2E',
                padding     : '10px 12px',
                minHeight   : '42px',
                maxHeight   : '120px',
                lineHeight  : '1.55',
              }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#21469F', color: '#FFFFFF', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => {
              if (input.trim() && !isLoading)
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1a3a87';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#21469F';
            }}
            aria-label="Send message"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
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
                background  : 'transparent',
                border      : '1px solid #EDE8DF',
                color       : '#8A8A8A',
                cursor      : 'pointer',
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"
                  stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center justify-between mt-2"
          style={{
            fontFamily    : "'Jost', sans-serif",
            fontSize      : '0.58rem',
            color         : '#BCBCBC',
            letterSpacing : '0.03em',
          }}
        >
          <span>Enter to send · Shift+Enter for new line</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                width: '5px', height: '5px',
                borderRadius: '50%', background: '#3CB371',
                display: 'inline-block',
              }}
            />
            Knowledge base live
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Welcome state ──────────────────────────────────────────────────────────

interface WelcomeStateProps {
  mode      : Mode;
  cards     : ConciergeCardConfig[];
  onSelect  : (q: string) => void;
  isLoading : boolean;
}

const WELCOME_COPY: Record<Mode, { title: string; subtitle: string }> = {
  guest: {
    title    : 'Your Leela Concierge',
    subtitle : 'Ask me about properties, dining, spa treatments, and curated experiences across The Leela collection',
  },
  investor: {
    title    : 'Investor Intelligence',
    subtitle : 'Query financials, RevPAR, pipeline, and disclosures for Leela Palaces Hotels & Resorts',
  },
  // kept for type completeness — route is removed from App.tsx
  internal: {
    title    : 'Knowledge Assistant',
    subtitle : 'Search The Leela knowledge base',
  },
};

function WelcomeState({ mode, cards, onSelect, isLoading }: WelcomeStateProps) {
  const copy = WELCOME_COPY[mode];

  return (
    <div className="flex flex-col items-center pt-8 pb-4">

      {/* ── Hero ── */}
      <div className="flex flex-col items-center text-center px-6 mb-5">
        {/* Ornamental divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ height: '1px', width: '28px', background: '#C9A84C', opacity: 0.5 }} />
          <div style={{ display: 'flex', gap: '4px' }}>
            {[0,1,2].map(i => (
              <div
                key={i}
                style={{
                  width: '4px', height: '4px',
                  borderRadius: '50%',
                  border: '1px solid #C9A84C',
                  opacity: 0.55,
                }}
              />
            ))}
          </div>
          <div style={{ height: '1px', width: '28px', background: '#C9A84C', opacity: 0.5 }} />
        </div>

        <h2
          style={{
            fontFamily    : "'Cormorant Garamond', serif",
            fontSize      : 'clamp(1.6rem, 4vw, 2rem)',
            fontWeight    : 400,
            color         : '#1A1A2E',
            letterSpacing : '0.02em',
            lineHeight    : 1.2,
            marginBottom  : '8px',
          }}
        >
          {copy.title}
        </h2>

        <p
          style={{
            fontFamily    : "'Jost', sans-serif",
            fontSize      : '0.76rem',
            color         : '#8A8A8A',
            letterSpacing : '0.04em',
            lineHeight    : 1.65,
            maxWidth      : '300px',
          }}
        >
          {copy.subtitle}
        </p>
      </div>

      {/* ── Live KB context strip ── */}
      <div className="w-full px-0 mb-5">
        <ContextStrip />
      </div>

      {/* ── Concierge cards ── */}
      <div className="w-full px-4">
        <p
          style={{
            fontFamily    : "'Jost', sans-serif",
            fontSize      : '0.58rem',
            letterSpacing : '0.2em',
            textTransform : 'uppercase',
            color         : '#8A8A8A',
            textAlign     : 'center',
            marginBottom  : '12px',
          }}
        >
          Curated for you
        </p>
        <ConciergeCardGrid
          cards={cards}
          onSelect={onSelect}
          disabled={isLoading}
        />
      </div>

      {/* ── Trust panel ── */}
      <div className="w-full mt-4">
        {/* TrustPanel is standalone — no filter interaction in welcome state */}
        <div
          style={{
            margin          : '0 16px',
            background      : '#FFFFFF',
            border          : '0.5px solid #EDE8DF',
            borderRadius    : '8px',
            padding         : '10px 14px',
            display         : 'flex',
            alignItems      : 'center',
            gap             : '10px',
          }}
        >
          <div
            style={{
              width           : '26px',
              height          : '26px',
              borderRadius    : '50%',
              background      : '#F8F5F0',
              border          : '1px solid #EDE8DF',
              display         : 'flex',
              alignItems      : 'center',
              justifyContent  : 'center',
              flexShrink      : 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                stroke="#21469F" strokeWidth="1.5" strokeLinejoin="round" fill="none"
              />
              <path d="M9 12l2 2 4-4" stroke="#21469F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '0.68rem', color: '#1A1A2E', letterSpacing: '0.02em' }}>
              Verified Leela Knowledge Base
            </div>
            <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '0.58rem', color: '#8A8A8A', letterSpacing: '0.03em', marginTop: '1px' }}>
              Answers grounded in official content · Sources shown with every response
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
