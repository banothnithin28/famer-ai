import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  User,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { askFarmerAI } from '../services/geminiService';
import { getPlants } from '../services/apiService';

const QUICK_QUESTIONS = [
  'What is wrong with my plant?',
  'Should I water today?',
  'Explain my latest scan',
];

export default function AIChatbot({ plantId = null }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: 'Namaste! 🌾 I am **Farmer AI**.\n\nAsk questions about your crop, plant health or weather.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [plants, setPlants] = useState([]);
  const [selectedPlantId, setSelectedPlantId] = useState(plantId || '');

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setSelectedPlantId(plantId || '');
    getPlants()
      .then((r) => {
        if (r?.success) setPlants(r.plants || []);
      })
      .catch(() => {});
  }, [plantId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputQuery('');
    setLoading(true);

    try {
      const history = messages
        .slice(-8)
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.text }));
      const response = await askFarmerAI(query, history, 'en', selectedPlantId || null, null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: 'Farmer AI is temporarily unavailable. Please verify your connection or ask again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'ai',
        text: 'Chat cleared. Ask questions about your crop, plant health or weather.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div style={{ maxWidth: 850, margin: '0 auto', paddingBottom: '3.5rem' }}>

      {/* ── Simple Header ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.25rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.2rem 0.65rem',
              borderRadius: 'var(--radius-full)',
              background: 'var(--warning-bg)',
              color: 'var(--warning-text)',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.35rem',
            }}
          >
            <Sparkles size={13} /> Gemini Crop Assistant
          </div>
          <h1
            style={{
              fontSize: 'clamp(1.5rem, 3.5vw, 2rem)',
              fontWeight: 900,
              color: 'var(--text-primary)',
              margin: '0 0 0.25rem 0',
            }}
          >
            🌾 Farmer AI
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Ask questions about your crop, plant health or weather.
          </p>
        </div>

        {/* Clear and Plant Context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {plants.length > 0 && (
            <select
              value={selectedPlantId}
              onChange={(e) => setSelectedPlantId(e.target.value)}
              aria-label="Focus on specific plant"
              style={{
                maxWidth: 200,
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            >
              <option value="">All Plants (General)</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.crop_name} ({p.field_name || 'Field'})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleClear}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.78rem' }}
            title="Reset conversation"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Quick Questions ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => handleSend(q)}
            disabled={loading}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 180ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.color = 'var(--primary)';
              e.currentTarget.style.background = 'var(--surface-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'var(--surface)';
            }}
          >
            "{q}"
          </button>
        ))}
      </div>

      {/* ── Chat Container ── */}
      <div
        className="card"
        style={{
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '62vh',
          minHeight: 440,
          background: 'var(--surface)',
        }}
      >
        {/* Messages List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {messages.map((msg) => {
            const isAI = msg.sender === 'ai';
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                  justifyContent: isAI ? 'flex-start' : 'flex-end',
                }}
              >
                {/* AI Avatar */}
                {isAI && (
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: 'var(--primary)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 6px color-mix(in srgb, var(--primary) 30%, transparent)',
                    }}
                  >
                    <Bot size={18} />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  style={{
                    maxWidth: '82%',
                    borderRadius: 'var(--radius-lg)',
                    padding: '0.9rem 1.1rem',
                    background: isAI ? 'var(--surface-secondary)' : 'var(--primary)',
                    color: isAI ? 'var(--text-primary)' : '#FFFFFF',
                    border: isAI ? '1px solid var(--border)' : 'none',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    position: 'relative',
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {msg.text}
                  </div>

                  {/* Bubble footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '0.5rem',
                      marginTop: '0.4rem',
                      fontSize: '0.72rem',
                      color: isAI ? 'var(--text-muted)' : 'rgba(255,255,255,0.8)',
                    }}
                  >
                    <span>{msg.timestamp}</span>
                    {isAI && (
                      <button
                        onClick={() => handleCopy(msg.text, msg.id)}
                        title="Copy message"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {copiedId === msg.id ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* User Avatar */}
                {!isAI && (
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: 'var(--surface-secondary)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <User size={18} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'var(--primary)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={18} />
              </div>
              <div
                style={{
                  background: 'var(--surface-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '0.7rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--primary)' }} />
                <span>Farmer AI is formulating agronomic advice…</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{
            padding: '0.85rem 1rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Type your crop question here…"
            disabled={loading}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 'var(--radius-md)',
              background: 'var(--input-background)',
              border: '1.5px solid var(--input-border)',
              color: 'var(--input-text)',
              padding: '0 1rem',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 180ms ease',
            }}
          />

          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="btn btn-primary"
            style={{
              height: 46,
              minHeight: 46,
              padding: '0 1.25rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 800,
            }}
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        </form>
      </div>

    </div>
  );
}
