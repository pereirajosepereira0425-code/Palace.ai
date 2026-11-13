import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  Heart,
  Volume2,
  BookOpen,
  BrainCircuit,
  Globe,
  Download,
  Play,
  Square,
  Sparkles,
} from 'lucide-react';
import { Character } from '../types/index.ts';
import { exportTavernCard, formatRoleplaySegments, renderWikiMarkup } from '../utils/characterUtils.ts';

interface CharacterModalProps {
  character: Character | null;
  onClose: () => void;
  onStartChat: (character: Character) => void;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  character,
  onClose,
  onStartChat,
}) => {
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'lorebook' | 'dialogue'>('details');
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  if (!character) return null;

  let tagList: string[] = [];
  try {
    tagList = Array.isArray(character.tags) ? character.tags : JSON.parse(character.tags || '[]');
  } catch {
    tagList = [character.tags];
  }

  let loreEntries: Array<{ key: string; content: string }> = [];
  try {
    loreEntries = JSON.parse(character.lorebook || '[]');
  } catch {
    loreEntries = [];
  }

  const handleTestVoice = async () => {
    if (isPlayingVoice && audioElement) {
      audioElement.pause();
      setIsPlayingVoice(false);
      return;
    }

    try {
      setIsPlayingVoice(true);
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: character.greeting.slice(0, 150),
          voiceName: character.voiceName,
          voiceStyle: character.voiceStyle || 'Expressive roleplay dialogue',
        }),
      });

      if (!res.ok) throw new Error('Voice sample failed');
      const data = await res.json();
      const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
      setAudioElement(audio);

      audio.onended = () => setIsPlayingVoice(false);
      audio.onerror = () => setIsPlayingVoice(false);
      await audio.play();
    } catch (err) {
      console.error('Error playing voice sample:', err);
      setIsPlayingVoice(false);
    }
  };

  const handleExportJson = () => {
    const tavernData = exportTavernCard(character);
    const blob = new Blob([JSON.stringify(tavernData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_tavern_v2.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const greetingSegments = formatRoleplaySegments(character.greeting);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative flex flex-col md:flex-row w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-800 backdrop-blur-sm transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Left Column: Portrait & Quick Stats */}
        <div className="relative md:w-80 shrink-0 bg-zinc-900/50 p-6 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-zinc-800/80">
          <div className="flex flex-col items-center text-center w-full">
            <div className="relative aspect-[3/4] w-48 sm:w-56 overflow-hidden rounded-2xl border-2 border-purple-500/40 shadow-xl shadow-purple-950/40 mb-4">
              <img
                src={character.avatar}
                alt={character.name}
                className="h-full w-full object-cover object-top"
              />
              <span
                className={`absolute top-2.5 left-2.5 rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border backdrop-blur-md ${
                  character.rating === 'NSFW'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {character.rating}
              </span>
            </div>

            <h2 className="text-xl font-black text-zinc-100">{character.name}</h2>
            <p className="text-xs text-zinc-400 font-medium">By {character.creatorName}</p>

            {/* Voice Preview Badge & Button */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleTestVoice}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shadow-sm ${
                  isPlayingVoice
                    ? 'bg-amber-500/30 text-amber-200 border-amber-400/60 animate-pulse'
                    : 'bg-zinc-800/80 text-amber-300 border-zinc-700 hover:bg-zinc-700'
                }`}
                title="Preview Voice Persona via Gemini 3.8 Flash TTS"
              >
                {isPlayingVoice ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                <span>Voice: {character.voiceName}</span>
              </button>
            </div>
          </div>

          {/* Action buttons on left bottom */}
          <div className="w-full space-y-2 pt-4">
            <button
              onClick={() => onStartChat(character)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 py-3 text-sm font-bold text-white shadow-lg shadow-purple-900/40 hover:from-purple-500 hover:to-amber-400 transition-all"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Start Roleplay Chat</span>
            </button>

            <button
              onClick={handleExportJson}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all"
            >
              <Download className="h-3.5 w-3.5 text-purple-400" />
              <span>Export Tavern Card JSON</span>
            </button>
          </div>
        </div>

        {/* Right Column: Character Details, Greeting, Lorebook */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800/80 bg-zinc-900/30 px-6 pt-4">
            <button
              onClick={() => setActiveTab('details')}
              className={`border-b-2 px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'details'
                  ? 'border-purple-500 text-purple-300'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Story & Greeting
            </button>
            <button
              onClick={() => setActiveTab('lorebook')}
              className={`border-b-2 px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'lorebook'
                  ? 'border-purple-500 text-purple-300'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Lorebook ({loreEntries.length})
            </button>
            <button
              onClick={() => setActiveTab('dialogue')}
              className={`border-b-2 px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'dialogue'
                  ? 'border-purple-500 text-purple-300'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Example Dialogues
            </button>
          </div>

          {/* Tab Content with scroll */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-zinc-300 text-xs sm:text-sm">
            {activeTab === 'details' && (
              <>
                {/* Tagline */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-400 mb-1">
                    Tagline
                  </h4>
                  <p className="italic text-zinc-200 text-sm font-medium">{character.tagline}</p>
                </div>

                {/* Tags */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-400 mb-1.5">
                    Category Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {tagList.map((tag, i) => (
                      <span
                        key={i}
                        className="rounded-lg bg-zinc-800/90 px-2.5 py-1 text-xs font-medium text-zinc-200 border border-zinc-700/60"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Initial Greeting (First Message) */}
                <div className="rounded-2xl border border-purple-900/40 bg-purple-950/20 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-2">
                    <Sparkles className="h-4 w-4" />
                    <span>First Message / Scenario Starter</span>
                  </div>
                  <div className="space-y-1.5 leading-relaxed text-zinc-200">
                    {greetingSegments.map((seg, idx) =>
                      seg.type === 'action' ? (
                        <p key={idx} className="italic text-purple-300/90 font-serif">
                          *{seg.text}*
                        </p>
                      ) : (
                        <p key={idx} className="text-zinc-100 font-sans">
                          {seg.text}
                        </p>
                      )
                    )}
                  </div>
                </div>

                {/* Personality & Scenario */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-400 mb-1">
                    Personality &amp; Background
                  </h4>
                  <div
                    className="wiki-rendered-content text-zinc-300 leading-relaxed bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 text-xs sm:text-sm prose prose-invert max-w-none overflow-x-auto"
                    dangerouslySetInnerHTML={{
                      __html: renderWikiMarkup(character.description, character.name),
                    }}
                  />
                </div>

                {character.scenario && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-400 mb-1">
                      Current Scenario / Setting
                    </h4>
                    <div
                      className="wiki-rendered-content text-zinc-300 leading-relaxed bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 text-xs sm:text-sm prose prose-invert max-w-none overflow-x-auto"
                      dangerouslySetInnerHTML={{
                        __html: renderWikiMarkup(character.scenario, character.name),
                      }}
                    />
                  </div>
                )}
              </>
            )}

            {activeTab === 'lorebook' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-purple-300">
                    World Info / Lorebook Entries
                  </h4>
                  <span className="text-[11px] text-zinc-500">
                    Automatically triggered when keywords are mentioned in chat
                  </span>
                </div>

                {loreEntries.length === 0 ? (
                  <p className="italic text-zinc-500 text-center py-8">
                    No custom lorebook entries attached to this character.
                  </p>
                ) : (
                  loreEntries.map((entry, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-amber-400" />
                        <span className="font-bold text-zinc-100">{entry.key}</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">{entry.content}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'dialogue' && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-400 mb-2">
                  Dialogue Examples ({'<START>'} format)
                </h4>
                {character.exampleDialogues ? (
                  <pre className="whitespace-pre-wrap font-mono text-xs bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 text-zinc-300 leading-relaxed">
                    {character.exampleDialogues}
                  </pre>
                ) : (
                  <p className="italic text-zinc-500 text-center py-8">
                    No specific example dialogues defined. The bot dynamically reasons its speech.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
