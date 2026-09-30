import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Shield } from 'lucide-react';
import { ChatMessage, User } from '../../types';

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentUser: User;
  onSendMessage: (text: string, reaction?: string) => void;
}

const QUICK_REACTIONS = ['👏', '🔥', '❤️', '😂', '👍', '🚀', '🎉', '🤖'];

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen,
  onClose,
  messages,
  currentUser,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="fixed inset-0 md:relative md:inset-auto w-full md:w-80 lg:w-96 bg-slate-900/98 md:bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 flex flex-col h-full z-50 md:z-20 shrink-0">
      {/* Top Header */}
      <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Chat de la Sala</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            En vivo
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs px-4">
            <p>Aún no hay mensajes en la conversación.</p>
            <p className="mt-1 text-slate-600">Envía un saludo o una reacción rápida a todos los participantes.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === currentUser.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-semibold text-slate-300">
                    {isMe ? 'Tú' : msg.userName}
                  </span>
                  {msg.role === 'admin' && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/80 px-1 rounded">
                      <Shield className="w-2.5 h-2.5" />
                      ADMIN
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words ${
                    isMe
                      ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-br-xs'
                      : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-bl-xs'
                  }`}
                >
                  {msg.text}
                  {msg.reaction && (
                    <div className="text-xl mt-1 select-none">{msg.reaction}</div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reactions Bar */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-1 overflow-x-auto">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSendMessage(emoji, emoji)}
            className="p-1.5 hover:scale-125 transition active:scale-95 text-base rounded-md hover:bg-slate-800"
            title={`Reaccionar con ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSend} className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-800 flex items-center gap-2 bg-slate-950/80">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Escribe un mensaje..."
          maxLength={200}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 transition active:scale-95 shadow-md"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
