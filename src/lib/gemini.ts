// ============================================================
// Leela Intelligence Platform — API Client
// Groq (chat) + Gemini (embeddings only)
// ============================================================

import type { Mode } from '../types';

const groqApiKey = import.meta.env.VITE_GROQ_API_KEY as string;

if (!groqApiKey) {
  throw new Error('Missing VITE_GROQ_API_KEY environment variable');
}

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ===== System prompts per mode =====

const SYSTEM_PROMPTS: Record<Mode, string> = {
  guest: `You are the AI Concierge for The Leela Palaces, Hotels & Resorts — India's premier pure-play luxury hospitality brand. Answer guest queries with warmth, precision, and gracious tone befitting The Leela brand. Use only the context provided. If the answer is not in the context, gracefully acknowledge and suggest contacting reservations directly at reservations@theleela.com. Never fabricate property details, prices, or availability. Always end responses with an offer to assist further.`,

  investor: `You are the AI Investor Relations Assistant for Leela Palaces Hotels & Resorts Limited (NSE: THELEELA, BSE: 544408). Answer investor and analyst queries accurately using only the provided context. Cite specific figures with their reporting period. If information is unavailable, direct to cs@theleela.com or theleela.com/investors. Maintain a measured, factual, professional tone appropriate for investor relations.`,

  internal: `You are an internal AI assistant for The Leela's sales and marketing teams. Answer concisely and factually using only the provided context. Pull exact details: room counts, outlet names, MICE capacity, package details. Format responses clearly. If information is not in the context, say so directly. No need for pleasantries — this is an internal tool.`,
};

/**
 * Generate a 768-dimensional embedding using Hugging Face all-MiniLM-L6-v2 via Edge Function.
 */
export async function embedText(text: string): Promise<number[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const response = await fetch(`${supabaseUrl}/functions/v1/embed-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

/**
 * Generate a grounded response using Groq (llama-3.3-70b-versatile).
 * Returns the full text response.
 */
export async function generateWithContext(
  query: string,
  context: string,
  mode: Mode
): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[mode];

  const userMessage = context
    ? `CONTEXT FROM KNOWLEDGE BASE:\n${context}\n\nUSER QUERY: ${query}\n\nPlease answer the user's query based solely on the context provided above.`
    : `USER QUERY: ${query}\n\nNote: No relevant information was found in the knowledge base for this query.`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Groq API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Stream a grounded response from Groq with conversation history.
 * Yields text chunks as they stream in.
 */
export async function* streamWithContext(
  query: string,
  context: string,
  mode: Mode,
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>
): AsyncGenerator<string> {
  const systemPrompt = SYSTEM_PROMPTS[mode];

  const userMessage = context
    ? `CONTEXT FROM KNOWLEDGE BASE:\n${context}\n\nUSER QUERY: ${query}\n\nPlease answer the user's query based solely on the context provided above.`
    : `USER QUERY: ${query}\n\nNote: No relevant information was found in the knowledge base for this query.`;

  // Convert history from Gemini format to OpenAI format
  const formattedHistory = history.map(msg => ({
    role: msg.role === 'model' ? 'assistant' : 'user',
    content: msg.parts.map(p => p.text).join(''),
  }));

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...formattedHistory,
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Groq streaming error: ${JSON.stringify(error)}`);
  }

  const reader = response.body!.getReader();
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
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {
        // Skip malformed chunks
      }
    }
  }
}