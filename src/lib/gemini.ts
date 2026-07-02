// ============================================================
// LIP v2 — LLM & Embedding Client (gemini.ts)
// Despite the filename (kept for import compatibility),
// this module uses Groq + Supabase Edge Functions.
// ============================================================

import type { Mode } from '../types';
import type { DocumentChunk } from '../types';
import { SYSTEM_PROMPTS } from './prompts';

const groqApiKey   = import.meta.env.VITE_GROQ_API_KEY as string;
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

if (!groqApiKey) {
  throw new Error('Missing VITE_GROQ_API_KEY environment variable');
}

export function buildContext(chunks: DocumentChunk[]): string {
  if (!chunks || chunks.length === 0) return '';
  return chunks
    .map(c => {
      const label = c.property_name && c.property_name !== 'brand'
        ? `[${c.source_name} | ${c.property_name}]`
        : `[${c.source_name}]`;
      return `${label}\n${c.content}`;
    })
    .join('\n\n---\n\n');
}

export async function embedText(text: string): Promise<number[]> {
  const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const response = await fetch(`${supabaseUrl}/functions/v1/embed-text`, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Embedding failed: ${error.error || response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.embedding)) {
    throw new Error('Invalid embedding response from Edge Function');
  }
  return data.embedding;
}

function buildUserMessage(query: string, context: string): string {
  if (context) {
    return [
      'KNOWLEDGE BASE CONTEXT:',
      "(Excerpts from The Leela's official knowledge base. Each tagged with property and source. Use this to answer the guest.)",
      '',
      context,
      '',
      '━━━',
      '',
      `GUEST: ${query}`,
    ].join('\n');
  }
  return [
    `GUEST: ${query}`,
    '',
    "(No specific knowledge base matches found. Draw on your knowledge of The Leela collection.",
    'Only refer to reservations for live availability or pricing.)',
  ].join('\n');
}

export async function* streamWithContext(
  query  : string,
  context: string,
  mode   : Mode,
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []
): AsyncGenerator<string> {
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
      model   : GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[mode] },
        ...formattedHistory,
        { role: 'user', content: buildUserMessage(query, context) },
      ],
      temperature: 0.4,
      max_tokens : 1024,
      stream     : true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
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
      } catch { /* skip malformed chunks */ }
    }
  }
}

export async function generateWithContext(
  query  : string,
  context: string,
  mode   : Mode
): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model   : GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[mode] },
        { role: 'user', content: buildUserMessage(query, context) },
      ],
      temperature: 0.4,
      max_tokens : 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Groq API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
