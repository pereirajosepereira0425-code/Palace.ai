import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  MessageSquare,
  PlusCircle,
  User,
  Heart,
  Search,
  LogIn,
  LogOut,
  BrainCircuit,
  Volume2,
  Compass,
  Shield,
  ShieldAlert,
  Image as ImageIcon,
  BookOpen,
  Palette,
  Sliders,
  Users,
  Globe,
  MonitorSmartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import {
  loadSavedViewportWidth,
  parseCustomViewportWidth,
  saveViewportWidth,
} from '../utils/viewportWidth.ts';

export type PalaceNavTab =
  | 'explore'
  | 'chats'
  | 'studio'
  | 'ai_maker'
  | 'imagine'
  | 'lorebooks'
  | 'stages'
  | 'personas'
  | 'favorites'
  | 'profile';

interface NavbarProps {
  activeTab: PalaceNavTab;
  setActiveTab: (tab: PalaceNavTab) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  ratingFilter: 'ALL' | 'SFW' | 'NSFW' | 'NSFL' | 'NSFW + NSFL';
  setRatingFilter: (r: 'ALL' | 'SFW' | 'NSFW' | 'NSFL' | 'NSFW + NSFL') => void;
  onOpenPersonaModal: () => void;
  onOpenPresetsModal: () => void;
  onOpenProfileModal: () => void;
  onOpenDomainSeoModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  ratingFilter,
  setRatingFilter,
  onOpenPersonaModal,
  onOpenPresetsModal,
  onOpenProfileModal,
  onOpenDomainSeoModal,
}) => {
  const { user, profile, signInWithGoogle, signOutUser, persona } = useAuth();
  const [isWidthOpen, setIsWidthOpen] = useState(false);
  const [activeWidth, setActiveWidth] = useState<number | null>(() => loadSavedViewportWidth());
  const [widthInput, setWidthInput] = useState<string>(() => {
    const saved = loadSavedViewportWidth();
    return saved ? String(saved) : '';
  });
  const widthPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onWidthUpdated = (e: any) => {
      const next = e?.detail?.width ?? loadSavedViewportWidth();
      setActiveWidth(next);
      setWidthInput(next ? String(next) : '');
    };
    window.addEventListener('palace-viewport-width-updated', onWidthUpdated);
    return () => window.removeEventListener('palace-viewport-width-updated', onWidthUpdated);
  }, []);

  useEffect(() => {
    if (!isWidthOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (widthPopoverRef.current && !widthPopoverRef.current.contains(e.target as Node)) {
        setIsWidthOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isWidthOpen]);

  const applyCustomWidth = (override?: number | null) => {
    const next = override === null ? null : parseCustomViewportWidth(override ?? widthInput);
    const saved = saveViewportWidth(next);
    setActiveWidth(saved);
    setWidthInput(saved ? String(saved) : '');
  };

  return (
    <header className="sticky top-0 z-40 w-full max-w-full border-b border-purple-900/40 bg-zinc-950/85 backdrop-blur-xl transition-all">
      <div className="mx-auto flex flex-wrap md:flex-nowrap min-h-14 md:h-16 max-w-[1440px] items-center justify-between gap-x-2 gap-y-1 px-2.5 sm:px-5 py-1.5 md:py-0">
        {/* Brand / Logo */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('explore')}
            className="group flex items-center gap-1.5 sm:gap-2 text-left focus:outline-none cursor-pointer"
            aria-label="Palace.ai Home"
          >
            <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-500 via-amber-500 to-purple-600 p-0.5 shadow-lg shadow-orange-500/25 transition-transform group-hover:scale-105">
              <img
                src="/assets/aistudio/Screenshot_20261115_142839_Chrome_45bd0e27.jpg"
                alt="Palace.ai Logo"
                className="h-full w-full rounded-[9px] object-cover"
              />
            </div>
            <div className="hidden min-[350px]:block">
              <div className="flex items-center gap-1">
                <span className="bg-gradient-to-r from-purple-300 via-fuchsia-200 to-amber-200 bg-clip-text text-sm sm:text-lg font-black tracking-tight text-transparent">
                  palace<span className="text-amber-400">.ai</span>
                </span>
                <span className="hidden 2xl:inline rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300 border border-purple-500/30">
                  HUB
                </span>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 hidden 2xl:block">
                Chub &bull; Janitor &bull; SpicyChat Hub
              </p>
            </div>
          </button>

          {/* Quick Search on Desktop */}
          <div className="relative ml-1 hidden 2xl:block w-44">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bots..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-1.5 pl-7 pr-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs (Chub.ai Suite) */}
        <nav className="order-last md:order-none w-full md:w-auto md:flex-1 min-w-0 flex items-center justify-start gap-0.5 overflow-x-auto no-scrollbar py-1 border-t border-zinc-900/80 md:border-t-0">
          <button
            onClick={() => setActiveTab('explore')}
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-semibold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === 'explore'
                ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="Explore Palace Characters"
          >
            <Compass className="h-3.5 w-3.5 text-purple-400 shrink-0" />
            <span className="hidden lg:inline">Explore</span>
          </button>

          <button
            onClick={() => setActiveTab('chats')}
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-semibold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === 'chats'
                ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="My Chat Sessions"
          >
            <MessageSquare className="h-3.5 w-3.5 text-fuchsia-400 shrink-0" />
            <span className="hidden lg:inline">Chats</span>
          </button>

          <button
            onClick={() => setActiveTab('studio')}
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-semibold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === 'studio'
                ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="Create Character (/create_character)"
          >
            <PlusCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="hidden lg:inline">Create</span>
          </button>

          <button
            onClick={() => setActiveTab('ai_maker')}
            data-testid="nav-ai-maker-btn"
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-semibold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === 'ai_maker'
                ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="AI Character Maker & Web Researcher (/ai-maker)"
          >
            <BrainCircuit className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="hidden lg:inline">AI Maker</span>
          </button>

          <button
            onClick={() => setActiveTab('imagine')}
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-semibold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === 'imagine'
                ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="Imagine Studio (/imagine)"
          >
            <ImageIcon className="h-3.5 w-3.5 text-pink-400 shrink-0" />
            <span className="hidden lg:inline">Imagine</span>
          </button>

          <button
            onClick={() => setActiveTab('lorebooks')}
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-semibold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === 'lorebooks'
                ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="Lorebook Creator (/create_lorebook)"
          >
            <BookOpen className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="hidden lg:inline">Lore</span>
          </button>

          <button
            onClick={() => setActiveTab('stages')}
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-semibold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === 'stages'
                ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="Atmospheric Stages (/my_stages)"
          >
            <Palette className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <span className="hidden lg:inline">Stages</span>
          </button>

          <button
            onClick={() => setActiveTab('personas')}
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-semibold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === 'personas'
                ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="Community Shared Personas"
          >
            <Users className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="hidden lg:inline">Personas</span>
          </button>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-semibold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === 'favorites'
                ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="Liked Favorites"
          >
            <Heart className="h-3.5 w-3.5 text-rose-400 shrink-0" />
            <span className="hidden xl:inline">Liked</span>
          </button>

        </nav>

        {/* Right action area: Rating, Presets, Persona & Auth */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Rating filter dropdown (All / SFW / NSFW / NSFL / NSFW + NSFL) */}
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value as any)}
            className="hidden sm:block rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-[11px] font-bold text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer"
            aria-label="Filter by content rating"
          >
            <option value="ALL">ALL</option>
            <option value="SFW">SFW</option>
            <option value="NSFW">NSFW</option>
            <option value="NSFL">NSFL</option>
            <option value="NSFW + NSFL">NSFW+NSFL</option>
          </select>
          {/* Free .com Domain & Google Search SEO Portal */}
          <button
            type="button"
            onClick={onOpenDomainSeoModal}
            data-testid="open-domain-seo-btn"
            className="flex items-center gap-1 rounded-xl border border-cyan-500/40 bg-cyan-950/35 px-2 py-1.5 text-xs font-semibold text-cyan-200 hover:border-cyan-400 hover:bg-cyan-900/40 transition-all cursor-pointer shrink-0 whitespace-nowrap"
            title="Port Palace.ai to a Free .com Domain & Google Search SEO"
            aria-label="Open .com Web Domain & Google Search Portal"
          >
            <Globe className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="hidden xl:inline">.com</span>
          </button>

          {/* Developer Mode Website Width Control */}
          <div className="relative" ref={widthPopoverRef}>
            <button
              type="button"
              onClick={() => setIsWidthOpen((prev) => !prev)}
              data-testid="navbar-width-btn"
              className={`flex items-center gap-1 rounded-xl border px-1.5 sm:px-2 py-1.5 text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                activeWidth
                  ? 'border-cyan-400 bg-cyan-600/25 text-cyan-100'
                  : 'border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:border-cyan-500/50 hover:bg-zinc-800'
              }`}
              title="Developer Mode: Change Website Width (Smallest width / dp)"
              aria-label="Developer Website Width"
              aria-expanded={isWidthOpen}
            >
              <MonitorSmartphone className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="font-mono text-[10px] sm:text-[11px]">
                {activeWidth ? `${activeWidth}dp` : 'Width'}
              </span>
            </button>

            {isWidthOpen && (
              <div
                data-testid="navbar-width-popover"
                className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-full sm:mt-2 z-50 w-72 rounded-2xl border border-cyan-500/40 bg-zinc-950/95 p-3.5 shadow-2xl backdrop-blur-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                    <MonitorSmartphone className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Website Width (dp)</span>
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400">
                    {activeWidth ? `${activeWidth}px` : 'Auto'}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Enter any width &ge; 240 (no upper limit) like Android Developer Smallest Width.
                </p>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: 'Auto', val: null },
                    { label: '390', val: 390 },
                    { label: '768', val: 768 },
                    { label: '1280', val: 1280 },
                    { label: '1440', val: 1440 },
                    { label: '2400', val: 2400 },
                    { label: '3840', val: 3840 },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => applyCustomWidth(chip.val)}
                      className={`rounded-lg border px-2 py-0.5 text-[10px] font-mono cursor-pointer ${
                        activeWidth === chip.val
                          ? 'border-cyan-400 bg-cyan-600/35 text-white font-bold'
                          : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-cyan-500/50'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={240}
                    step={10}
                    value={widthInput}
                    onChange={(e) => setWidthInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyCustomWidth();
                      }
                    }}
                    placeholder="e.g. 2400, 4800..."
                    data-testid="custom-width-input"
                    className="flex-1 min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-mono text-zinc-100 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => applyCustomWidth()}
                    data-testid="apply-custom-width-btn"
                    className="rounded-xl bg-cyan-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 cursor-pointer"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => applyCustomWidth(null)}
                    data-testid="reset-custom-width-btn"
                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Download Palace.ai as PWA App & Updater */}
          <PWAInstallButton onOpenDomainSeoModal={onOpenDomainSeoModal} />

          {/* Presets Modal Button (/my_presets) */}
          <button
            onClick={onOpenPresetsModal}
            className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 text-xs text-zinc-300 hover:border-purple-500/50 hover:bg-zinc-800 transition-all cursor-pointer"
            title="Configure Generation & Chub API Presets (/my_presets)"
            aria-label="Presets"
          >
            <Sliders className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden 2xl:inline font-semibold">Presets</span>
          </button>

          {/* Active Persona Chip */}
          <button
            onClick={onOpenPersonaModal}
            className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 px-1.5 sm:px-2 py-1.5 text-xs text-zinc-300 hover:border-purple-500/50 hover:bg-zinc-800 transition-all cursor-pointer"
            title="Edit your Active Persona"
            aria-label={`Active Persona: ${persona.name}`}
          >
            <User className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="hidden sm:inline max-w-[84px] xl:max-w-[110px] truncate font-medium">
              {persona.name}
            </span>
          </button>

          {/* User Sign In / Profile */}
          {user ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 rounded-xl border p-1 transition-all cursor-pointer ${
                  activeTab === 'profile'
                    ? 'border-purple-400 bg-purple-600/30 ring-1 ring-purple-400'
                    : 'border-purple-500/30 bg-purple-950/30 hover:border-purple-400'
                }`}
                title={`View Profile (@${profile?.username || user.displayName || 'user'})`}
              >
                {profile?.avatarUrl || user.photoURL ? (
                  <img
                    src={profile?.avatarUrl || user.photoURL || ''}
                    alt={profile?.displayName || user.displayName || 'User'}
                    className="h-7 w-7 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-xs font-bold text-white">
                    {user.displayName?.[0] || user.email?.[0] || 'U'}
                  </div>
                )}
                <span className="hidden md:inline text-xs font-bold text-purple-200 pr-1 max-w-[80px] truncate">
                  @{profile?.username || 'profile'}
                </span>
              </button>
              <button
                onClick={signOutUser}
                className="hidden sm:flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-400 hover:text-red-400 hover:border-red-900 transition-all cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-1.5 rounded-xl border px-2 py-1 transition-all cursor-pointer ${
                  activeTab === 'profile'
                    ? 'border-purple-400 bg-purple-600/30 ring-1 ring-purple-400 text-purple-100'
                    : 'border-purple-500/30 bg-purple-950/30 text-purple-200 hover:border-purple-400'
                }`}
                title="View & Customize Your Profile"
                aria-label="Profile"
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName || 'Profile'}
                    className="h-6 w-6 rounded-lg object-cover"
                  />
                ) : (
                  <User className="h-3.5 w-3.5 text-purple-300" />
                )}
                <span className="hidden 2xl:inline text-xs font-bold max-w-[56px] truncate">
                  {profile?.displayName || 'Profile'}
                </span>
              </button>
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-purple-900/30 hover:from-purple-500 hover:to-fuchsia-500 transition-all cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
