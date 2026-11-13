import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Filter,
  Flame,
  Clock,
  MessageSquare,
  Heart,
  PlusCircle,
  HelpCircle,
  Shield,
  Volume2,
  BrainCircuit,
  Globe,
  Upload,
  Palette,
  Sliders,
  Users,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar, PalaceNavTab } from './components/Navbar.tsx';
import { CharacterCard } from './components/CharacterCard.tsx';
import { CharacterStudio } from './components/CharacterStudio.tsx';
import { ChatRoom } from './components/ChatRoom.tsx';
import { UserChatsView } from './components/UserChatsView.tsx';
import { PersonaModal } from './components/PersonaModal.tsx';
import { PersonaGallery } from './components/PersonaGallery.tsx';
import { LorebookStudio } from './components/LorebookStudio.tsx';
import { ImagineStudio } from './components/ImagineStudio.tsx';
import { StagesManager, DEFAULT_STAGES, Stage } from './components/StagesManager.tsx';
import {
  PresetsModal,
  GenerationPresets,
  DEFAULT_PRESETS,
} from './components/PresetsModal.tsx';
import { CharacterDetailView } from './components/CharacterDetailView.tsx';
import { UserProfileView } from './components/UserProfileView.tsx';
import { UserProfileModal } from './components/UserProfileModal.tsx';
import { Character, ContentRating } from './types/index.ts';

const CATEGORY_TAGS = [
  'All',
  'Anime',
  'Cyberpunk',
  'Dark Fantasy',
  'RPG',
  'Sci-Fi',
  'Mystery',
  'Tsundere',
  'Wholesome',
  'Royalty',
  'Adventure',
  'Supernatural',
  'NSFW',
  'NSFL',
];

