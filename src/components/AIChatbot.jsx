import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  User, 
  Sparkles, 
  Mic, 
  MicOff, 
  Trash2, 
  Copy, 
  Check, 
  Globe, 
  RefreshCw,
  Sprout,
  HelpCircle
} from 'lucide-react';
import { askFarmerAI } from '../services/geminiService';
import { getPlants } from '../services/apiService';

export default function AIChatbot({ plantId = null }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "Namaste! 🌾 I am **Farmer AI**.\n\nAsk me about your crops, plants, leaves, watering, or farming problems.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [selectedLang, setSelectedLang] = useState('English');
  const [plants, setPlants] = useState([]);
  const [selectedPlantId, setSelectedPlantId] = useState(plantId || '');
  const [weatherLocation, setWeatherLocation] = useState(null);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const presetQueries = [
    'What is wrong with my plant?',
    'Should I water my crop today?',
    'Will rain affect my crop?',
    'How can I prevent pests?',
    'How do I care for this plant?',
    'Explain my plant history'
  ];

  const languages = ['English', 'తెలుగు', 'हिन्दी', 'தமிழ்'];

  useEffect(() => {
    setSelectedPlantId(plantId || '');
    getPlants().then((result) => {
      if (result?.success) setPlants(result.plants || []);
    }).catch(() => {});
  }, [plantId]);

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    navigator.geolocation.getCurrentPosition(
      (position) => setWeatherLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => setWeatherLocation(null),
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 5000 }
    );
    return undefined;
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputQuery('');
    setLoading(true);

    try {
      const history = messages.slice(-8).map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.text }));
      const languageCode = selectedLang === 'हिन्दी' ? 'hi' : selectedLang === 'తెలుగు' ? 'te' : selectedLang === 'தமிழ்' ? 'ta' : 'en';
      const response = await askFarmerAI(query, history, languageCode, selectedPlantId || null, weatherLocation);

      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: "Farmer AI is temporarily unavailable. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 1,
        sender: 'ai',
        text: "Chat history cleared. How can **Farmer AI** assist your field today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setInputQuery((current) => current || 'Voice input is not supported in this browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = selectedLang === 'తెలుగు' ? 'te-IN' : selectedLang === 'हिन्दी' ? 'hi-IN' : selectedLang === 'தமிழ்' ? 'ta-IN' : 'en-IN';
    recognition.onresult = (event) => setInputQuery(event.results[0][0].transcript);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
      
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-700 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
            <Bot className="w-6 h-6 text-emerald-200 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg leading-tight">🌾 Gemini Farmer Assistant</h2>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
            </div>
            <p className="text-xs text-emerald-100/80">Ask about your crop, plant health, diseases, weather and farming.</p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <div className="relative flex items-center bg-emerald-950/40 rounded-lg px-2.5 py-1 text-xs border border-emerald-500/30">
            <Globe className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="bg-transparent text-emerald-100 focus:outline-none cursor-pointer font-medium"
            >
              {languages.map((lang) => (
                <option key={lang} value={lang} className="bg-slate-900 text-white">
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleClearChat}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <Sprout className="h-4 w-4 text-emerald-600" />
        <label htmlFor="assistant-plant" className="text-xs font-bold text-slate-500">Plant context:</label>
        <select id="assistant-plant" value={selectedPlantId} onChange={(event) => setSelectedPlantId(event.target.value)} className="min-h-9 max-w-[240px] rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <option value="">No plant selected</option>
          {plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.crop_name} - {plant.field_name}</option>)}
        </select>
        <span className="text-[11px] text-slate-400">Only real saved scan history is shared.</span>
      </div>

      {/* Preset Suggestions */}
      <div className="bg-slate-50 dark:bg-slate-950/60 px-4 py-2.5 border-b border-slate-200/60 dark:border-slate-800 overflow-x-auto flex items-center gap-2 scrollbar-none">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 shrink-0">
          <Sparkles className="w-3 h-3 text-amber-500" /> Try asking:
        </span>
        {presetQueries.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(preset)}
            className="shrink-0 text-xs bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 text-slate-700 dark:text-slate-200 px-3 py-1 rounded-full transition-all"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Messages Scroll Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[88%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  isUser
                    ? 'bg-slate-800 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {isUser ? <User className="w-5 h-5" /> : <Sprout className="w-5 h-5" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-1">
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative group ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-tr-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-normal">
                    {msg.text}
                  </div>

                  {/* Copy Button */}
                  {!isUser && (
                    <button
                      onClick={() => handleCopy(msg.text, msg.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-800 dark:hover:text-white"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                <div
                  className={`text-[10px] text-slate-400 font-medium px-1 ${
                    isUser ? 'text-right' : 'text-left'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 max-w-[80%]">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 animate-spin" />
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-xs border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-slate-500 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Farmer AI is formulating agronomist recommendations...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Voice Listening Bar Indicator */}
      {isListening && (
        <div className="bg-amber-500/10 border-t border-amber-500/20 px-4 py-2 flex items-center justify-between text-amber-700 dark:text-amber-300 text-xs font-semibold">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            Listening to your voice input... (Speak now)
          </span>
          <button onClick={() => setIsListening(false)} className="underline">Cancel</button>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={toggleVoice}
            className={`p-3 rounded-xl border transition-colors ${
              isListening
                ? 'bg-red-500 text-white border-red-600 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
            }`}
            title="Voice Assistant"
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask Farmer AI (e.g., How to protect paddy from stem borer?)"
            className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-emerald-500 text-sm"
          />

          <button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-md shadow-emerald-950/20"
          >
            <span>Send</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
}
