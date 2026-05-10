// ============================================================
// Leela Intelligence Platform — Admin Panel (Password Protected)
// Password: leela2026
// ============================================================

import { useState, useEffect, type ChangeEvent } from 'react';
import { ingestDocument } from '../lib/ingestion';
import { fetchAllDocuments, deleteDocumentBySource } from '../lib/supabase';
import type { DocumentRecord, IngestionForm, Mode } from '../types';

const ADMIN_PASSWORD = 'leela2026';

// ===== Password Gate =====

interface AdminLoginProps {
  onSuccess: () => void;
}

function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#F8F5F0' }}
    >
      <div
        className="w-full max-w-sm p-8 rounded-xl"
        style={{
          backgroundColor: '#FFFFFF',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #EDE8DF',
        }}
      >
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: '#EDE8DF' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="#21469F" strokeWidth="1.5" />
              <path d="M7 11V7a5 5 0 0110 0v4" stroke="#21469F" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1
            className="text-2xl mb-1"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: '#1A1A2E', fontWeight: 500 }}
          >
            Admin Panel
          </h1>
          <p
            className="text-xs"
            style={{ fontFamily: "'Jost', sans-serif", color: '#8A8A8A', letterSpacing: '0.05em' }}
          >
            LEELA INTELLIGENCE PLATFORM
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Enter admin password"
            className="w-full px-4 py-3 rounded-lg outline-none text-sm transition-all duration-200"
            style={{
              border: error ? '1.5px solid #dc2626' : '1.5px solid #EDE8DF',
              backgroundColor: '#F8F5F0',
              fontFamily: "'Jost', sans-serif",
              color: '#1A1A2E',
            }}
            onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = '#21469F'; }}
            onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = '#EDE8DF'; }}
          />
          {error && (
            <p className="text-xs" style={{ color: '#dc2626', fontFamily: "'Jost', sans-serif" }}>
              {error}
            </p>
          )}
          <button
            onClick={handleLogin}
            className="w-full py-3 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: '#21469F',
              color: '#FFFFFF',
              fontFamily: "'Jost', sans-serif",
              letterSpacing: '0.08em',
              border: 'none',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1a3a87'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#21469F'; }}
          >
            LOGIN
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== URL Ingestion Section =====

interface UrlIngestSectionProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

