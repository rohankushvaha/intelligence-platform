// ============================================================
// Leela Intelligence Platform v2 — LLM & Embedding Client
// ============================================================
// Changes from v1:
//   - System prompts upgraded to v2 production versions
//   - Context builder now includes source_type badges
//   - embedText unchanged — still uses Supabase Edge Function
//   - Groq model and streaming logic unchanged
//   - Added getSystemPrompt() export for use in other modules
// ============================================================

import type { Mode } from '../types';
import type { DocumentChunk } from '../types';

const groqApiKey  = import.meta.env.VITE_GROQ_API_KEY as string;
const GROQ_MODEL  = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

if (!groqApiKey) {
  throw new Error('Missing VITE_GROQ_API_KEY environment variable');
}

// ── System prompts — v2 production versions ───────────────────────────────

export const SYSTEM_PROMPTS: Record<Mode, string> = {

  guest: `You are Leela, a personal concierge assistant for The Leela Palaces, Hotels & Resorts — one of India's most distinguished luxury hospitality brands. You embody the spirit of Indian hospitality: warm, gracious, knowledgeable, and quietly attentive.

KNOWLEDGE BASE: Answer exclusively from the retrieved context provided with each query.

TONE: Warm, refined, and unhurried. Like a senior concierge at a great hotel — knowledgeable but never condescending. Use complete sentences. Avoid bullet-heavy responses unless listing genuinely enumerable items.

RULES:
1. Answer only from provided context. Never invent room rates, availability, or promotional offers.
2. If context is insufficient, say gracefully: "For the most accurate information, I'd recommend reaching out to our reservations team at reservations@theleela.com or calling your preferred property directly."
3. Do not mention competitor hotels unless a guest explicitly raises a comparison.
4. Never fabricate a property, restaurant, spa treatment, or amenity not in the context.
5. Always end with a warm offer to assist further.`,

  investor: `You are an Investor Relations assistant for Leela Palaces Hotels & Resorts Limited (NSE: THELEELA). You support analysts, investors, and journalists with accurate, factual information about The Leela Group's business, strategy, and performance.

KNOWLEDGE BASE: Answer exclusively from retrieved context — official documents, annual reports, investor presentations, and press releases.

TONE: Professional, precise, and measured — like a senior IR executive. Confident in what data shows, appropriately cautious about projections.

RULES:
1. Answer only from provided context. If data is unavailable, say: "That information is not in my current knowledge base. Please refer to our latest Annual Report or contact ir@theleela.com."
2. Never speculate on future stock performance or undisclosed acquisition targets.
3. When citing data, reference the source: "According to the FY2024 Annual Report..."
4. Always recommend consulting official exchange filings for binding financial data.`,

  internal: `You are LIP — the Leela Intelligence Platform — an internal AI assistant for The Leela's marketing, sales, revenue management, and F&B teams.

KNOWLEDGE BASE: You have access to official Leela content AND competitive intelligence (from public competitor sources). Always flag which type you're drawing from.

TONE: Collegial, efficient, direct. This is an internal tool — skip luxury flourishes used in guest-facing mode.

RULES:
1. Flag source type: prefix competitive content with "From competitive sources:"
2. All drafted content must end with: "⚠ Draft — requires human review before publishing."
3. For competitor comparisons, present factually from the knowledge base. Never editorialize aggressively.
4. For operational questions not in context, direct to the relevant department head.`,
};

export function getSystemPrompt(mode: Mode): string {
  return SYSTEM_PROMPTS[mode];
}

// ── Context builder — includes source_type badges ─────────────────────────

/**
 * Build the context string passed to the LLM.
 * v2: includes source_type label so the LLM knows if it's citing
 * official content, press coverage, or competitive intelligence.
 */
export function buildContext(chunks: DocumentChunk[]): string {
  if (chunks.length === 0) return '';

  return chunks
    .map(c => {
      const sourceLabel = c.source_type
        ? `[${c.source_type.toUpperCase()} SOURCE: ${c.source_name}]`
        : `[Source: ${c.source_name}]`;
      return `${sourceLabel}\n${c.content}`;
    })
    .join('\n\n---\n\n');
}

// ── Embedding — unchanged from v1, uses Supabase Edge Function ────────────

/**
 * Generate an embedding using all-MiniLM-L6-v2 via Supabase Edge Function.
 * The Edge Function must match the 384-dim model used in the Python pipeline.
 */
export async function embedText(text: string): Promise<number[]> {
  const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const response = await fetch(`${supabaseUrl}/functions/v1/embed-text`, {
    method  : 'POST',
    headers : {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Embedding failed: ${error.error || response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.embedding)) {
    throw new Error(`Invalid embedding response: ${JSON.stringify(data)}`);
  }

  return data.embedding;
}

// ── Groq streaming — unchanged from v1 ───────────────────────────────────

/**
 * Stream a grounded response from Groq with conversation history.
 * Yields text chunks as they arrive.
 */
export async function* streamWithContext(
  query   : string,
  context : string,
  mode    : Mode,
  history : Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []
): AsyncGenerator<string> {
  const systemPrompt = SYSTEM_PROMPTS[mode];

  const userMessage = context
    ? `CONTEXT FROM KNOWLEDGE BASE:\n${context}\n\nUSER QUERY: ${query}\n\nAnswer based solely on the context above.`
    : `USER QUERY: ${query}\n\nNote: No relevant information found in the knowledge base for this query.`;

  const formattedHistory = history.map(msg => ({
    role   : msg.role === 'model' ? 'assistant' : 'user',
    content: msg.parts.map(p => p.text).join(''),
  }));

  const response = await fetch(GROQ_API_URL, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model      : GROQ_MODEL,
      messages   : [
        { role: 'system', content: systemPrompt },
        ...formattedHistory,
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens : 1024,
      stream     : true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Groq streaming error: ${JSON.stringify(error)}`);
  }

  const reader  = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const text   = parsed.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {
        // Skip malformed chunks
      }
    }
  }
}

/**
 * Non-streaming variant — returns complete response.
 */
export async function generateWithContext(
  query  : string,
  context: string,
  mode   : Mode
): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[mode];

  const userMessage = context
    ? `CONTEXT FROM KNOWLEDGE BASE:\n${context}\n\nUSER QUERY: ${query}\n\nAnswer based solely on the context above.`
    : `USER QUERY: ${query}\n\nNote: No relevant information found in the knowledge base for this query.`;

  const response = await fetch(GROQ_API_URL, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model      : GROQ_MODEL,
      messages   : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens : 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Groq API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
