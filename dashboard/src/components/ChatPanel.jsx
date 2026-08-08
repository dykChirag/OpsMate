import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../api.js';

const SUGGESTED = [
  'Why is demo-api slow right now?',
  'What caused the last crash?',
  'Are there any database errors?',
  'What should I do about the high-severity incidents?',
];

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display:       'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom:  'var(--space-3)',
    }}>
      <div style={{
        maxWidth:     '82%',
        padding:      '10px 14px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background:   isUser ? 'var(--color-accent)' : 'rgba(16,28,52,0.9)',
        border:       isUser ? 'none' : '1px solid var(--color-border)',
        fontSize:     13,
        lineHeight:   1.65,
        color:        isUser ? '#fff' : 'var(--color-text-primary)',
        whiteSpace:   'pre-wrap',
        wordBreak:    'break-word',
      }}>
        {msg.content}
        {msg.contextSummary && (
          <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.55)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6 }}>
            Grounded on {msg.contextSummary.incidentCount} incidents · {msg.contextSummary.logCount} log lines
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const [messages,  setMessages]  = useState([
    { role: 'assistant', content: 'Hi! I\'m OpsMate. Ask me anything about what\'s happening with your services — I\'ll answer based on live incidents and real log data.' },
  ]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(question) {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await apiFetch('/chat', {
        method: 'POST',
        body:   JSON.stringify({ question: q }),
      });
      setMessages((m) => [...m, {
        role:           'assistant',
        content:        res.answer,
        contextSummary: res.contextSummary,
      }]);
    } catch (err) {
      setMessages((m) => [...m, {
        role:    'assistant',
        content: `⚠ Error: ${err.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card" style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span style={{ fontSize: 18 }}>🤖</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Ask OpsMate</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
            Grounded answers from live incidents + logs
          </div>
        </div>
      </div>

      {/* Suggested questions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {SUGGESTED.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={loading}
            style={{
              background:   'rgba(79,142,247,0.08)',
              border:       '1px solid rgba(79,142,247,0.18)',
              borderRadius: '99px',
              padding:      '4px 12px',
              fontSize:     11,
              color:        'var(--color-accent)',
              cursor:       'pointer',
              transition:   'all var(--transition)',
              fontFamily:   'var(--font-sans)',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Message thread */}
      <div style={{
        flex:       1,
        overflowY:  'auto',
        maxHeight:  340,
        padding:    'var(--space-2) 0',
        minHeight:  120,
      }}>
        {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 'var(--space-3)' }}>
            <div style={{ padding: '10px 16px', borderRadius: '14px 14px 14px 4px', background: 'rgba(16,28,52,0.9)', border: '1px solid var(--color-border)', display: 'flex', gap: 6, alignItems: 'center' }}>
              {[0, 150, 300].map((delay) => (
                <span key={delay} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--color-accent)',
                  animation: `pulse-glow 1s ${delay}ms ease-in-out infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <input
          id="chat-input"
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about an incident, service health, or error…"
          disabled={loading}
          autoComplete="off"
        />
        <button
          type="submit"
          id="chat-send-btn"
          className="btn btn-primary"
          disabled={loading || !input.trim()}
          style={{ flexShrink: 0 }}
        >
          {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '→'}
        </button>
      </form>
    </div>
  );
}
