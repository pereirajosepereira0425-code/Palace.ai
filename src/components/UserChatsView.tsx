import React, { useEffect, useState } from 'react';
import { MessageSquare, Trash2, Clock, BrainCircuit, Globe, Volume2, ArrowRight } from 'lucide-react';
import { Character, ChatSession } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ViewportSlot } from './ViewportSlot.tsx';

interface UserChatsViewProps {
  onSelectCharacter: (char: Character) => void;
}

export const UserChatsView: React.FC<UserChatsViewProps> = ({ onSelectCharacter }) => {
  const { user, guestId, getIdToken } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteUuid, setConfirmDeleteUuid] = useState<string | null>(null);

  const fetchChats = async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/user/chats', { headers });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load user chats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [user, guestId]);

  const handleDeleteSession = async (e: React.MouseEvent, sessionUuid: string) => {
    e.stopPropagation();
    if (confirmDeleteUuid !== sessionUuid) {
      setConfirmDeleteUuid(sessionUuid);
      setTimeout(() => setConfirmDeleteUuid((curr) => (curr === sessionUuid ? null : curr)), 3500);
      return;
    }
    setConfirmDeleteUuid(null);

    try {
      await fetch(`/api/chat/session/${sessionUuid}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.uuid !== sessionUuid));
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 border-b border-purple-900/40 pb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 flex items-center gap-2">
          <span>Active Roleplay Chats</span>
          <span className="rounded-lg bg-purple-500/20 px-2.5 py-0.5 text-xs text-purple-300 border border-purple-500/30 font-semibold">
            {sessions.length}
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Pick up right where you left off in your conversations and stories
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 mb-4">
            <MessageSquare className="h-7 w-7" />
          </div>
          <h3 className="font-bold text-zinc-100 text-base mb-1">No Active Chats Yet</h3>
          <p className="text-xs text-zinc-400 max-w-sm mb-6">
            Explore our curated gallery of characters from Chub, Janitor, and SpicyChat to start your first roleplay session!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((sess, idx) => {
            const char = sess.character;
            if (!char) return null;

            return (
              <ViewportSlot
                key={sess.id}
                estimatedHeight={100}
                rootMargin="120px 0px"
                initialVisible={idx < 6}
                testId="user-chat-slot"
              >
                <div
                  onClick={() => onSelectCharacter(char)}
                  className="group flex items-center gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 hover:border-purple-500/50 hover:bg-zinc-900/90 hover:shadow-lg transition-all cursor-pointer"
                >
                  {/* Character Avatar */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-purple-500/40 shadow-sm">
                    <img
                      src={char.avatar}
                      alt={char.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-top transition-transform group-hover:scale-105"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-zinc-100 group-hover:text-purple-300 transition-colors truncate">
                        {char.name}
                      </h3>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold text-zinc-400">
                        {char.rating}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
                      {char.tagline}
                    </p>

                    <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500">
                      <span className="flex items-center gap-1 text-zinc-400">
                        <Clock className="h-3 w-3" />
                        {new Date(sess.updatedAt).toLocaleDateString()}
                      </span>

                      {sess.thinkingLevel === 'HIGH' && (
                        <span className="flex items-center gap-0.5 text-purple-400 font-medium">
                          <BrainCircuit className="h-3 w-3" />
                          Thinking
                        </span>
                      )}

                      {sess.searchGrounding && (
                        <span className="flex items-center gap-0.5 text-sky-400 font-medium">
                          <Globe className="h-3 w-3" />
                          Search
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDeleteSession(e, sess.uuid)}
                      className={`p-2 transition-colors rounded-lg flex items-center gap-1 text-xs font-bold ${
                        confirmDeleteUuid === sess.uuid
                          ? 'bg-rose-600 text-white px-2.5'
                          : 'text-zinc-500 hover:text-rose-400 hover:bg-zinc-800'
                      }`}
                      title={confirmDeleteUuid === sess.uuid ? 'Click again to delete chat' : 'Delete Chat'}
                    >
                      <Trash2 className="h-4 w-4" />
                      {confirmDeleteUuid === sess.uuid && <span>Confirm</span>}
                    </button>
                    <div className="p-2 text-purple-400 group-hover:translate-x-1 transition-transform">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </ViewportSlot>
            );
          })}
        </div>
      )}
    </div>
  );
};
