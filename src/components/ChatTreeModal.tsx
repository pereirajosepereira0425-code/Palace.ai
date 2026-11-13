import React, { useState } from 'react';
import {
  GitBranch,
  X,
  MessageSquare,
  Sparkles,
  ArrowRight,
  CornerDownRight,
  Check,
  ChevronRight,
  Layers,
  Clock,
  User,
} from 'lucide-react';
import { ChatMessage, Character } from '../types/index.ts';

interface ChatTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  character: Character;
  activeSessionUuid?: string;
  onJumpToMessage?: (messageId: number) => void;
  onSelectNode?: (nodeId: number) => void;
}

export const ChatTreeModal: React.FC<ChatTreeModalProps> = ({
  isOpen,
  onClose,
  messages,
  character,
  activeSessionUuid,
  onJumpToMessage,
  onSelectNode,
}) => {
  const handleSelect = (msgId: number) => {
    setSelectedMessageId(msgId);
    if (onSelectNode) onSelectNode(msgId);
    if (onJumpToMessage) onJumpToMessage(msgId);
  };
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(
    messages[messages.length - 1]?.id || null
  );

  if (!isOpen) return null;

  const selectedMsg = messages.find((m) => m.id === selectedMessageId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in">
      <div className="relative flex flex-col h-[85vh] w-full max-w-5xl rounded-3xl border border-purple-500/40 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-purple-900/40 px-6 py-4 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-600/20 p-2 border border-purple-500/30">
              <GitBranch className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Full Chat Tree &amp; Branch History</span>
                <span className="rounded-md bg-purple-900/60 border border-purple-500/30 px-2 py-0.5 text-[10px] text-purple-300 font-mono">
                  {messages.length} Nodes
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Chub.ai conversation branching &amp; alternate swipe tree for {character.name}.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Two-Pane Tree View */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Column: Visual Node Hierarchy List */}
          <div className="md:col-span-7 border-r border-zinc-800/80 overflow-y-auto p-4 space-y-3 bg-zinc-950/50">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-2 pb-1">
              <span>Branch Sequence</span>
              <span>Turns: {Math.ceil(messages.length / 2)}</span>
            </div>

            {messages.map((msg, index) => {
              const isSelected = selectedMessageId === msg.id;
              const hasSwipes = msg.swipes && msg.swipes.length > 1;

              return (
                <div key={msg.id} className="relative flex items-start gap-2.5">
                  {/* Connecting branch line */}
                  {index < messages.length - 1 && (
                    <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/40 to-zinc-800" />
                  )}

                  {/* Node icon indicator */}
                  <div
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-bold transition-all shadow-md ${
                      msg.sender === 'user'
                        ? 'border-indigo-500/50 bg-indigo-950/60 text-indigo-300'
                        : 'border-purple-500/50 bg-purple-950/60 text-purple-300'
                    }`}
                  >
                    {msg.sender === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4 text-amber-300" />}
                  </div>

                  {/* Node Card */}
                  <div
                    onClick={() => setSelectedMessageId(msg.id)}
                    className={`flex-1 cursor-pointer rounded-2xl border p-3 transition-all ${
                      isSelected
                        ? 'border-purple-400 bg-purple-950/40 text-white ring-1 ring-purple-400 shadow-lg'
                        : 'border-zinc-800/80 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 mb-1">
                      <span className="font-bold text-white">
                        {msg.sender === 'user' ? 'User Turn' : character.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {hasSwipes && (
                          <span className="rounded-md bg-purple-900/60 border border-purple-500/30 px-1.5 py-0.5 text-purple-200">
                            Swipe {(msg.activeSwipeIndex || 0) + 1}/{msg.swipes?.length}
                          </span>
                        )}
                        <span className="font-mono text-zinc-500">#{msg.id}</span>
                      </div>
                    </div>

                    <p className="line-clamp-2 text-xs leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Node Details & Swipes Inspector */}
          <div className="md:col-span-5 flex flex-col p-5 bg-zinc-900/30 overflow-y-auto space-y-4">
            {selectedMsg ? (
              <>
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                      Node Details (ID #{selectedMsg.id})
                    </h3>
                    <div className="text-[11px] text-zinc-400">
                      Sender: <strong className="text-white capitalize">{selectedMsg.sender}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (onJumpToMessage) onJumpToMessage(selectedMsg.id);
                      if (onSelectNode) onSelectNode(selectedMsg.id);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-purple-500 transition-all cursor-pointer"
                  >
                    <span>Jump to Node</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Message Content Full */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">
                    Message Content
                  </label>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 text-xs text-zinc-200 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-sans">
                    {selectedMsg.content}
                  </div>
                </div>

                {/* Alternate Swipes */}
                {selectedMsg.swipes && selectedMsg.swipes.length > 1 && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5 block">
                      Alternate Swipes ({selectedMsg.swipes.length} available)
                    </label>
                    <div className="space-y-2">
                      {selectedMsg.swipes.map((sw, idx) => (
                        <div
                          key={idx}
                          className={`rounded-xl border p-2.5 text-xs leading-relaxed transition-all ${
                            idx === selectedMsg.activeSwipeIndex
                              ? 'border-purple-500/60 bg-purple-950/40 text-purple-100 font-medium'
                              : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'
                          }`}
                        >
                          <div className="text-[10px] font-bold text-purple-400 mb-1">
                            Swipe #{idx + 1} {idx === selectedMsg.activeSwipeIndex && '(Active)'}
                          </div>
                          <p className="line-clamp-3">{sw}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grounding Sources */}
                {selectedMsg.groundingSources && selectedMsg.groundingSources.length > 0 && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1 block">
                      Search Grounding Sources
                    </label>
                    <div className="space-y-1">
                      {selectedMsg.groundingSources.map((src, idx) => (
                        <a
                          key={idx}
                          href={src.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate rounded-lg bg-zinc-950 px-2 py-1 text-[11px] text-emerald-300 hover:underline border border-emerald-950"
                        >
                          {src.title || src.uri}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-500 italic">
                Select a message node in the tree to inspect its details and branches.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
