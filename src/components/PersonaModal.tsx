import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Sparkles,
  Check,
  Save,
  Plus,
  Trash2,
  Edit3,
  Upload,
  BookOpen,
  MessageSquare,
  Shield,
  Layers,
  Box,
  Eye,
  Tag,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { SharedPersona } from '../types/index.ts';
import { WikiEditor } from './WikiEditor.tsx';
import { ThreeAvatarViewer } from './ThreeAvatarViewer.tsx';
import { TagInput } from './TagInput.tsx';

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEditPersona?: SharedPersona | null;
  onPersonasChanged?: () => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
];

export const PersonaModal: React.FC<PersonaModalProps> = ({
  isOpen,
  onClose,
  initialEditPersona,
  onPersonasChanged,
}) => {
  const { persona: activePersona, setPersona, savePersonaToCloud, guestId, user, getIdToken } = useAuth();

  // Mode: 'list' (manage multiple personas) or 'edit' (create / modify full persona)
  const [viewMode, setViewMode] = useState<'list' | 'edit'>('list');
  const [userPersonas, setUserPersonas] = useState<SharedPersona[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [confirmDeleteUuid, setConfirmDeleteUuid] = useState<string | null>(null);

  // Full Persona Fields (Exact mirror of bot fields)
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_PRESETS[0]);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('Non-Binary');
  const [customGender, setCustomGender] = useState('');
  const [pronouns, setPronouns] = useState('They/Them');
  const [customPronouns, setCustomPronouns] = useState('');
  const [description, setDescription] = useState('');
  const [personality, setPersonality] = useState('');
  const [greeting, setGreeting] = useState('');
  const [alternateGreetings, setAlternateGreetings] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [postHistoryInstructions, setPostHistoryInstructions] = useState('');
  const [scenario, setScenario] = useState('');
  const [exampleDialogues, setExampleDialogues] = useState('');
  const [creatorNotes, setCreatorNotes] = useState('');
  const [loreEntries, setLoreEntries] = useState<Array<{ key: string; content: string }>>([]);
  const [model3dUrl, setModel3dUrl] = useState('');
  const [model3dPose, setModel3dPose] = useState('neutral');
  const [isPublic, setIsPublic] = useState(false);
  const [tags, setTags] = useState<string[]>(['Persona']);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch all personas belonging to current user or guest
  const fetchMyPersonas = async () => {
    try {
      setLoadingPersonas(true);
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/personas/me?guestId=${guestId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUserPersonas(data.personas || []);
      }
    } catch (err) {
      console.error('Failed to load personas:', err);
    } finally {
      setLoadingPersonas(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMyPersonas();
      if (initialEditPersona) {
        handleStartEdit(initialEditPersona);
      } else {
        setViewMode('list');
      }
    }
  }, [isOpen, user, initialEditPersona]);

  if (!isOpen) return null;

  // File Upload converting ANY file to base64 Data URL
  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleBannerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setBackgroundImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handle3DModelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setModel3dUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleStartCreateNew = () => {
    setEditingUuid(null);
    setName('');
    setDisplayName('');
    setAvatar(AVATAR_PRESETS[0]);
    setBackgroundImage('');
    setBio('');
    setGender('Non-Binary');
    setCustomGender('');
    setPronouns('They/Them');
    setCustomPronouns('');
    setDescription('');
    setPersonality('');
    setGreeting('');
    setAlternateGreetings([]);
    setSystemPrompt('');
    setPostHistoryInstructions('');
    setScenario('');
    setExampleDialogues('');
    setCreatorNotes('');
    setLoreEntries([]);
    setModel3dUrl('');
    setModel3dPose('neutral');
    setIsPublic(false);
    setTags(['Persona']);
    setViewMode('edit');
  };

  const handleStartEdit = (p: SharedPersona) => {
    setEditingUuid(p.uuid);
    setName(p.name);
    setDisplayName(p.displayName || p.name);
    setAvatar(p.avatar);
    setBackgroundImage(p.backgroundImage || '');
    setBio(p.bio);
    setGender(p.gender || 'Non-Binary');
    setPronouns(p.pronouns || 'They/Them');
    setDescription(p.description || p.bio);
    setPersonality(p.personality || '');
    setGreeting(p.greeting || '');

    try {
      setAlternateGreetings(
        typeof p.alternateGreetings === 'string'
          ? JSON.parse(p.alternateGreetings)
          : p.alternateGreetings || []
      );
    } catch {
      setAlternateGreetings([]);
    }

    setSystemPrompt(p.systemPrompt || '');
    setPostHistoryInstructions(p.postHistoryInstructions || '');
    setScenario(p.scenario || '');
    setExampleDialogues(p.exampleDialogues || '');
    setCreatorNotes(p.creatorNotes || '');

    try {
      setLoreEntries(typeof p.lorebook === 'string' ? JSON.parse(p.lorebook) : p.lorebook || []);
    } catch {
      setLoreEntries([]);
    }

    setModel3dUrl(p.model3dUrl || '');
    setModel3dPose(p.model3dPose || 'neutral');
    setIsPublic(Boolean(p.isPublic));

    try {
      setTags(typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags || ['Persona']);
    } catch {
      setTags(['Persona']);
    }

    setViewMode('edit');
  };

  const handleSelectActivePersona = (p: SharedPersona) => {
    setPersona({ name: p.name, bio: p.bio });
    savePersonaToCloud(p.name, p.bio);
    setSuccessMsg(`Switched active persona to "${p.name}"!`);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleDeletePersona = async (uuid: string) => {
    if (confirmDeleteUuid !== uuid) {
      setConfirmDeleteUuid(uuid);
      setTimeout(() => setConfirmDeleteUuid((curr) => (curr === uuid ? null : curr)), 3500);
      return;
    }
    setConfirmDeleteUuid(null);
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/personas/${uuid}?guestId=${encodeURIComponent(guestId)}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        setUserPersonas((prev) => prev.filter((p) => p.uuid !== uuid));
        onPersonasChanged?.();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePersonaForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Persona Name is required!');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');

      const effectivePronouns = pronouns === 'Custom' ? customPronouns || 'They/Them' : pronouns;
      const effectiveGender = gender === 'Custom' ? customGender || 'Non-Binary' : gender;

      const payload = {
        guestId,
        name: name.trim(),
        displayName: displayName.trim() || name.trim(),
        avatar,
        backgroundImage,
        bio: bio.trim() || `${name} - An enigmatic roleplay persona.`,
        gender: effectiveGender,
        pronouns: effectivePronouns,
        description: description.trim() || bio.trim(),
        personality: personality.trim(),
        greeting: greeting.trim(),
        alternateGreetings,
        systemPrompt: systemPrompt.trim(),
        postHistoryInstructions: postHistoryInstructions.trim(),
        scenario: scenario.trim(),
        exampleDialogues: exampleDialogues.trim(),
        creatorNotes: creatorNotes.trim(),
        lorebook: loreEntries,
        model3dUrl,
        model3dPose,
        isPublic,
        tags,
      };

      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res;
      if (editingUuid) {
        res = await fetch(`/api/personas/${editingUuid}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/personas', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save persona');
      }

      // Automatically set as active persona
      setPersona({ name: name.trim(), bio: payload.bio });
      savePersonaToCloud(name.trim(), payload.bio);

      await fetchMyPersonas();
      onPersonasChanged?.();
      setViewMode('list');
      setSuccessMsg(`Persona "${name}" saved and set to active!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
      <div className="relative flex flex-col h-[90vh] w-full max-w-4xl rounded-3xl border border-purple-500/40 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-purple-900/40 px-6 py-4 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-600/20 p-2 border border-purple-500/30">
              <User className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Roleplay Personas &bull; Chub Studio</span>
                <span className="rounded-md bg-purple-900/60 border border-purple-500/30 px-2 py-0.5 text-[10px] text-purple-300 font-mono">
                  Active: {activePersona.name}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Create multiple roleplay identities with full bot specs, 3D poses &amp; wiki descriptions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'edit' ? (
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white"
              >
                Back to My Personas
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartCreateNew}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-purple-500 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Persona</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div className="mx-6 mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs font-semibold text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <Check className="h-4 w-4" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mt-4 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs font-semibold text-rose-300 flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="h-4 w-4" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ======================= VIEW MODE 1: PERSONAS LIST ======================= */}
        {viewMode === 'list' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Active Highlight Card */}
            <div className="rounded-3xl border border-amber-500/40 bg-gradient-to-r from-amber-950/20 via-zinc-900/60 to-purple-950/20 p-5 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xl font-bold">
                  👑
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Currently Selected Active Persona
                  </div>
                  <h3 className="text-base font-black text-white">{activePersona.name}</h3>
                  <p className="text-xs text-zinc-300 line-clamp-1 italic">{activePersona.bio}</p>
                </div>
              </div>

              <span className="rounded-xl bg-emerald-950/60 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-300 self-start sm:self-auto">
                ✓ Ready for Chat
              </span>
            </div>

            {/* List of Multiple Personas */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  Your Personas ({userPersonas.length})
                </h3>
                <span className="text-xs text-zinc-400">Click &quot;Use Persona&quot; to switch</span>
              </div>

              {loadingPersonas ? (
                <div className="flex h-48 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                </div>
              ) : userPersonas.length === 0 ? (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-3">
                  <User className="h-10 w-10 text-purple-400 mx-auto opacity-50" />
                  <p className="text-xs text-zinc-400">
                    You haven&apos;t created any dedicated personas yet. Click below to craft your first full persona!
                  </p>
                  <button
                    onClick={handleStartCreateNew}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-500 cursor-pointer"
                  >
                    + Create Persona
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userPersonas.map((p) => {
                    const isActive = activePersona.name === p.name;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                          isActive
                            ? 'border-amber-500/50 bg-amber-950/15 shadow-md'
                            : 'border-zinc-800 bg-zinc-900/60 hover:border-purple-500/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-start gap-3 mb-2.5">
                            <img
                              src={p.avatar}
                              alt={p.name}
                              className="h-12 w-12 rounded-xl object-cover border border-purple-500/40 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300">
                                  {p.pronouns}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                Gender: <strong className="text-zinc-200">{p.gender || 'Unknown'}</strong>
                              </div>
                            </div>
                          </div>

                          <p className="text-xs text-zinc-300 line-clamp-2 italic bg-zinc-950/50 p-2 rounded-xl border border-zinc-800/60 mb-3">
                            &quot;{p.bio}&quot;
                          </p>
                        </div>

                        {/* Card Controls */}
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(p)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-500/40 bg-amber-500/15 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30 transition-all"
                              title="Edit Persona"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePersona(p.uuid)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                confirmDeleteUuid === p.uuid
                                  ? 'border-rose-500 bg-rose-600 text-white'
                                  : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                              }`}
                              title={confirmDeleteUuid === p.uuid ? 'Click again to delete persona' : 'Delete Persona'}
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>{confirmDeleteUuid === p.uuid ? 'Confirm' : 'Delete'}</span>
                            </button>
                          </div>

                          <button
                            onClick={() => handleSelectActivePersona(p)}
                            className={`flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition-all ${
                              isActive
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-purple-600 text-white hover:bg-purple-500 shadow-sm'
                            }`}
                          >
                            {isActive ? <Check className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                            <span>{isActive ? 'Active' : 'Use Persona'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================= VIEW MODE 2: FULL EDIT PERSONA ======================= */}
        {viewMode === 'edit' && (
          <form onSubmit={handleSavePersonaForm} className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Core Identity Grid: Avatar, 3D Preview, Name, Pronouns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-5 backdrop-blur-md">
              {/* Left Column: Avatar & 3D Model Avatar Viewer */}
              <div className="flex flex-col items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
                  Persona Avatar &amp; 3D Model
                </label>

                {/* 2D / 3D Avatar Box */}
                <div className="relative aspect-[3/4] w-36 overflow-hidden rounded-2xl border-2 border-purple-500/60 shadow-lg mb-2.5 bg-zinc-900">
                  {model3dUrl ? (
                    <ThreeAvatarViewer
                      characterName={name || 'Persona'}
                      avatarUrl={avatar}
                      currentPose={model3dPose}
                      className="h-full w-full"
                    />
                  ) : (
                    <>
                      <img
                        src={avatar}
                        alt=""
                        aria-hidden="true"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full object-cover blur-xl scale-110 opacity-35 pointer-events-none"
                      />
                      <img
                        src={avatar}
                        alt="Avatar"
                        referrerPolicy="no-referrer"
                        className="relative z-10 h-full w-full object-contain"
                      />
                    </>
                  )}

                  {/* Upload button over image */}
                  <label className="absolute bottom-2 right-2 rounded-xl bg-black/70 border border-white/20 p-1.5 text-white hover:bg-black/90 cursor-pointer backdrop-blur-md shadow-md">
                    <Upload className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      accept="*/*"
                      onChange={handleAvatarFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Presets */}
                <div className="flex gap-1 mb-2">
                  {AVATAR_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAvatar(p)}
                      className={`h-6 w-6 rounded-md overflow-hidden border ${
                        avatar === p ? 'border-purple-400' : 'border-zinc-800 opacity-60'
                      }`}
                    >
                      <img src={p} alt="Preset" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>

                <input
                  type="url"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="Or paste image URL..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-purple-500"
                />

                {/* 3D Model URL & Pose Selector */}
                <div className="w-full mt-3 pt-3 border-t border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-300">
                    <span className="flex items-center gap-1">
                      <Box className="h-3 w-3 text-purple-400" />
                      3D Model URL / File
                    </span>
                    <label className="text-[10px] text-purple-400 hover:underline cursor-pointer">
                      Upload
                      <input
                        type="file"
                        accept="*/*"
                        onChange={handle3DModelFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={model3dUrl}
                    onChange={(e) => setModel3dUrl(e.target.value)}
                    placeholder="URL to 3D asset or leave blank for 3D procedural"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-300 focus:outline-none"
                  />

                  <div className="text-[10px] font-semibold text-zinc-400 pt-1">Default 3D Pose:</div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['neutral', 'combat', 'spellcasting', 'inquisitive', 'relaxed'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setModel3dPose(p)}
                        className={`rounded-lg py-0.5 text-[10px] font-bold capitalize transition-all border ${
                          model3dPose === p
                            ? 'border-purple-400 bg-purple-600/30 text-white'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Names, Gender, Pronouns, Tagline */}
              <div className="md:col-span-2 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                      Persona Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Kaelen, Lyra, Lord Victor"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="How you are greeted in dialogue"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Gender & Pronouns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                      Pronouns
                    </label>
                    <div className="grid grid-cols-3 gap-1 mb-1.5">
                      {['They/Them', 'He/Him', 'She/Her', 'It/Its', 'Any', 'Custom'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPronouns(p)}
                          className={`rounded-lg py-1 text-xs font-semibold border ${
                            pronouns === p
                              ? 'border-purple-500 bg-purple-600/30 text-purple-200'
                              : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    {pronouns === 'Custom' && (
                      <input
                        type="text"
                        value={customPronouns}
                        onChange={(e) => setCustomPronouns(e.target.value)}
                        placeholder="Custom pronouns (e.g. Fae/Faer)..."
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-white"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                      Gender
                    </label>
                    <div className="grid grid-cols-3 gap-1 mb-1.5">
                      {['Non-Binary', 'Female', 'Male', 'Agender', 'Custom'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          className={`rounded-lg py-1 text-xs font-semibold border ${
                            gender === g
                              ? 'border-purple-500 bg-purple-600/30 text-purple-200'
                              : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    {gender === 'Custom' && (
                      <input
                        type="text"
                        value={customGender}
                        onChange={(e) => setCustomGender(e.target.value)}
                        placeholder="Custom gender..."
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-white"
                      />
                    )}
                  </div>
                </div>

                {/* Short Bio */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    Quick Bio / Appearance Summary
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Short summary injected as {{user}} definition into roleplay prompt..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-200 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                {/* Public Sharing Toggle */}
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-300">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500"
                    />
                    <span>Make this persona Public in the Community Persona Gallery</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Description & Appearance with Wiki Editor */}
            <div className="space-y-1">
              <WikiEditor
                label="Full Description & Backstory (Wiki Markup / Infobox)"
                description="Physical traits, detailed attire, psychological quirks, powers, and backstory."
                placeholder="24 years old, standing 6'1 with obsidian armor and silver-trimmed velvet..."
                value={description}
                onChange={setDescription}
                rows={5}
                characterName={name || 'Persona'}
              />
            </div>

            {/* Personality & Scenario */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <WikiEditor
                label="Personality & Mannerisms"
                description="Behavioral style, dialogue tone, moral compass."
                placeholder="Calculated, dry sense of humor, deeply protective of allies..."
                value={personality}
                onChange={setPersonality}
                rows={4}
                characterName={name || 'Persona'}
              />

              <WikiEditor
                label="Scenario & Context"
                description="Your persona's default world or role in the conversation."
                placeholder="A wanderer seeking ancient artifacts in the subterranean ruins..."
                value={scenario}
                onChange={setScenario}
                rows={4}
                characterName={name || 'Persona'}
              />
            </div>

            {/* First Message & Example Dialogues */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <WikiEditor
                label="Opening Greeting / First Line (Optional)"
                description="Sample dialogue or opening stance when your persona speaks first."
                placeholder="*Steps forward from the shadows, hands resting on my hilt.* We meet at last."
                value={greeting}
                onChange={setGreeting}
                rows={4}
                characterName={name || 'Persona'}
              />

              <WikiEditor
                label="Example Dialogues (<START> format)"
                description="Sample interactions showing the AI how your persona speaks."
                placeholder={'<START>\n{{user}}: *glances over* "Are you ready?"\n{{char}}: *nods firmly* "Always."'}
                value={exampleDialogues}
                onChange={setExampleDialogues}
                rows={4}
                characterName={name || 'Persona'}
              />
            </div>

            {/* Post-History Instructions & System Prompt */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
                  Custom System Prompt Directives
                </label>
                <textarea
                  rows={3}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Extra instructions for how the bot should perceive and treat your persona..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-200 focus:outline-none"
                />
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
                  Post-History Depth Instructions
                </label>
                <textarea
                  rows={3}
                  value={postHistoryInstructions}
                  onChange={(e) => setPostHistoryInstructions(e.target.value)}
                  placeholder="Jailbreak or formatting enforcer to ensure rich immersive prose..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-200 focus:outline-none"
                />
              </div>
            </div>

            {/* Chub Dynamic Free-Form Tags for Persona */}
            <TagInput
              selectedTags={tags}
              onChange={setTags}
              title="Persona Tags (Saved to Chub Tag DB)"
              subtitle="Add custom tags or choose existing Chub tags for your persona."
              guestId={guestId}
              compact
            />

            {/* Submit Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-900/40 hover:from-purple-500 hover:to-amber-400 disabled:opacity-50 transition-all cursor-pointer"
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{saving ? 'Saving Persona...' : editingUuid ? 'Update Persona' : 'Create & Activate Persona'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