function PalaceApp() {
  const { user, getIdToken, setPersona } = useAuth();

  const [inspectUsername, setInspectUsername] = useState<string | null>(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0]?.toLowerCase() === 'users' && parts[1]) {
      return parts[1];
    }
    return null;
  });

  const getInitialTab = (): PalaceNavTab => {
    const path = window.location.pathname.replace(/^\//, '').toLowerCase();
    if (path === 'create' || path === 'studio') return 'studio';
    if (path === 'liked' || path === 'favorites') return 'favorites';
    if (path === 'profile' || path.startsWith('users/')) return 'profile';
    if (['chats', 'imagine', 'lorebooks', 'stages', 'personas', 'profile'].includes(path)) {
      return path as PalaceNavTab;
    }
    return 'explore';
  };

  const [activeTab, setActiveTabState] = useState<PalaceNavTab>(getInitialTab);

  const setActiveTab = (tab: PalaceNavTab, username?: string) => {
    setActiveTabState(tab);
    if (tab === 'profile' && username) {
      setInspectUsername(username);
      window.history.pushState(null, '', `/users/${username}`);
      return;
    }
    if (tab === 'profile' && !username) {
      setInspectUsername(null);
    }
    const newPath = tab === 'explore' ? '/' : tab === 'studio' ? '/create' : `/${tab}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const parts = window.location.pathname.split('/').filter(Boolean);
      if (parts[0]?.toLowerCase() === 'users' && parts[1]) {
        setInspectUsername(parts[1]);
      } else {
        setInspectUsername(null);
      }
      setActiveTabState(getInitialTab());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [likedIds, setLikedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [ratingFilter, setRatingFilter] = useState<'ALL' | 'SFW' | 'NSFW' | 'NSFL' | 'NSFW + NSFL'>('ALL');
  const [sortOrder, setSortOrder] = useState<'popular' | 'latest' | 'chats'>('popular');

  // Modals & Navigation
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [chatLaunchOptions, setChatLaunchOptions] = useState<{
    greetingOverride?: string;
    sessionUuid?: string;
    startNew?: boolean;
  } | null>(null);
  const [inspectCharacter, setInspectCharacter] = useState<Character | null>(null);
  const [forkCharacter, setForkCharacter] = useState<Character | null>(null);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Presets & Active Stage
  const [presets, setPresets] = useState<GenerationPresets>(() => {
    try {
      const saved = localStorage.getItem('palace_generation_presets');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_PRESETS;
  });

  const [activeStage, setActiveStage] = useState<Stage | null>(() => {
    try {
      const saved = localStorage.getItem('palace_active_stage');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_STAGES[0];
  });

  const handleSavePresets = (newPresets: GenerationPresets) => {
    setPresets(newPresets);
    try {
      localStorage.setItem('palace_generation_presets', JSON.stringify(newPresets));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectStage = (stage: Stage) => {
    setActiveStage(stage);
    try {
      localStorage.setItem('palace_active_stage', JSON.stringify(stage));
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch characters
  const fetchCharacters = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedTag !== 'All') params.append('tag', selectedTag);
      if (ratingFilter !== 'ALL') params.append('rating', ratingFilter);
      params.append('sort', sortOrder);

      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/characters?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCharacters(data.characters || []);
        setLikedIds(data.likedIds || []);
      }
    } catch (err) {
      console.error('Failed to load characters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, [searchQuery, selectedTag, ratingFilter, sortOrder, user]);

  const handleLikeToggle = async (charId: number) => {
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/characters/${charId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.liked) {
          setLikedIds((prev) => [...prev, charId]);
        } else {
          setLikedIds((prev) => prev.filter((id) => id !== charId));
        }
      }
    } catch (err) {
      console.error('Like toggle failed:', err);
    }
  };

  const handleCharacterCreated = (newChar: Character) => {
    setCharacters((prev) => [newChar, ...prev]);
    setActiveTab('explore');
    setSelectedCharacter(newChar);
  };

  const displayedCharacters =
    activeTab === 'favorites'
      ? characters.filter((c) => likedIds.includes(c.id))
      : characters;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* Top Header Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedCharacter(null);
          setInspectCharacter(null);
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        ratingFilter={ratingFilter}
        setRatingFilter={setRatingFilter}
        onOpenPersonaModal={() => setIsPersonaModalOpen(true)}
        onOpenPresetsModal={() => setIsPresetsModalOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* If in Active Chat Room */}
        {selectedCharacter ? (
          <ChatRoom
            character={selectedCharacter}
            activeStage={activeStage}
            initialSessionUuid={chatLaunchOptions?.sessionUuid}
            startNewChat={chatLaunchOptions?.startNew}
            greetingOverride={chatLaunchOptions?.greetingOverride}
            onBack={() => {
              setSelectedCharacter(null);
              setChatLaunchOptions(null);
            }}
            onViewCharacterDetails={(c) => {
              setSelectedCharacter(null);
              setChatLaunchOptions(null);
              setInspectCharacter(c);
            }}
            onOpenPersonaModal={() => setIsPersonaModalOpen(true)}
            onOpenPresets={() => setIsPresetsModalOpen(true)}
            onOpenStages={() => setActiveTab('stages')}
          />
        ) : inspectCharacter ? (
          <CharacterDetailView
            character={inspectCharacter}
            isLiked={likedIds.includes(inspectCharacter.id)}
            onLikeToggle={handleLikeToggle}
            onForkCharacter={(char) => {
              setForkCharacter(char);
              setInspectCharacter(null);
              setActiveTab('studio');
            }}
            onViewCreator={(creatorName) => {
              setInspectCharacter(null);
              setActiveTab('profile', creatorName);
            }}
            onStartChat={(char, opts) => {
              setInspectCharacter(null);
              setChatLaunchOptions(opts || null);
              setSelectedCharacter(char);
            }}
            onBack={() => setInspectCharacter(null)}
          />
        ) : activeTab === 'profile' ? (
          <UserProfileView
            targetUsername={inspectUsername || undefined}
            onOpenEditModal={() => setIsProfileModalOpen(true)}
            onSelectCharacter={(c) => {
              setChatLaunchOptions(null);
              setSelectedCharacter(c);
              setActiveTab('explore');
            }}
            onQuickViewCharacter={(c) => setInspectCharacter(c)}
            onBack={() => setActiveTab('explore')}
          />
        ) : activeTab === 'studio' ? (
          <CharacterStudio
            forkFromCharacter={forkCharacter}
            onCharacterCreated={(char) => {
              setForkCharacter(null);
              handleCharacterCreated(char);
            }}
            onCancel={() => {
              setForkCharacter(null);
              setActiveTab('explore');
            }}
          />
        ) : activeTab === 'chats' ? (
          <UserChatsView
            onSelectCharacter={(char) => setSelectedCharacter(char)}
          />
        ) : activeTab === 'imagine' ? (
          <ImagineStudio
            onUseAsAvatar={(imgUrl) => {
              setActiveTab('studio');
            }}
          />
        ) : activeTab === 'lorebooks' ? (
          <LorebookStudio />
        ) : activeTab === 'stages' ? (
          <StagesManager
            activeStageId={activeStage?.id || ''}
            onSelectStage={handleSelectStage}
          />
        ) : activeTab === 'personas' ? (
          <PersonaGallery
            onSelectPersona={(p) => {
              setPersona({ name: p.name, bio: p.bio });
              setIsPersonaModalOpen(true);
            }}
            onOpenCreateModal={() => setIsPersonaModalOpen(true)}
          />
        ) : (
          /* Explore & Favorites Gallery */
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
            {/* Hero Banner (Only on Explore tab when not searching) */}
            {activeTab === 'explore' && !searchQuery && (
              <div className="relative overflow-hidden rounded-3xl border border-purple-900/50 bg-gradient-to-br from-purple-950/60 via-zinc-900/80 to-zinc-950 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
                <div className="absolute right-0 top-0 -mr-16 -mt-16 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
                <div className="absolute left-1/3 bottom-0 -mb-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

                <div className="relative z-10 max-w-2xl space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-900/30 px-3 py-1 text-xs font-semibold text-purple-200">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>Next-Gen Character Roleplay Experience &bull; Tavern V2</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                    Every Character.{' '}
                    <span className="bg-gradient-to-r from-purple-400 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">
                      Unfiltered Immersion.
                    </span>
                  </h1>

                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-xl">
                    Chub.ai, Janitor.ai, and SpicyChat all-in-one. Import characters via link, switch alternate greetings, deploy world lorebooks, and generate atmospheric stages. Powered by{' '}
                    <strong className="text-purple-300">gemini-4-argon</strong> High-Thinking,{' '}
                    <strong className="text-amber-300">gemini-3.8-flash-tts</strong>, or custom Chub.ai Mars API.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() => setActiveTab('studio')}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-900/40 hover:from-purple-500 hover:to-amber-400 transition-all"
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>Create Character</span>
                    </button>

                    <button
                      onClick={() => setIsPresetsModalOpen(true)}
                      className="flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-950/40 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900/40 transition-all"
                    >
                      <Sliders className="h-4 w-4 text-purple-400" />
                      <span>Configure Chub API / Engine</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Category Tags Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {CATEGORY_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-xs font-semibold transition-all border ${
                    selectedTag === tag
                      ? 'border-purple-500 bg-purple-600/30 text-purple-200 shadow-md shadow-purple-950/40'
                      : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Filter & Sort Controls Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-zinc-400 font-medium">
                Showing{' '}
                <strong className="text-zinc-100">{displayedCharacters.length}</strong>{' '}
                {activeTab === 'favorites' ? 'liked characters' : 'characters in the Palace'}
              </div>

              {/* Sort Order Tabs */}
              <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 p-1">
                <button
                  onClick={() => setSortOrder('popular')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-all ${
                    sortOrder === 'popular'
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Flame className="h-3.5 w-3.5 text-amber-400" />
                  <span>Popular</span>
                </button>

                <button
                  onClick={() => setSortOrder('chats')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-all ${
                    sortOrder === 'chats'
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 text-fuchsia-400" />
                  <span>Most Chatted</span>
                </button>

                <button
                  onClick={() => setSortOrder('latest')}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-all ${
                    sortOrder === 'latest'
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Newest</span>
                </button>
              </div>
            </div>

            {/* Characters Grid */}
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  <p className="text-xs text-zinc-400">Loading Palace Bots...</p>
                </div>
              </div>
            ) : displayedCharacters.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 mb-3">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-zinc-100 text-base mb-1">No Characters Found</h3>
                <p className="text-xs text-zinc-400 max-w-sm mb-4">
                  Try adjusting your search terms or category tag filters, or import a character from Chub.ai!
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTag('All');
                    setRatingFilter('ALL');
                  }}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {displayedCharacters.map((char) => (
                  <CharacterCard
                    key={char.id}
                    character={char}
                    isLiked={likedIds.includes(char.id)}
                    onLikeToggle={handleLikeToggle}
                    onSelectCharacter={(c) => setSelectedCharacter(c)}
                    onQuickView={(c) => setInspectCharacter(c)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Persona Configuration Modal */}
      <PersonaModal
        isOpen={isPersonaModalOpen}
        onClose={() => setIsPersonaModalOpen(false)}
      />

      {/* Chub API & Generation Presets Modal */}
      <PresetsModal
        isOpen={isPresetsModalOpen}
        onClose={() => setIsPresetsModalOpen(false)}
        presets={presets}
        onSavePresets={handleSavePresets}
      />

      {/* User Profile Customization Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PalaceApp />
    </AuthProvider>
  );
}
