import { useState } from 'react';
import { ingestDocument } from '../lib/ingestion';
import type { Mode } from '../types';

interface KnowledgeEntry {
  sourceName: string;
  sourceUrl: string;
  mode: Mode | 'all';
  content: string;
}

export function BulkIngest() {
  const [jsonInput, setJsonInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [currentItem, setCurrentItem] = useState('');
  const [progress, setProgress] = useState<{ item: number; total: number } | null>(null);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handleBulkIngest = async () => {
    let entries: KnowledgeEntry[];

    try {
      entries = JSON.parse(jsonInput);
      if (!Array.isArray(entries)) throw new Error('JSON must be an array');
    } catch (err) {
      addLog(`ERROR: Invalid JSON — ${err instanceof Error ? err.message : 'parse error'}`);
      return;
    }

    setIsRunning(true);
    setLog([]);
    setProgress({ item: 0, total: entries.length });

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      setCurrentItem(entry.sourceName);
      setProgress({ item: i + 1, total: entries.length });
      addLog(`[${i + 1}/${entries.length}] Ingesting: ${entry.sourceName}...`);

      try {
        const count = await ingestDocument(
          entry.content,
          entry.sourceName,
          entry.sourceUrl || '',
          entry.mode || 'all',
          (current, total) => {
            setCurrentItem(`${entry.sourceName} — chunk ${current}/${total}`);
          }
        );
        addLog(`  ✓ Done — ${count} chunks stored (mode: ${entry.mode})`);
      } catch (err) {
        addLog(`  ✗ FAILED: ${err instanceof Error ? err.message : 'unknown error'}`);
      }

      if (i < entries.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    setCurrentItem('');
    setIsRunning(false);
    addLog(`\n✓ BULK INGEST COMPLETE — ${entries.length} documents processed.`);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F5F0', fontFamily: "'Jost', sans-serif" }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1A1A2E', padding: '16px 24px' }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', marginBottom: '12px' }} />
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#F8F5F0', fontSize: '1.5rem', fontWeight: 500, margin: 0 }}>
          Leela Intelligence Platform
        </h1>
        <p style={{ color: '#8A8A8A', fontSize: '0.7rem', letterSpacing: '0.2em', margin: '2px 0 0', textTransform: 'uppercase' }}>
          Bulk Knowledge Base Ingestion
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Instructions */}
        <div className="rounded-xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #EDE8DF' }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#C9A84C', fontSize: '1.1rem', marginBottom: '8px' }}>
            How to use
          </h2>
          <ol style={{ color: '#666666', fontSize: '0.875rem', lineHeight: '1.8', paddingLeft: '20px' }}>
            <li>Prepare your knowledge base as a JSON array with objects containing: <code style={{ backgroundColor: '#F8F5F0', padding: '1px 6px', borderRadius: '3px' }}>sourceName</code>, <code style={{ backgroundColor: '#F8F5F0', padding: '1px 6px', borderRadius: '3px' }}>sourceUrl</code>, <code style={{ backgroundColor: '#F8F5F0', padding: '1px 6px', borderRadius: '3px' }}>mode</code>, and <code style={{ backgroundColor: '#F8F5F0', padding: '1px 6px', borderRadius: '3px' }}>content</code></li>
            <li>Copy the entire JSON array</li>
            <li>Paste into the text area below</li>
            <li>Click <strong>Ingest All</strong> — the system processes each entry automatically</li>
          </ol>
        </div>

        {/* JSON Input */}
        <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #EDE8DF' }}>
          <label style={{ fontFamily: "'Jost', sans-serif", fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.06em', color: '#666666', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Paste Knowledge Base JSON
          </label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='[{ "sourceName": "...", "sourceUrl": "...", "mode": "guest", "content": "..." }]'
            rows={12}
            disabled={isRunning}
            style={{
              width: '100%',
              border: '1.5px solid #EDE8DF',
              borderRadius: '6px',
              padding: '10px 14px',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              backgroundColor: '#F8F5F0',
              color: '#1A1A2E',
              resize: 'vertical',
              outline: 'none',
              lineHeight: '1.5',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#21469F'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#EDE8DF'; }}
          />
          {jsonInput && (
            <p style={{ fontSize: '0.75rem', color: '#8A8A8A', marginTop: '4px' }}>
              {(() => { try { const a = JSON.parse(jsonInput); return `${Array.isArray(a) ? a.length : 0} documents detected`; } catch { return 'Invalid JSON'; } })()}
            </p>
          )}
        </div>

        {/* Progress */}
        {progress && (
          <div className="rounded-xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #EDE8DF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666666', marginBottom: '8px' }}>
              <span>{currentItem || 'Processing...'}</span>
              <span>{progress.item} / {progress.total}</span>
            </div>
            <div style={{ height: '6px', backgroundColor: '#EDE8DF', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  backgroundColor: '#21469F',
                  borderRadius: '999px',
                  width: `${(progress.item / progress.total) * 100}%`,
                  transition: 'width 300ms ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Ingest button */}
        <button
          onClick={handleBulkIngest}
          disabled={isRunning || !jsonInput.trim()}
          style={{
            backgroundColor: '#21469F',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 32px',
            fontFamily: "'Jost', sans-serif",
            fontSize: '0.875rem',
            letterSpacing: '0.08em',
            cursor: isRunning || !jsonInput.trim() ? 'not-allowed' : 'pointer',
            opacity: isRunning || !jsonInput.trim() ? 0.4 : 1,
            transition: 'all 200ms ease',
          }}
        >
          {isRunning ? 'INGESTING...' : 'INGEST ALL DOCUMENTS'}
        </button>

        {/* Log output */}
        {log.length > 0 && (
          <div className="rounded-xl p-5" style={{ backgroundColor: '#1A1A2E', border: '1px solid #333' }}>
            <p style={{ color: '#C9A84C', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Ingestion Log
            </p>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.8', color: '#F8F5F0', maxHeight: '300px', overflowY: 'auto' }}>
              {log.map((line, i) => (
                <div
                  key={i}
                  style={{
                    color: line.includes('✓') ? '#4ade80' : line.includes('✗') || line.includes('ERROR') ? '#f87171' : '#F8F5F0',
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '16px', borderTop: '1px solid #EDE8DF', color: '#8A8A8A', fontSize: '0.7rem', letterSpacing: '0.04em' }}>
        Leela Intelligence Platform v1.0 — Built by Rohan Kushvaha
      </div>
    </div>
  );
}
