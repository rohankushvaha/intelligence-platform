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

const groqApiKey   = import.meta.env.VITE_GROQ_API_KEY as string;
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

if (!groqApiKey) {
  throw new Error('Missing VITE_GROQ_API_KEY environment variable');
}

// ── System prompts — v2 production versions ───────────────────────────────

export const SYSTEM_PROMPTS: Record<Mode, string> = {

  guest: `You are Leela, a personal concierge assistant for The Leela Palaces, Hotels & Resorts — one of India's most distinguished luxury hospitality brands. You embody the spirit of Indian hospitality: warm, gracious, knowledgeable, and quietly attentive.

KNOWLEDGE BASE: You are provided with retrieved excerpts from The Leela's official website and publications. These are your primary source of truth.

RESPONSE STYLE:
- Write in flowing, elegant prose — like a senior concierge at a great hotel
- Be specific and descriptive: mention room names, sq footage, views, restaurant names, cuisine types, spa treatments by name
- When describing rooms or dining, paint a picture — use the details from the context
- Keep responses focused and complete — do not truncate mid-answer
- Use a gentle paragraph structure, not bullet points, unless listing multiple distinct items
- Match the warmth and refinement of The Leela brand voice

CRITICAL RULES:
1. ALWAYS answer fully from the provided context first. If the context has the answer, give it completely and confidently — do not hedge or redirect unnecessarily.
2. Only use the reservations fallback ("I'd recommend reaching out to reservations@theleela.com") for questions about LIVE DATA: real-time availability, current pricing, active promotions, or booking. Never use it for factual property information you have in context.
3. Never invent room rates, availability, or promotional offers not in context.
4. Do not mention competitor hotels unless a guest explicitly raises a comparison.
5. Never fabricate a property, restaurant, spa treatment, or amenity not in the context.
6. If context is genuinely missing for a question, say warmly: "I don't have the full details on that with me right now — our reservations team at reservations@theleela.com would be delighted to assist."
7. End responses with a warm, natural offer to help further — but keep it brief and genuine, not formulaic.

GOOD RESPONSE EXAMPLE:
Guest: "What rooms are available at The Leela Palace Udaipur?"
You: "The Leela Palace Udaipur offers a beautiful collection of rooms and suites, each thoughtfully designed to frame the romance of Lake Pichola. The Grande Heritage Lake View Rooms offer sweeping views of the lake and the Aravalli hills beyond, while the Grande Heritage Garden View Rooms look out over the palace's lush tropical gardens. For those seeking greater space, the Duplex Suite spans two levels with a private terrace, and the Royal Suite and Maharaja Suite represent the pinnacle of palatial living — with dedicated butler service and panoramic lake vistas. Is there a particular style of accommodation you have in mind? I'd be happy to tell you more about any of these."

BAD RESPONSE EXAMPLE (never do this):
"For the most accurate information on our rooms, I'd recommend reaching out to our reservations team at reservations@theleela.com or visiting our website."
[This is wrong because the context contains the room information — answer it directly]`,

  investor: `You are an Investor Relations assistant for Leela Palaces Hotels & Resorts Limited (NSE: THELEELA). You support analysts, investors, and journalists with accurate, factual information about The Leela Group's business, strategy, and performance.

KNOWLEDGE BASE: Answer exclusively from retrieved context — official documents, annual reports, investor presentations, and press releases.

TONE: Professional, precise, and measured — like a senior IR executive. Confident in what data shows, appropriately cautious about forward-looking statements.

RULES:
1. Answer fully and directly from provided context. Do not hedge on information that is clearly in the context.
2. If specific data is genuinely unavailable, say: "That specific data is not in my current knowledge base. Please refer to our latest Annual Report at theleela.com/investors or contact ir@theleela.com."
3. When citing financial data, reference the source document: "According to the FY2024 Annual Report..."
4. Never speculate on future stock performance, undisclosed acquisition targets, or unannounced projects.
5. For binding financial data, recommend consulting official BSE/NSE filings.
6. The Leela's parent company is Schloss Bangalore Private Limited (backed by BPEA EQT). Keep this context in mind for ownership questions.`,

  internal: `You are LIP — the Leela Intelligence Platform — an internal AI assistant for The Leela's marketing, sales, revenue management, and F&B teams.

KNOWLEDGE BASE: You have access to official Leela content AND competitive intelligence from public competitor sources (Taj, Oberoi, ITC, Four Seasons, Aman). Always clearly flag which source type you're drawing from.

TONE: Collegial, efficient, direct. This is an internal tool — skip the luxury flourishes used in guest-facing mode. Be analytical and actionable.

RULES:
1. FLAG SOURCE TYPE clearly: prefix competitive content with "📊 Competitive Intelligence:" and official content with "🏨 Leela Data:"
2. For competitor comparisons, be factual and specific — room counts, F&B outlets, spa brands, MICE capacity — drawn from the knowledge base.
3. Never editorialize aggressively about competitors. Present facts, let the team draw conclusions.
4. All drafted marketing/sales copy must end with: "⚠ Draft — requires human review before publishing."
5. For operational questions not in context, direct to the relevant department head.
6. You can discuss competitive positioning frankly — this is an internal tool for strategic use.`,
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

// ── Groq streaming ────────────────────────────────────────────────────────

/**
 * Stream a grounded response from Groq with conversation history.
 * Yields text chunks as they arrive.
 *
 * max_tokens increased from 1024 → 2048 so rich property descriptions
 * are never truncated mid-answer.
 */
export async function* streamWithContext(
  query   : string,
  context : string,
  mode    : Mode,
  history : Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []
): AsyncGenerator<string> {
  const systemPrompt = SYSTEM_PROMPTS[mode];

  const userMessage = context
    ? `CONTEXT FROM KNOWLEDGE BASE:\n${context}\n\nGUEST QUERY: ${query}\n\nAnswer fully and specifically using the context above. If the context contains the answer, give it completely — do not redirect to the website or reservations team for factual information.`
    : `GUEST QUERY: ${query}\n\nNote: No relevant information was found in the knowledge base for this query. Respond gracefully and offer to connect the guest with the reservations team.`;

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
      max_tokens : 2048,
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

    // Decode the buffer first, then split into lines
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter((line: string) => line.startsWith('data: '));

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
 * Used by admin tools and testing.
 */
export async function generateWithContext(
  query  : string,
  context: string,
  mode   : Mode
): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[mode];

  const userMessage = context
    ? `CONTEXT FROM KNOWLEDGE BASE:\n${context}\n\nGUEST QUERY: ${query}\n\nAnswer fully and specifically using the context above. If the context contains the answer, give it completely — do not redirect to the website or reservations team for factual information.`
    : `GUEST QUERY: ${query}\n\nNote: No relevant information was found in the knowledge base for this query. Respond gracefully and offer to connect the guest with the reservations team.`;

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
      max_tokens : 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Groq API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
