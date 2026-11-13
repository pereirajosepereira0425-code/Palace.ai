import React, { useState, useEffect } from 'react';
import {
  User,
  Heart,
  MessageSquare,
  Sparkles,
  Share2,
  Check,
  Copy,
  Globe,
  Tag,
  Shield,
  Edit3,
  Calendar,
  ExternalLink,
  Flame,
  ArrowLeft,
  Send,
  MessageCircle,
} from 'lucide-react';
import { UserProfile, Character, SharedPersona } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { CharacterCard } from './CharacterCard.tsx';
import { renderWikiMarkup } from '../utils/characterUtils.ts';

interface UserProfileViewProps {
  targetUsername?: string;
  onSelectCharacter: (char: Character) => void;
  onQuickViewCharacter?: (char: Character) => void;
  onOpenEditModal: () => void;
  onBack?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  targetUsername,
  onSelectCharacter,
  onQuickViewCharacter,
  onOpenEditModal,
  onBack,
}) => {
  const { user: authUser, profile: myProfile } = useAuth();

  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [createdBots, setCreatedBots] = useState<Character[]>([]);
  const [userPersonas, setUserPersonas] = useState<SharedPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bots' | 'personas' | 'about' | 'wall'>('bots');
  const [copiedLink, setCopiedLink] = useState(false);

  // Guestbook Wall state
  const [wallComments, setWallComments] = useState<Array<{ name: string; message: string; date: string }>>([
    {
      name: 'Foxy_poolBidd10101',
      message: 'Love your dark fantasy characters! Sylvia Thorne is incredible.',
      date: 'Yesterday at 4:20 PM',
    },
    {
      name: 'Anonymous_Writer',
      message: 'Best lorebook formatting on the Palace. Keep them coming!',
      date: '2 days ago',
    },
  ]);
  const [newComment, setNewComment] = useState('');

  const effectiveHandle = targetUsername || myProfile?.username || 'user';
  const isOwner = Boolean(
    authUser && (targetUsername === myProfile?.username || !targetUsername)
  );

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users/${encodeURIComponent(effectiveHandle)}`);
      if (res.ok) {
        const data = await res.json();
        setProfileData(data.user);
        setCreatedBots(data.createdBots || []);
        setUserPersonas(data.userPersonas || []);
      } else if (isOwner && myProfile) {
        setProfileData(myProfile);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      if (isOwner && myProfile) setProfileData(myProfile);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [effectiveHandle, myProfile]);

  const handleCopyProfileLink = () => {
    const url = `${window.location.origin}/users/${profileData?.username || effectiveHandle}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setWallComments((prev) => [
      {
        name: myProfile?.displayName || authUser?.displayName || 'Anonymous Guest',
        message: newComment.trim(),
        date: 'Just now',
      },
      ...prev,
    ]);
    setNewComment('');
  };

  if (loading && !profileData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="text-xs text-zinc-400">Loading Chub.ai Profile...</p>
        </div>
      </div>
    );
  }

  const p = profileData || myProfile;
  if (!p) return null;

  // Badges
  let badgesList: string[] = [];
  try {
    badgesList = typeof p.badges === 'string' ? JSON.parse(p.badges) : p.badges || [];
  } catch {
    badgesList = ['Chub Creator', 'Palace Explorer'];
  }

  // Social Links
  let socials: any = {};
  try {
    socials = typeof p.socialLinks === 'string' ? JSON.parse(p.socialLinks) : p.socialLinks || {};
  } catch {
    socials = {};
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-in fade-in duration-300 space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyProfileLink}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-purple-400" />}
            <span>{copiedLink ? 'Link Copied!' : 'Share Profile'}</span>
          </button>

          {isOwner && (
            <button
              onClick={onOpenEditModal}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-purple-900/40 hover:bg-purple-500 transition-all cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Profile Header Card (Chub biguswigus style) */}
      <div className="relative rounded-3xl overflow-hidden border border-purple-500/40 bg-zinc-950 shadow-2xl">
        {/* Banner Wallpaper */}
        <div className="relative h-56 sm:h-72 w-full bg-zinc-900 overflow-hidden">
          <img
            src={p.bannerUrl || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1600&q=80'}
            alt="Profile Banner"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        </div>

        {/* User Identity Row */}
        <div className="relative -mt-20 px-6 sm:px-10 pb-8 flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
            {/* Avatar */}
            <div className="relative h-32 w-32 sm:h-36 sm:w-36 rounded-3xl overflow-hidden border-4 border-purple-500 shadow-2xl bg-zinc-900 shrink-0">
              <img
                src={p.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'}
                alt={p.displayName}
                className="h-full w-full object-cover object-top"
              />
            </div>

            {/* Names & Taglines */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <h1 className="text-2xl sm:text-4xl font-black text-white">{p.displayName}</h1>
                <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-3 py-0.5 text-xs font-bold text-purple-300">
                  @{p.username || 'user'}
                </span>
              </div>

              {/* Pronouns, Gender & Status */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs font-medium text-zinc-400">
                <span className="text-purple-300 font-semibold">{p.pronouns || 'They/Them'}</span>
                <span>&bull;</span>
                <span className="text-amber-300 font-semibold">{p.gender || 'Unknown'}</span>
                {p.statusMessage && (
                  <>
                    <span>&bull;</span>
                    <span className="text-zinc-200 italic">&quot;{p.statusMessage}&quot;</span>
                  </>
                )}
              </div>

              {/* Badges Tray */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 pt-1">
                {badgesList.map((badge, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1 rounded-lg bg-purple-950/60 border border-purple-500/30 px-2.5 py-0.5 text-[11px] font-bold text-purple-200 shadow-sm"
                  >
                    <Sparkles className="h-3 w-3 text-amber-300" />
                    <span>{badge}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Social Links & Stats Quick Pills */}
          <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
            {/* Social Icons */}
            <div className="flex items-center gap-2">
              {socials.discord && (
                <span className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-semibold text-indigo-300 shadow-sm">
                  Discord: {socials.discord}
                </span>
              )}
              {socials.twitter && (
                <a
                  href={`https://twitter.com/${socials.twitter.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-zinc-900 border border-zinc-800 p-2 text-sky-400 hover:text-white transition-colors"
                  title="Twitter / X"
                >
                  <Globe className="h-4 w-4" />
                </a>
              )}
              {socials.website && (
                <a
                  href={socials.website}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-zinc-900 border border-zinc-800 p-2 text-purple-400 hover:text-white transition-colors"
                  title="Website / Portfolio"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-3 text-xs bg-zinc-900/90 border border-zinc-800 px-4 py-2 rounded-2xl backdrop-blur-md">
              <div className="text-center">
                <div className="font-bold text-white text-sm">{createdBots.length}</div>
                <div className="text-[10px] text-zinc-400 uppercase font-semibold">Bots</div>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div className="text-center">
                <div className="font-bold text-purple-300 text-sm">{userPersonas.length}</div>
                <div className="text-[10px] text-zinc-400 uppercase font-semibold">Personas</div>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div className="text-center">
                <div className="font-bold text-amber-300 text-sm">
                  {createdBots.reduce((acc, b) => acc + (b.chatCount || 0), 0)}
                </div>
                <div className="text-[10px] text-zinc-400 uppercase font-semibold">Chats</div>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Quote Callout Banner (if present) */}
        {p.featuredQuote && (
          <div className="mx-6 sm:mx-10 mb-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-center text-xs font-serif italic text-amber-200">
            &quot;{p.featuredQuote}&quot;
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-t border-zinc-800/80 bg-zinc-900/50 px-6 sm:px-10 py-3 overflow-x-auto no-scrollbar">
          {[
            { id: 'bots', label: `Characters (${createdBots.length})` },
            { id: 'personas', label: `Personas (${userPersonas.length})` },
            { id: 'about', label: 'About & Wiki Lore' },
            { id: 'wall', label: `Profile Wall (${wallComments.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'bots' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Characters created by <strong className="text-white">@{p.username}</strong></span>
          </div>

          {createdBots.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-400">
              <User className="h-10 w-10 text-purple-400 mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-bold text-white mb-1">No Characters Published Yet</h3>
              <p className="text-xs text-zinc-400">This user hasn&apos;t shared any public bots to the Palace yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {createdBots.map((char) => (
                <CharacterCard
                  key={char.id}
                  character={char}
                  onSelectCharacter={onSelectCharacter}
                  onQuickView={onQuickViewCharacter || onSelectCharacter}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'personas' && (
        <div className="space-y-4">
          {userPersonas.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-400">
              <User className="h-10 w-10 text-purple-400 mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-bold text-white mb-1">No Personas Shared</h3>
              <p className="text-xs text-zinc-400">No public roleplay personas have been published by this creator.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userPersonas.map((persona) => (
                <div key={persona.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={persona.avatar}
                      alt={persona.name}
                      className="h-12 w-12 rounded-xl object-cover border border-purple-500/40"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-white">{persona.name}</h4>
                      <div className="text-[11px] text-purple-300">{persona.pronouns}</div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 line-clamp-3 italic bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60">
                    &quot;{persona.bio}&quot;
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur-md space-y-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-3">
              About &bull; Creator Biography
            </h3>
            <div className="wiki-rendered-content text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap font-sans">
              {renderWikiMarkup(p.bio || 'No biography written yet.')}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'wall' && (
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur-md space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-purple-400" />
                <span>Profile Wall &amp; Guestbook</span>
              </h3>
              <p className="text-xs text-zinc-400">Leave a note or sign @{p.username}&apos;s profile</p>
            </div>
          </div>

          {/* Comment Form */}
          <form onSubmit={handlePostComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={`Write a public message on @${p.username}'s wall...`}
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-purple-500 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Sign Wall</span>
            </button>
          </form>

          {/* Wall Message Cards */}
          <div className="space-y-3">
            {wallComments.map((comment, idx) => (
              <div key={idx} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-300">{comment.name}</span>
                  <span className="text-[10px] text-zinc-500">{comment.date}</span>
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed">{comment.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