function UrlIngestSection({ onSuccess, onError }: UrlIngestSectionProps) {
  const [url, setUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [mode, setMode] = useState<Mode | 'all'>('all');
  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const handleFetchAndIngest = async () => {
    if (!url.trim()) {
      onError('Please enter a URL');
      return;
    }

    setIsFetching(true);
    setProgress(null);
    setStatusMsg('Fetching page content...');

    try {
      // Call Supabase Edge Function — fetches URL server-side, no CORS issues
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const res = await fetch(`${supabaseUrl}/functions/v1/fetch-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `Failed to fetch URL (${res.status})`);
      }

      const { text: cleanText, title: pageTitle } = await res.json();

      if (!cleanText || cleanText.length < 100) {
        throw new Error('Page content too short or could not be extracted');
      }

      setStatusMsg('Chunking and embedding content...');

      const finalSourceName = sourceName.trim() || pageTitle || url;

      const count = await ingestDocument(
        cleanText,
        finalSourceName,
        url,
        mode,
        (current, total) => {
          setProgress({ current, total });
          setStatusMsg(`Embedding chunk ${current} of ${total}...`);
        }
      );

      setUrl('');
      setSourceName('');
      setProgress(null);
      setStatusMsg('');
      onSuccess(`Auto-ingested "${finalSourceName}" — ${count} chunk${count !== 1 ? 's' : ''} stored.`);

    } catch (err) {
      setStatusMsg('');
      setProgress(null);
      onError(err instanceof Error ? err.message : 'URL ingestion failed');
    } finally {
      setIsFetching(false);
    }
  };

  const inputStyle = {
    border: '1.5px solid #EDE8DF',
    backgroundColor: '#F8F5F0',
    fontFamily: "'Jost', sans-serif",
    color: '#1A1A2E',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
    padding: '10px 14px',
    borderRadius: '6px',
    transition: 'border-color 200ms ease',
  };

  const labelStyle = {
    fontFamily: "'Jost', sans-serif",
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: '0.06em',
    color: '#666666',
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
    display: 'block',
  };

  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #EDE8DF' }}
    >
      <h2
        className="mb-1"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          color: '#C9A84C',
          fontSize: '1.25rem',
          fontWeight: 500,
          letterSpacing: '0.03em',
        }}
      >
        Auto-Ingest from URL
      </h2>
      <p
        className="mb-5 pb-4"
        style={{
          fontFamily: "'Jost', sans-serif",
          fontSize: '0.8rem',
          color: '#8A8A8A',
          borderBottom: '1px solid #EDE8DF',
        }}
      >
        Paste any public URL — the system will fetch, clean, chunk, embed, and store it automatically.
      </p>

      <div className="space-y-4">
        <div>
          <label style={labelStyle}>Page URL *</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.theleela.com/the-leela-palace-udaipur"
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#21469F'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#EDE8DF'; }}
            disabled={isFetching}
          />
        </div>

        <div>
          <label style={labelStyle}>Source Name (auto-detected if blank)</label>
          <input
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="e.g. The Leela Palace Udaipur"
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#21469F'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#EDE8DF'; }}
            disabled={isFetching}
          />
        </div>

        <div>
          <label style={labelStyle}>Assistant Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode | 'all')}
            style={{ ...inputStyle, cursor: 'pointer' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#21469F'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#EDE8DF'; }}
            disabled={isFetching}
          >
            <option value="all">All Modes</option>
            <option value="guest">Guest Concierge only</option>
            <option value="investor">Investor Assistant only</option>
            <option value="internal">Internal Copilot only</option>
          </select>
        </div>

        {statusMsg && (
          <p className="text-xs" style={{ color: '#21469F', fontFamily: "'Jost', sans-serif" }}>
            {statusMsg}
          </p>
        )}

        {progress && (
          <div>
            <div
              className="flex justify-between text-xs mb-1.5"
              style={{ color: '#8A8A8A', fontFamily: "'Jost', sans-serif" }}
            >
              <span>Embedding chunks...</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#EDE8DF' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  backgroundColor: '#21469F',
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleFetchAndIngest}
          disabled={isFetching || !url.trim()}
          className="px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: '#21469F',
            color: '#FFFFFF',
            fontFamily: "'Jost', sans-serif",
            letterSpacing: '0.06em',
            border: 'none',
            cursor: isFetching ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!isFetching) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1a3a87';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#21469F';
          }}
        >
          {isFetching ? 'FETCHING & INGESTING...' : 'FETCH & INGEST'}
        </button>
      </div>
    </div>
  );
}

// ===== Main Admin Panel =====

type AdminTab = 'ingest' | 'documents';

const EMPTY_FORM: IngestionForm = {
  content: '',
  sourceName: '',
  sourceUrl: '',
  mode: 'all',
};

export function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('ingest');
  const [form, setForm] = useState<IngestionForm>(EMPTY_FORM);
  const [isIngesting, setIsIngesting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [deletingSource, setDeletingSource] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'documents' && isAuthenticated) {
      loadDocuments();
    }
  }, [activeTab, isAuthenticated]);

  const loadDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await fetchAllDocuments();
      setDocuments(docs as DocumentRecord[]);
    } catch (err) {
      setErrorMsg('Failed to load documents');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleIngest = async () => {
    if (!form.content.trim() || !form.sourceName.trim()) {
      setErrorMsg('Content and Source Name are required');
      return;
    }

    setIsIngesting(true);
    setProgress(null);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const count = await ingestDocument(
        form.content,
        form.sourceName,
        form.sourceUrl,
        form.mode,
        (current, total) => setProgress({ current, total })
      );
      setSuccessMsg(`Successfully ingested "${form.sourceName}" — ${count} chunk${count !== 1 ? 's' : ''} stored.`);
      setForm(EMPTY_FORM);
      setProgress(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ingestion failed');
    } finally {
      setIsIngesting(false);
    }
  };

  const handleDelete = async (sourceName: string) => {
    if (!confirm(`Delete all chunks for "${sourceName}"?`)) return;
    setDeletingSource(sourceName);
    try {
      await deleteDocumentBySource(sourceName);
      await loadDocuments();
    } catch (err) {
      setErrorMsg('Failed to delete document');
    } finally {
      setDeletingSource(null);
    }
  };

  const groupedDocs = documents.reduce<Record<string, DocumentRecord[]>>((acc, doc) => {
    if (!acc[doc.source_name]) acc[doc.source_name] = [];
    acc[doc.source_name].push(doc);
    return acc;
  }, {});

  if (!isAuthenticated) {
    return <AdminLogin onSuccess={() => setIsAuthenticated(true)} />;
  }

  const inputStyle = {
    border: '1.5px solid #EDE8DF',
    backgroundColor: '#F8F5F0',
    fontFamily: "'Jost', sans-serif",
    color: '#1A1A2E',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
    padding: '10px 14px',
    borderRadius: '6px',
    transition: 'border-color 200ms ease',
  };

  const labelStyle = {
    fontFamily: "'Jost', sans-serif",
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: '0.06em',
    color: '#666666',
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
    display: 'block',
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#F8F5F0', fontFamily: "'Jost', sans-serif" }}
    >
      {/* Header */}
      <div style={{ backgroundColor: '#1A1A2E', padding: '0 24px' }}>
        <div className="leela-gold-line" />
        <div className="max-w-4xl mx-auto py-4 flex items-center justify-between">
          <div>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                color: '#F8F5F0',
                fontSize: '1.5rem',
                fontWeight: 500,
                margin: 0,
                letterSpacing: '0.02em',
              }}
            >
              The Leela Intelligence Platform
            </h1>
            <p
              style={{
                fontFamily: "'Jost', sans-serif",
                color: '#8A8A8A',
                fontSize: '0.7rem',
                letterSpacing: '0.2em',
                margin: '2px 0 0',
                textTransform: 'uppercase',
              }}
            >
              Admin Panel — Knowledge Base Management
            </p>
          </div>
          <div
            className="px-3 py-1 rounded text-xs"
            style={{
              backgroundColor: 'rgba(201,168,76,0.15)',
              border: '1px solid rgba(201,168,76,0.3)',
              color: '#C9A84C',
              fontFamily: "'Jost', sans-serif",
              letterSpacing: '0.06em',
            }}
          >
            ADMIN
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Tab switcher */}
        <div
          className="flex gap-1 p-1 rounded-lg mb-8 w-fit"
          style={{ backgroundColor: '#EDE8DF' }}
        >
          {(['ingest', 'documents'] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-5 py-2 rounded-md text-sm font-medium transition-all duration-200"
              style={{
                backgroundColor: activeTab === tab ? '#21469F' : 'transparent',
                color: activeTab === tab ? '#FFFFFF' : '#666666',
                fontFamily: "'Jost', sans-serif",
                letterSpacing: '0.04em',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {tab === 'ingest' ? 'Ingest Document' : 'View Documents'}
            </button>
          ))}
        </div>

        {activeTab === 'ingest' && (
          <div>
            {/* URL Auto-Ingest section */}
            <UrlIngestSection
              onSuccess={(msg) => { setSuccessMsg(msg); setErrorMsg(''); }}
              onError={(msg) => { setErrorMsg(msg); setSuccessMsg(''); }}
            />

            {/* Global feedback messages */}
            {errorMsg && (
              <div
                className="px-4 py-3 rounded-lg text-sm mb-6"
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontFamily: "'Jost', sans-serif",
                }}
              >
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div
                className="px-4 py-3 rounded-lg text-sm mb-6"
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#16a34a',
                  fontFamily: "'Jost', sans-serif",
                }}
              >
                {successMsg}
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px" style={{ backgroundColor: '#EDE8DF' }} />
              <span
                className="text-xs"
                style={{ color: '#8A8A8A', fontFamily: "'Jost', sans-serif", letterSpacing: '0.1em' }}
              >
                OR PASTE MANUALLY
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: '#EDE8DF' }} />
            </div>

            {/* Manual ingest section */}
            <div
              className="rounded-xl p-6"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #EDE8DF' }}
            >
              <h2
                className="mb-6"
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  color: '#C9A84C',
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  letterSpacing: '0.03em',
                  borderBottom: '1px solid #EDE8DF',
                  paddingBottom: '12px',
                }}
              >
                Add Knowledge Document
              </h2>

              <div className="space-y-5">
                <div>
                  <label style={labelStyle}>Source Name *</label>
                  <input
                    type="text"
                    value={form.sourceName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setForm({ ...form, sourceName: e.target.value })
                    }
                    placeholder="e.g. Leela Mumbai Property Fact Sheet"
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#21469F'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#EDE8DF'; }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Source URL (optional)</label>
                  <input
                    type="url"
                    value={form.sourceUrl}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setForm({ ...form, sourceUrl: e.target.value })
                    }
                    placeholder="https://theleela.com/..."
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#21469F'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#EDE8DF'; }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Assistant Mode</label>
                  <select
                    value={form.mode}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setForm({ ...form, mode: e.target.value as Mode | 'all' })
                    }
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#21469F'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#EDE8DF'; }}
                  >
                    <option value="all">All Modes</option>
                    <option value="guest">Guest Concierge only</option>
                    <option value="investor">Investor Assistant only</option>
                    <option value="internal">Internal Copilot only</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Document Content *</label>
                  <textarea
                    value={form.content}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setForm({ ...form, content: e.target.value })
                    }
                    placeholder="Paste document text here. The system will automatically chunk and embed it for RAG retrieval."
                    rows={10}
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                      minHeight: '200px',
                      lineHeight: '1.6',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#21469F'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#EDE8DF'; }}
                  />
                  {form.content && (
                    <p
                      className="mt-1 text-xs"
                      style={{ color: '#8A8A8A', fontFamily: "'Jost', sans-serif" }}
                    >
                      {form.content.length.toLocaleString()} characters · ~{Math.ceil(form.content.length / 1200)} estimated chunks
                    </p>
                  )}
                </div>

                {progress && (
                  <div>
                    <div
                      className="flex justify-between text-xs mb-1.5"
                      style={{ color: '#8A8A8A', fontFamily: "'Jost', sans-serif" }}
                    >
                      <span>Embedding chunks...</span>
                      <span>{progress.current} / {progress.total}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#EDE8DF' }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: '#21469F',
                          width: `${(progress.current / progress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleIngest}
                  disabled={isIngesting || !form.content.trim() || !form.sourceName.trim()}
                  className="px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: '#21469F',
                    color: '#FFFFFF',
                    fontFamily: "'Jost', sans-serif",
                    letterSpacing: '0.06em',
                    border: 'none',
                    cursor: isIngesting ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!isIngesting) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1a3a87';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#21469F';
                  }}
                >
                  {isIngesting ? 'INGESTING...' : 'INGEST DOCUMENT'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  color: '#C9A84C',
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  letterSpacing: '0.03em',
                  margin: 0,
                }}
              >
                Ingested Documents
              </h2>
              <button
                onClick={loadDocuments}
                disabled={isLoadingDocs}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200"
                style={{
                  border: '1px solid #21469F',
                  color: '#21469F',
                  backgroundColor: 'transparent',
                  fontFamily: "'Jost', sans-serif",
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#21469F';
                  (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#21469F';
                }}
              >
                {isLoadingDocs ? 'LOADING...' : 'REFRESH'}
              </button>
            </div>

            {isLoadingDocs ? (
              <div className="flex items-center justify-center py-16">
                <div
                  className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: '#21469F', borderTopColor: 'transparent' }}
                />
              </div>
            ) : Object.keys(groupedDocs).length === 0 ? (
              <div
                className="text-center py-16 rounded-xl"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #EDE8DF' }}
              >
                <p style={{ color: '#8A8A8A', fontFamily: "'Jost', sans-serif", fontSize: '0.875rem' }}>
                  No documents ingested yet. Use the Ingest tab to add content.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedDocs).map(([sourceName, chunks]) => (
                  <div
                    key={sourceName}
                    className="rounded-xl p-5 flex items-start justify-between gap-4"
                    style={{ backgroundColor: '#FFFFFF', border: '1px solid #EDE8DF' }}
                  >
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-medium text-sm mb-1 truncate"
                        style={{ color: '#1A1A2E', fontFamily: "'Jost', sans-serif" }}
                      >
                        {sourceName}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                          style={{
                            backgroundColor: '#21469F',
                            color: '#FFFFFF',
                            fontFamily: "'Jost', sans-serif",
                            fontSize: '0.7rem',
                            borderRadius: '4px',
                          }}
                        >
                          {chunks.length} chunk{chunks.length !== 1 ? 's' : ''}
                        </span>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                          style={{
                            backgroundColor: '#EDE8DF',
                            color: '#666666',
                            fontFamily: "'Jost', sans-serif",
                            fontSize: '0.7rem',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {chunks[0].mode}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: '#8A8A8A', fontFamily: "'Jost', sans-serif" }}
                        >
                          Added {new Date(chunks[0].created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(sourceName)}
                      disabled={deletingSource === sourceName}
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        fontFamily: "'Jost', sans-serif",
                        cursor: 'pointer',
                        letterSpacing: '0.04em',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fef2f2';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      {deletingSource === sourceName ? 'DELETING...' : 'DELETE'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="text-center py-4 mt-8"
        style={{
          borderTop: '1px solid #EDE8DF',
          color: '#8A8A8A',
          fontFamily: "'Jost', sans-serif",
          fontSize: '0.7rem',
          letterSpacing: '0.04em',
        }}
      >
        Leela Intelligence Platform v1.0 — Built by Rohan Kushvaha
      </div>
    </div>
  );
}