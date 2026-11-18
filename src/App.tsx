import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { ViewportSlot } from './components/ViewportSlot.tsx';
import { OfflineIndicator } from './components/PWAInstallButton.tsx';
import { DomainSeoModal } from './components/DomainSeoModal.tsx';
import { Character, ContentRating, SharedLorebookRecord, SharedPersona, TagRecord } from './types/index.ts';
import { isOwnedByRequester } from './utils/ownership.ts';
import { chunkItems } from './utils/viewportUnload.ts';
import { SITE_DESCRIPTION, SITE_TITLE } from './utils/seoUtils.ts';

const CHARACTER_PAGE_SIZE = 24;
const EXPLORE_TAG_PAGE_SIZE = 48;
const EXPLORE_TAG_CHUNK_SIZE = 8;

const DEFAULT_FALLBACK_TAGS = [
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
  const { user, guestId, getIdToken, setPersona } = useAuth();

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
  const [loadingMoreChars, setLoadingMoreChars] = useState(false);
  const [hasMoreChars, setHasMoreChars] = useState(false);

  // Filters & Dynamic Tag DB
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [tagFilterInput, setTagFilterInput] = useState('');
  const [debouncedTagFilter, setDebouncedTagFilter] = useState('');
  const [dbTags, setDbTags] = useState<TagRecord[]>([]);
  const [hasMoreTags, setHasMoreTags] = useState(false);
  const [loadingMoreTags, setLoadingMoreTags] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<'ALL' | 'SFW' | 'NSFW' | 'NSFL' | 'NSFW + NSFL'>('ALL');
  const [sortOrder, setSortOrder] = useState<'popular' | 'latest' | 'chats'>('popular');

  const charNextOffsetRef = useRef(0);
  const charFetchingMoreRef = useRef(false);
  const charSentinelRef = useRef<HTMLDivElement | null>(null);

  const tagsScrollRef = useRef<HTMLDivElement | null>(null);
  const tagsSentinelRef = useRef<HTMLDivElement | null>(null);
  const tagsNextOffsetRef = useRef(0);
  const tagsFetchingMoreRef = useRef(false);

  // Modals & Navigation
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [chatLaunchOptions, setChatLaunchOptions] = useState<{
    greetingOverride?: string;
    sessionUuid?: string;
    startNew?: boolean;
  } | null>(null);
  const [inspectCharacter, setInspectCharacter] = useState<Character | null>(null);
  const [forkCharacter, setForkCharacter] = useState<Character | null>(null);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [pendingLorebook, setPendingLorebook] = useState<SharedLorebookRecord | null>(null);
  const [pendingPersonaLorebook, setPendingPersonaLorebook] = useState<SharedLorebookRecord | null>(null);
  const [editingPersona, setEditingPersona] = useState<SharedPersona | null>(null);
  const [personasRefreshKey, setPersonasRefreshKey] = useState(0);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDomainSeoOpen, setIsDomainSeoOpen] = useState(false);

  // Support direct /character/:uuid URLs (indexed via /sitemap.xml)
  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0]?.toLowerCase() === 'character' && parts[1]) {
      fetch(`/api/characters/${encodeURIComponent(parts[1])}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.character) {
            setInspectCharacter(data.character);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Dynamically resolve canonical URL, OpenGraph URL, title, and description per view
  useEffect(() => {
    const canonicalHref = window.location.origin + window.location.pathname;
    const activeChar = selectedCharacter || inspectCharacter;
    const nextTitle = activeChar
      ? `${activeChar.name} – Palace.ai Character Chat`
      : SITE_TITLE;
    const nextDescription = activeChar?.tagline?.trim()
      ? `${activeChar.name}: ${activeChar.tagline.slice(0, 120)} — Chat free on Palace.ai.`
      : SITE_DESCRIPTION;

    document.title = nextTitle;
    const setMeta = (selector: string, attr: string, content: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, content);
    };
    setMeta('meta[name="description"]', 'content', nextDescription);
    setMeta('meta[property="og:title"]', 'content', nextTitle);
    setMeta('meta[property="og:description"]', 'content', nextDescription);
    setMeta('meta[property="og:url"]', 'content', canonicalHref);
    setMeta('link[rel="canonical"]', 'href', canonicalHref);
  }, [activeTab, selectedCharacter, inspectCharacter]);

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
    return DEFAULT_STAGES.find((s) => s.id === 'cyberpunk-neon') || DEFAULT_STAGES[0];
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 180);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTagFilter(tagFilterInput.trim()), 180);
    return () => clearTimeout(t);
  }, [tagFilterInput]);

  // Fetch characters (paginated)
  const fetchCharacters = useCallback(
    async (offset: number = 0, append: boolean = false) => {
      if (append && charFetchingMoreRef.current) return;
      try {
        if (append) {
          charFetchingMoreRef.current = true;
          setLoadingMoreChars(true);
        } else {
          setLoading(true);
        }
        const params = new URLSearchParams();
        if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);
        if (selectedTag !== 'All') params.append('tag', selectedTag);
        if (ratingFilter !== 'ALL') params.append('rating', ratingFilter);
        params.append('sort', sortOrder);
        params.append('limit', String(CHARACTER_PAGE_SIZE));
        params.append('offset', String(offset));

        const token = await getIdToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/characters?${params.toString()}`, { headers });
        if (res.ok) {
          const data = await res.json();
          const incoming: Character[] = data.characters || [];
          setCharacters((prev) => {
            if (!append) return incoming;
            const seen = new Set(prev.map((c) => c.id));
            const merged = [...prev];
            for (const c of incoming) {
              if (!seen.has(c.id)) {
                seen.add(c.id);
                merged.push(c);
              }
            }
            return merged;
          });
          if (!append || (data.likedIds && data.likedIds.length > 0)) {
            setLikedIds(data.likedIds || []);
          }
          setHasMoreChars(Boolean(data.hasMore));
          charNextOffsetRef.current =
            typeof data.nextOffset === 'number' ? data.nextOffset : offset + incoming.length;
        }
      } catch (err) {
        console.error('Failed to load characters:', err);
      } finally {
        charFetchingMoreRef.current = false;
        setLoadingMoreChars(false);
        setLoading(false);
      }
    },
    [debouncedSearchQuery, selectedTag, ratingFilter, sortOrder, getIdToken]
  );

  // Fetch tags (paginated + server-filtered)
  const fetchDbTags = useCallback(
    async (searchTerm: string = '', offset: number = 0, append: boolean = false) => {
      if (append && tagsFetchingMoreRef.current) return;
      try {
        if (append) {
          tagsFetchingMoreRef.current = true;
          setLoadingMoreTags(true);
        }
        const params = new URLSearchParams();
        params.set('limit', String(EXPLORE_TAG_PAGE_SIZE));
        params.set('offset', String(offset));
        if (searchTerm) params.set('search', searchTerm);

        const res = await fetch(`/api/tags?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const incoming: TagRecord[] = Array.isArray(data.tags) ? data.tags : [];
          setDbTags((prev) => {
            if (!append) return incoming;
            const seen = new Set(prev.map((t) => t.name.toLowerCase()));
            const merged = [...prev];
            for (const t of incoming) {
              if (!seen.has(t.name.toLowerCase())) {
                seen.add(t.name.toLowerCase());
                merged.push(t);
              }
            }
            return merged;
          });
          setHasMoreTags(Boolean(data.hasMore));
          tagsNextOffsetRef.current =
            typeof data.nextOffset === 'number' ? data.nextOffset : offset + incoming.length;
        }
      } catch (err) {
        console.warn('Failed to fetch tags:', err);
      } finally {
        tagsFetchingMoreRef.current = false;
        setLoadingMoreTags(false);
      }
    },
    []
  );

  useEffect(() => {
    tagsNextOffsetRef.current = 0;
    fetchDbTags(debouncedTagFilter, 0, false);
  }, [debouncedTagFilter, fetchDbTags]);

  useEffect(() => {
    charNextOffsetRef.current = 0;
    fetchCharacters(0, false);
  }, [fetchCharacters, user]);

  // Infinite scroll sentinel for Explore characters grid
  useEffect(() => {
    const sentinel = charSentinelRef.current;
    if (!sentinel || !hasMoreChars || loading) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreChars && !charFetchingMoreRef.current) {
          fetchCharacters(charNextOffsetRef.current, true);
        }
      },
      { rootMargin: '500px 0px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreChars, loading, fetchCharacters]);

  // Horizontal infinite scroll sentinel for Explore tags strip
  useEffect(() => {
    const rootEl = tagsScrollRef.current;
    const sentinel = tagsSentinelRef.current;
    if (!rootEl || !sentinel || !hasMoreTags) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreTags && !tagsFetchingMoreRef.current) {
          fetchDbTags(debouncedTagFilter, tagsNextOffsetRef.current, true);
        }
      },
      { root: rootEl, rootMargin: '0px 240px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreTags, debouncedTagFilter, fetchDbTags]);

  const exploreTags = useMemo(() => {
    const base = dbTags.length > 0 ? dbTags.map((t) => t.name) : DEFAULT_FALLBACK_TAGS;
    const q = tagFilterInput.trim().toLowerCase();
    const filtered = q ? base.filter((t) => t.toLowerCase().includes(q)) : base;
    if (selectedTag !== 'All' && !filtered.includes(selectedTag)) {
      return ['All', selectedTag, ...filtered];
    }
    return ['All', ...filtered];
  }, [dbTags, tagFilterInput, selectedTag]);

  const exploreTagChunks = useMemo(
    () => chunkItems(exploreTags, EXPLORE_TAG_CHUNK_SIZE),
    [exploreTags]
  );

  const handleLikeToggle = useCallback(
    async (charId: number) => {
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
    },
    [getIdToken]
  );

  const handleCharacterCreated = (newChar: Character) => {
    setCharacters((prev) => [newChar, ...prev]);
    fetchDbTags(debouncedTagFilter, 0, false);
    setActiveTab('explore');
    setSelectedCharacter(newChar);
  };

  const handleStartEditCharacter = useCallback((char: Character) => {
    setForkCharacter(null);
    setEditingCharacter(char);
    setInspectCharacter(null);
    setSelectedCharacter(null);
    setActiveTab('studio');
  }, []);

  const handleCharacterUpdated = (updated: Character) => {
    setCharacters((prev) => prev.map((c) => (c.uuid === updated.uuid ? updated : c)));
    fetchDbTags(debouncedTagFilter, 0, false);
    setEditingCharacter(null);
    setActiveTab('explore');
    setInspectCharacter(updated);
  };

  const handleCharacterDeletedByUuid = useCallback(
    (uuid: string) => {
      setCharacters((prev) => prev.filter((c) => c.uuid !== uuid));
      if (editingCharacter?.uuid === uuid) setEditingCharacter(null);
      if (inspectCharacter?.uuid === uuid) setInspectCharacter(null);
      if (selectedCharacter?.uuid === uuid) setSelectedCharacter(null);
      setActiveTab('explore');
    },
    [editingCharacter?.uuid, inspectCharacter?.uuid, selectedCharacter?.uuid]
  );

  const handleDeleteCharacter = useCallback(
    async (char: Character) => {
      try {
        const token = await getIdToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `/api/characters/${encodeURIComponent(char.uuid)}?guestId=${encodeURIComponent(guestId)}`,
          { method: 'DELETE', headers }
        );
        if (res.ok) {
          handleCharacterDeletedByUuid(char.uuid);
        }
      } catch (err) {
        console.error('Failed to delete character:', err);
      }
    },
    [getIdToken, guestId, handleCharacterDeletedByUuid]
  );

  const handleQuickViewCharacter = useCallback((c: Character) => {
    setInspectCharacter(c);
    const charPath = `/character/${encodeURIComponent(c.uuid)}`;
    if (window.location.pathname !== charPath) {
      window.history.pushState(null, '', charPath);
    }
  }, []);

  const handleSelectCharacterToChat = useCallback((c: Character) => {
    setSelectedCharacter(c);
  }, []);

  const likedIdSet = useMemo(() => new Set(likedIds), [likedIds]);

  const displayedCharacters = useMemo(
    () =>
      activeTab === 'favorites'
        ? characters.filter((c) => likedIdSet.has(c.id))
        : characters,
    [activeTab, characters, likedIdSet]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* Top Header Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedCharacter(null);
          setInspectCharacter(null);
          setEditingCharacter(null);
          setForkCharacter(null);
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        ratingFilter={ratingFilter}
        setRatingFilter={setRatingFilter}
        onOpenPersonaModal={() => {
          setEditingPersona(null);
          setIsPersonaModalOpen(true);
        }}
        onOpenPresetsModal={() => setIsPresetsModalOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenDomainSeoModal={() => setIsDomainSeoOpen(true)}
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
              setEditingCharacter(null);
              setForkCharacter(char);
              setInspectCharacter(null);
              setActiveTab('studio');
            }}
            onEditCharacter={handleStartEditCharacter}
            onCharacterUpdated={(updated) => {
              setCharacters((prev) => prev.map((c) => (c.uuid === updated.uuid ? updated : c)));
              setInspectCharacter((curr) => (curr?.uuid === updated.uuid ? updated : curr));
            }}
            onDeleteCharacter={handleDeleteCharacter}
            onViewCreator={(creatorName) => {
              setInspectCharacter(null);
              setActiveTab('profile', creatorName);
            }}
            onStartChat={(char, opts) => {
              setInspectCharacter(null);
              setChatLaunchOptions(opts || null);
              setSelectedCharacter(char);
            }}
            onBack={() => {
              setInspectCharacter(null);
              if (window.location.pathname.startsWith('/character/')) {
                window.history.pushState(null, '', '/');
              }
            }}
          />
        ) : activeTab === 'profile' ? (
          <UserProfileView
            targetUsername={inspectUsername || undefined}
            onOpenEditModal={() => setIsProfileModalOpen(true)}
            onEditCharacter={handleStartEditCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            onEditPersona={(p) => {
              setEditingPersona(p);
              setIsPersonaModalOpen(true);
            }}
            onNavigateProfile={(username) => setActiveTab('profile', username)}
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
            editingCharacter={editingCharacter}
            pendingLorebook={pendingLorebook}
            onConsumePendingLorebook={() => setPendingLorebook(null)}
            onCharacterCreated={(char) => {
              setForkCharacter(null);
              setEditingCharacter(null);
              handleCharacterCreated(char);
            }}
            onCharacterUpdated={handleCharacterUpdated}
            onCharacterDeleted={handleCharacterDeletedByUuid}
            onCancel={() => {
              setForkCharacter(null);
              setEditingCharacter(null);
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
          <LorebookStudio
            onViewCreator={(username) => setActiveTab('profile', username)}
            onUseInCharacterStudio={(lb) => {
              setForkCharacter(null);
              setEditingCharacter(null);
              setPendingLorebook(lb);
              setActiveTab('studio');
            }}
            onUseInExistingCharacter={(lb, targetChar) => {
              setForkCharacter(null);
              setEditingCharacter(targetChar);
              setPendingLorebook(lb);
              setActiveTab('studio');
            }}
            onUseInPersona={(lb, targetPersona) => {
              setEditingPersona(targetPersona || null);
              setPendingPersonaLorebook(lb);
              setIsPersonaModalOpen(true);
            }}
            onCharacterUpdated={(updated) => {
              setCharacters((prev) => prev.map((c) => (c.uuid === updated.uuid ? updated : c)));
              setInspectCharacter((curr) => (curr?.uuid === updated.uuid ? updated : curr));
            }}
            onPersonasChanged={() => setPersonasRefreshKey((k) => k + 1)}
          />
        ) : activeTab === 'stages' ? (
          <StagesManager
            activeStageId={activeStage?.id || ''}
            onSelectStage={handleSelectStage}
            onViewCreator={(username) => setActiveTab('profile', username)}
          />
        ) : activeTab === 'personas' ? (
          <PersonaGallery
            refreshKey={personasRefreshKey}
            onSelectPersona={(p) => {
              setPersona(p);
              setEditingPersona(null);
              setIsPersonaModalOpen(true);
            }}
            onEditPersona={(p) => {
              setEditingPersona(p);
              setIsPersonaModalOpen(true);
            }}
            onOpenCreateModal={() => {
              setEditingPersona(null);
              setIsPersonaModalOpen(true);
            }}
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
                      className="flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-950/40 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900/40 transition-all cursor-pointer"
                    >
                      <Sliders className="h-4 w-4 text-purple-400" />
                      <span>Configure Chub API / Engine</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsDomainSeoOpen(true)}
                      data-testid="hero-domain-seo-btn"
                      className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-4 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-900/40 transition-all cursor-pointer"
                    >
                      <Globe className="h-4 w-4 text-cyan-400" />
                      <span>Free .com Website &amp; Google SEO</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Chub.ai Database Tags Filter Bar */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative w-full sm:w-64 shrink-0">
                  <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-400" />
                  <input
                    type="text"
                    value={tagFilterInput}
                    onChange={(e) => setTagFilterInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagFilterInput.trim()) {
                        setSelectedTag(tagFilterInput.trim().replace(/^#+/, ''));
                      }
                    }}
                    placeholder="Filter tags DB (type any #tag)..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div
                  ref={tagsScrollRef}
                  className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1"
                >
                  {exploreTagChunks.map((chunk, chunkIdx) => (
                    <ViewportSlot
                      key={`tag-chunk-${chunkIdx}-${chunk[0] || ''}`}
                      axis="horizontal"
                      rootRef={tagsScrollRef}
                      rootMargin="0px 80px"
                      estimatedWidth={640}
                      estimatedHeight={34}
                      initialVisible={chunkIdx === 0}
                      forceMounted={chunk.includes(selectedTag)}
                      className="flex items-center gap-2 shrink-0"
                      placeholderClassName="rounded-xl bg-zinc-900/30 border border-zinc-800/30"
                      testId="explore-tag-chunk"
                    >
                      {chunk.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setSelectedTag(tag)}
                          className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all border ${
                            selectedTag === tag
                              ? 'border-purple-500 bg-purple-600/30 text-purple-200 shadow-md shadow-purple-950/40'
                              : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                          }`}
                        >
                          {tag === 'All' ? 'All Tags' : `#${tag}`}
                        </button>
                      ))}
                    </ViewportSlot>
                  ))}

                  {hasMoreTags && (
                    <div ref={tagsSentinelRef} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => fetchDbTags(debouncedTagFilter, tagsNextOffsetRef.current, true)}
                        disabled={loadingMoreTags}
                        className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
                      >
                        {loadingMoreTags ? 'Loading...' : '+ More Tags'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {displayedCharacters.map((char, idx) => (
                    <ViewportSlot
                      key={char.id}
                      estimatedHeight={440}
                      rootMargin="120px 0px"
                      initialVisible={idx < 4}
                      testId="character-slot"
                    >
                      <CharacterCard
                        character={char}
                        isLiked={likedIdSet.has(char.id)}
                        canEdit={isOwnedByRequester(char.creatorId, {
                          userUid: user?.uid,
                          guestId,
                        })}
                        onLikeToggle={handleLikeToggle}
                        onSelectCharacter={handleSelectCharacterToChat}
                        onQuickView={handleQuickViewCharacter}
                        onEditCharacter={handleStartEditCharacter}
                        onDeleteCharacter={handleDeleteCharacter}
                      />
                    </ViewportSlot>
                  ))}
                </div>

                {activeTab === 'explore' && hasMoreChars && (
                  <div ref={charSentinelRef} className="flex justify-center pt-4 pb-2">
                    <button
                      type="button"
                      onClick={() => fetchCharacters(charNextOffsetRef.current, true)}
                      disabled={loadingMoreChars}
                      className="rounded-xl border border-purple-500/40 bg-zinc-900/90 px-5 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900/40 transition-all"
                    >
                      {loadingMoreChars ? 'Loading more characters...' : 'Load More Characters'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Persona Configuration Modal */}
      <PersonaModal
        isOpen={isPersonaModalOpen}
        initialEditPersona={editingPersona}
        pendingLorebook={pendingPersonaLorebook}
        onConsumePendingLorebook={() => setPendingPersonaLorebook(null)}
        onPersonasChanged={() => setPersonasRefreshKey((k) => k + 1)}
        onClose={() => {
          setIsPersonaModalOpen(false);
          setEditingPersona(null);
          setPendingPersonaLorebook(null);
        }}
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

      {/* Free .com Domain Port & Google Search SEO Portal */}
      <DomainSeoModal
        isOpen={isDomainSeoOpen}
        onClose={() => setIsDomainSeoOpen(false)}
      />

      {/* PWA Offline Status Banner */}
      <OfflineIndicator />
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
