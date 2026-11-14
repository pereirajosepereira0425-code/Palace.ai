import React from 'react';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export type PalaceNavTab =
  | 'explore'
  | 'chats'
  | 'studio'
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
}) => {
  const { user, profile, signInWithGoogle, signOutUser, persona } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-purple-900/40 bg-zinc-950/85 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-2 px-3 sm:px-5">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('explore')}
            className="group flex items-center gap-2 text-left focus:outline-none cursor-pointer"
            aria-label="Palace.ai Home"
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-amber-400 p-0.5 shadow-lg shadow-purple-500/25 transition-transform group-hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-[9px] bg-zinc-950 text-lg">
                👑
              </div>
            </div>
            <div className="hidden min-[380px]:block">
              <div className="flex items-center gap-1">
                <span className="bg-gradient-to-r from-purple-300 via-fuchsia-200 to-amber-200 bg-clip-text text-base sm:text-lg font-black tracking-tight text-transparent">
                  palace<span className="text-amber-400">.ai</span>
                </span>
                <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300 border border-purple-500/30">
                  HUB
                </span>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 hidden 2xl:block">
                Chub &bull; Janitor &bull; SpicyChat Hub
              </p>
            </div>
          </button>

          {/* Quick Search on Desktop */}
          <div className="relative ml-1 hidden md:block w-24 xl:w-28">
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
        <nav className="flex flex-1 min-w-0 items-center justify-start gap-0.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setActiveTab('explore')}
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] xl:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
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
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] xl:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
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
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] xl:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
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
            onClick={() => setActiveTab('imagine')}
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] xl:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
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
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] xl:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
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
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] xl:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
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
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] xl:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
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
            className={`flex items-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] xl:text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === 'favorites'
                ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="Liked Favorites"
          >
            <Heart className="h-3.5 w-3.5 text-rose-400 shrink-0" />
            <span className="hidden lg:inline">Liked</span>
          </button>

        </nav>

        {/* Right action area: Rating, Presets, Persona & Auth */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
          {/* Presets Modal Button (/my_presets) */}
          <button
            onClick={onOpenPresetsModal}
            className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-purple-500/50 hover:bg-zinc-800 transition-all"
            title="Configure Generation & Chub API Presets (/my_presets)"
          >
            <Sliders className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden sm:inline font-semibold">Presets</span>
          </button>

          {/* Active Persona Chip */}
          <button
            onClick={onOpenPersonaModal}
            className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 text-xs text-zinc-300 hover:border-purple-500/50 hover:bg-zinc-800 transition-all"
            title="Edit your Active Persona"
          >
            <User className="h-3.5 w-3.5 text-amber-400" />
            <span className="max-w-[60px] xl:max-w-[76px] truncate font-medium">
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
                <span className="hidden md:inline text-xs font-bold max-w-[68px] truncate">
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
