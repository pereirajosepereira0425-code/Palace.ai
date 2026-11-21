import React, { useState } from 'react';
import {
  Upload,
  Sparkles,
  Volume2,
  BookOpen,
  BrainCircuit,
  Globe,
  Save,
  Download,
  Plus,
  Trash2,
  Check,
  Play,
  Square,
  Shield,
  HelpCircle,
  Link as LinkIcon,
  Image as ImageIcon,
  MessageSquare,
  FileText,
  AlertTriangle,
  Flame,
  Search,
  Box,
  Paperclip,
  File as FileIcon,
  Edit3,
  Heart,
  Layers,
  AudioWaveform,
  Mic,
} from 'lucide-react';
import {
  parseTavernCard,
  exportTavernCard,
  extractChubPngCard,
} from '../utils/characterUtils.ts';
import { Character, ContentRating, CustomVoiceRecord, SharedLorebookRecord } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { WikiEditor } from './WikiEditor.tsx';
import { ThreeAvatarViewer } from './ThreeAvatarViewer.tsx';
import { TagInput } from './TagInput.tsx';
import { ViewportSlot } from './ViewportSlot.tsx';
import { CustomVoiceStudioModal } from './CustomVoiceStudioModal.tsx';
import { mergeCharacterLoreEntries, parseLorebookEntries } from '../utils/communityUtils.ts';
import { playTTSResponseData, stopActiveTTSPlayback } from '../utils/ttsPlayer.ts';
import type { AiMakerDraft } from '../utils/aiMakerUtils.ts';

interface AttachedCharacterFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

interface CharacterStudioProps {
  onCharacterCreated: (character: Character) => void;
  onCharacterUpdated?: (character: Character) => void;
  onCharacterDeleted?: (uuid: string) => void;
  onCancel: () => void;
  forkFromCharacter?: Character | null;
  editingCharacter?: Character | null;
  pendingLorebook?: SharedLorebookRecord | null;
  onConsumePendingLorebook?: () => void;
  aiGeneratedDraft?: AiMakerDraft | null;
  onConsumeAiDraft?: () => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80',
];

const BACKGROUND_PRESETS = [
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80',
];

export const CharacterStudio: React.FC<CharacterStudioProps> = ({
  onCharacterCreated,
  onCharacterUpdated,
  onCharacterDeleted,
  onCancel,
  forkFromCharacter,
  editingCharacter,
  pendingLorebook,
  onConsumePendingLorebook,
  aiGeneratedDraft,
  onConsumeAiDraft,
}) => {
  const { user, profile, getIdToken, guestId } = useAuth();

  // Chub.ai Full Specification Fields
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_PRESETS[0]);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [rating, setRating] = useState<ContentRating>('SFW');
  const [greeting, setGreeting] = useState('');
  const [alternateGreetings, setAlternateGreetings] = useState<string[]>([]);
  const [personality, setPersonality] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [postHistoryInstructions, setPostHistoryInstructions] = useState('');
  const [creatorNotes, setCreatorNotes] = useState('');
  const [characterVersion, setCharacterVersion] = useState('1.0');
  const [scenario, setScenario] = useState('');
  const [exampleDialogues, setExampleDialogues] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Anime', 'RPG']);
  const [voiceName, setVoiceName] = useState('Puck');
  const [voiceStyle, setVoiceStyle] = useState('Expressive, natural character dialogue');
  const [customVoiceUuid, setCustomVoiceUuid] = useState<string>('');
  const [customVoices, setCustomVoices] = useState<CustomVoiceRecord[]>([]);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);
  const [thinkingDefault, setThinkingDefault] = useState(false);
  const [searchDefault, setSearchDefault] = useState(false);
  const [gender, setGender] = useState('Unknown');
  const [customGender, setCustomGender] = useState('');
  const [pronouns, setPronouns] = useState('They/Them');
  const [customPronouns, setCustomPronouns] = useState('');
  const [model3dUrl, setModel3dUrl] = useState('');
  const [model3dPose, setModel3dPose] = useState('neutral');
  const [loreEntries, setLoreEntries] = useState<Array<{ key: string; content: string }>>([]);
  const [attachedLoreNames, setAttachedLoreNames] = useState<string[]>([]);
  const [showLorePicker, setShowLorePicker] = useState<boolean>(true);
  const [lorePickerTab, setLorePickerTab] = useState<'community' | 'saved'>('community');
  const [communityLorebooks, setCommunityLorebooks] = useState<SharedLorebookRecord[]>([]);
  const [loadingLorebooks, setLoadingLorebooks] = useState(false);
  const [loreSearch, setLoreSearch] = useState('');
  const [loreAttachNotice, setLoreAttachNotice] = useState('');
  const [publishingLorebook, setPublishingLorebook] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedCharacterFile[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Pre-fill when Editing or Forking a character
  React.useEffect(() => {
    const sourceChar = editingCharacter || forkFromCharacter;
    if (!sourceChar) return;
    setName(editingCharacter ? sourceChar.name : `${sourceChar.name} (Fork)`);
    setTagline(sourceChar.tagline || '');
    setAvatar(sourceChar.avatar || AVATAR_PRESETS[0]);
    setBackgroundImage(sourceChar.backgroundImage || '');
    setRating(sourceChar.rating || 'SFW');
    setGreeting(sourceChar.greeting || '');
    try {
      const alts = typeof sourceChar.alternateGreetings === 'string'
        ? JSON.parse(sourceChar.alternateGreetings)
        : sourceChar.alternateGreetings;
      setAlternateGreetings(Array.isArray(alts) ? alts : []);
    } catch {
      setAlternateGreetings([]);
    }
    setPersonality(sourceChar.personality || '');
    setDescription(sourceChar.description || '');
    setSystemPrompt(sourceChar.systemPrompt || '');
    setPostHistoryInstructions(sourceChar.postHistoryInstructions || '');
    setCreatorNotes(
      editingCharacter
        ? sourceChar.creatorNotes || ''
        : sourceChar.creatorNotes || `Forked from ${sourceChar.name} by @${sourceChar.creatorName}`
    );
    setCharacterVersion(sourceChar.characterVersion || '1.0');
    setScenario(sourceChar.scenario || '');
    setExampleDialogues(sourceChar.exampleDialogues || '');
    try {
      const tags = typeof sourceChar.tags === 'string'
        ? JSON.parse(sourceChar.tags)
        : sourceChar.tags;
      setSelectedTags(Array.isArray(tags) ? tags : ['Roleplay']);
    } catch {
      setSelectedTags(['Roleplay']);
    }
    setVoiceName(sourceChar.voiceName || 'Puck');
    setVoiceStyle(sourceChar.voiceStyle || 'Expressive, natural character dialogue');
    setCustomVoiceUuid(sourceChar.customVoiceUuid || '');
    setThinkingDefault(Boolean(sourceChar.thinkingDefault));
    setSearchDefault(Boolean(sourceChar.searchDefault));

    const presetGenders = ['Female', 'Male', 'Non-Binary', 'Agender', 'Unknown'];
    const rawGender = sourceChar.gender || 'Unknown';
    if (presetGenders.includes(rawGender)) {
      setGender(rawGender);
      setCustomGender('');
    } else {
      setGender('Custom');
      setCustomGender(rawGender);
    }

    const presetPronouns = ['She/Her', 'He/Him', 'They/Them', 'It/Its', 'Any'];
    const rawPronouns = sourceChar.pronouns || 'They/Them';
    if (presetPronouns.includes(rawPronouns)) {
      setPronouns(rawPronouns);
      setCustomPronouns('');
    } else {
      setPronouns('Custom');
      setCustomPronouns(rawPronouns);
    }

    setModel3dUrl(sourceChar.model3dUrl || '');
    setModel3dPose(sourceChar.model3dPose || 'neutral');
    setLoreEntries(mergeCharacterLoreEntries([], sourceChar.lorebook).entries);
    setAttachedLoreNames([]);
    setConfirmingDelete(false);
    setSuccessMsg(
      editingCharacter
        ? `✏️ Editing "${sourceChar.name}". Make any changes and click Save Changes!`
        : `Forked "${sourceChar.name}"! Customize any field and publish your own version.`
    );
  }, [editingCharacter, forkFromCharacter]);

  // Pre-fill from AI Character Maker Draft
  React.useEffect(() => {
    if (!aiGeneratedDraft) return;
    setName(aiGeneratedDraft.name || '');
    setTagline(aiGeneratedDraft.tagline || '');
    if (aiGeneratedDraft.avatar) setAvatar(aiGeneratedDraft.avatar);
    if (aiGeneratedDraft.backgroundImage) setBackgroundImage(aiGeneratedDraft.backgroundImage);
    setRating(aiGeneratedDraft.rating || 'SFW');
    setGreeting(aiGeneratedDraft.greeting || '');
    setAlternateGreetings(
      Array.isArray(aiGeneratedDraft.alternateGreetings) ? aiGeneratedDraft.alternateGreetings : []
    );
    setPersonality(aiGeneratedDraft.personality || '');
    setDescription(aiGeneratedDraft.description || '');
    setSystemPrompt(aiGeneratedDraft.systemPrompt || '');
    setPostHistoryInstructions(aiGeneratedDraft.postHistoryInstructions || '');
    setCreatorNotes(aiGeneratedDraft.creatorNotes || '');
    setScenario(aiGeneratedDraft.scenario || '');
    setExampleDialogues(aiGeneratedDraft.exampleDialogues || '');
    setSelectedTags(
      Array.isArray(aiGeneratedDraft.tags) && aiGeneratedDraft.tags.length > 0
        ? aiGeneratedDraft.tags
        : ['Roleplay']
    );
    if (aiGeneratedDraft.voiceName) setVoiceName(aiGeneratedDraft.voiceName);
    if (aiGeneratedDraft.voiceStyle) setVoiceStyle(aiGeneratedDraft.voiceStyle);

    const presetGenders = ['Female', 'Male', 'Non-Binary', 'Agender', 'Unknown'];
    const rawGender = aiGeneratedDraft.gender || 'Unknown';
    if (presetGenders.includes(rawGender)) {
      setGender(rawGender);
      setCustomGender('');
    } else {
      setGender('Custom');
      setCustomGender(rawGender);
    }

    const presetPronouns = ['She/Her', 'He/Him', 'They/Them', 'It/Its', 'Any'];
    const rawPronouns = aiGeneratedDraft.pronouns || 'They/Them';
    if (presetPronouns.includes(rawPronouns)) {
      setPronouns(rawPronouns);
      setCustomPronouns('');
    } else {
      setPronouns('Custom');
      setCustomPronouns(rawPronouns);
    }

    if (Array.isArray(aiGeneratedDraft.loreEntries) && aiGeneratedDraft.loreEntries.length > 0) {
      setLoreEntries(aiGeneratedDraft.loreEntries);
    }
    setSuccessMsg(
      `Imported AI Maker draft for "${aiGeneratedDraft.name}". Review any field and click Publish Character!`
    );
    onConsumeAiDraft?.();
  }, [aiGeneratedDraft, onConsumeAiDraft]);

  // Any File Upload Handlers (FileReader base64 data URLs)
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setAvatar(ev.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setBackgroundImage(ev.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handle3DModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setModel3dUrl(ev.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  // URL Importer State
  const [importUrl, setImportUrl] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);
  const [showAdvancedImport, setShowAdvancedImport] = useState(false);
  const [importAuthToken, setImportAuthToken] = useState('');
  const [importRawDefinition, setImportRawDefinition] = useState('');

  // Status
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [testingVoice, setTestingVoice] = useState(false);
  const voiceAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [avatarDims, setAvatarDims] = useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
    let active = true;
    const loadVoices = async () => {
      try {
        const res = await fetch(`/api/voices?guestId=${encodeURIComponent(guestId)}`);
        if (res.ok && active) {
          const data = await res.json();
          if (Array.isArray(data.voices)) {
            setCustomVoices(data.voices);
          }
        }
      } catch (err) {
        console.warn('Could not load custom voices:', err);
      }
    };
    loadVoices();
    return () => {
      active = false;
    };
  }, [guestId]);

  // URL Import Handler (Chub.ai, Janitor.ai, SpicyChat.ai)
  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) return;
    try {
      setImportingUrl(true);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await fetch('/api/characters/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: importUrl.trim(),
          authToken: importAuthToken.trim() || undefined,
          rawDefinition: importRawDefinition.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to import character from URL');
      }

      const { character: imported, source, warning } = await res.json();

      setName(imported.name || '');
      setTagline(imported.tagline || '');
      setAvatar(imported.avatar || AVATAR_PRESETS[0]);
      setBackgroundImage(imported.backgroundImage || '');
      setGreeting(imported.greeting || '');
      setAlternateGreetings(imported.alternateGreetings || []);
      setPersonality(imported.personality || '');
      setDescription(imported.description || '');
      setSystemPrompt(imported.systemPrompt || '');
      setPostHistoryInstructions(imported.postHistoryInstructions || '');
      setCreatorNotes(imported.creatorNotes || '');
      setCharacterVersion(imported.characterVersion || '1.0');
      setScenario(imported.scenario || '');
      setExampleDialogues(imported.exampleDialogues || '');
      setSelectedTags(imported.tags?.length > 0 ? imported.tags : ['Chub Import']);
      setRating(imported.rating || 'SFW');
      setVoiceName(imported.voiceName || 'Puck');
      if (imported.voiceStyle) setVoiceStyle(imported.voiceStyle);
      const inferredGender =
        imported.gender ||
        (Array.isArray(imported.tags) && imported.tags.some((t: string) => /^female$/i.test(t))
          ? 'Female'
          : Array.isArray(imported.tags) && imported.tags.some((t: string) => /^male$/i.test(t))
          ? 'Male'
          : Array.isArray(imported.tags) && imported.tags.some((t: string) => /^non-?binary$/i.test(t))
          ? 'Non-Binary'
          : '');
      if (inferredGender) {
        const presetGenders = ['Female', 'Male', 'Non-Binary', 'Agender', 'Unknown'];
        if (presetGenders.includes(inferredGender)) {
          setGender(inferredGender);
        } else {
          setGender('Custom');
          setCustomGender(inferredGender);
        }
      }
      const inferredPronouns =
        imported.pronouns ||
        (inferredGender === 'Female'
          ? 'She/Her'
          : inferredGender === 'Male'
          ? 'He/Him'
          : inferredGender === 'Non-Binary'
          ? 'They/Them'
          : '');
      if (inferredPronouns) {
        const presetPronouns = ['She/Her', 'He/Him', 'They/Them', 'It/Its', 'Any'];
        if (presetPronouns.includes(inferredPronouns)) {
          setPronouns(inferredPronouns);
        } else {
          setPronouns('Custom');
          setCustomPronouns(inferredPronouns);
        }
      }
      setLoreEntries(imported.lorebook || []);

      setSuccessMsg(
        warning
          ? `Imported "${imported.name}" from ${source.toUpperCase()} — Note: ${warning}`
          : `Successfully imported "${imported.name}" from ${source.toUpperCase()}! You can now edit and publish.`
      );
      setImportUrl('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Import error');
    } finally {
      setImportingUrl(false);
    }
  };

  // Attach ANY file type(s) to the character
  const handleAttachAnyFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = (ev.target?.result as string) || '';
        setAttachedFiles((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2, 10),
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    setSuccessMsg(`Attached ${files.length} file(s) of type "${files[0]?.type || 'any'}"!`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Universal file import: accepts JSON cards, PNG Tavern cards, 3D models, text/markdown, audio/video, or ANY file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();

    // 1. Check PNG for embedded Chub/Tavern 'chara' card or set as avatar
    if (lower.endsWith('.png') || file.type === 'image/png') {
      const bufReader = new FileReader();
      bufReader.onload = (ev) => {
        const buffer = ev.target?.result as ArrayBuffer;
        const pngCard = buffer ? extractChubPngCard(buffer) : null;
        const dataReader = new FileReader();
        dataReader.onload = (dEv) => {
          const dataUrl = dEv.target?.result as string;
          if (pngCard) {
            setName(pngCard.name);
            setTagline(pngCard.tagline);
            setAvatar(dataUrl || pngCard.avatar || AVATAR_PRESETS[0]);
            setBackgroundImage(pngCard.backgroundImage || '');
            setGreeting(pngCard.greeting);
            setAlternateGreetings(pngCard.alternateGreetings || []);
            setPersonality(pngCard.personality || '');
            setDescription(pngCard.description);
            setSystemPrompt(pngCard.systemPrompt);
            setPostHistoryInstructions(pngCard.postHistoryInstructions || '');
            setCreatorNotes(pngCard.creatorNotes || '');
            setCharacterVersion(pngCard.characterVersion || '1.0');
            setScenario(pngCard.scenario);
            setExampleDialogues(pngCard.exampleDialogues);
            setSelectedTags(pngCard.tags.length > 0 ? pngCard.tags : ['Chub PNG']);
            setRating(pngCard.rating);
            setVoiceName(pngCard.voiceName || 'Puck');
            setLoreEntries(pngCard.lorebook || []);
            setSuccessMsg(`Extracted Chub V2 PNG Card "${pngCard.name}"!`);
          } else {
            if (dataUrl) setAvatar(dataUrl);
            setAttachedFiles((prev) => [
              ...prev,
              { id: Math.random().toString(36).slice(2, 10), name: file.name, type: file.type || 'image/png', size: file.size, dataUrl },
            ]);
            setSuccessMsg(`Loaded PNG image "${file.name}" as avatar & attached file!`);
          }
          setTimeout(() => setSuccessMsg(''), 4000);
        };
        dataReader.readAsDataURL(file);
      };
      bufReader.readAsArrayBuffer(file);
      return;
    }

    // 2. Check 3D model files
    if (/\.(glb|gltf|obj|fbx|vrm|stl|dae)$/i.test(lower)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) setModel3dUrl(dataUrl);
        setAttachedFiles((prev) => [
          ...prev,
          { id: Math.random().toString(36).slice(2, 10), name: file.name, type: file.type || 'model/3d', size: file.size, dataUrl },
        ]);
        setSuccessMsg(`Loaded 3D model file "${file.name}"!`);
        setTimeout(() => setSuccessMsg(''), 4000);
      };
      reader.readAsDataURL(file);
      return;
    }

    // 3. Check JSON card
    if (lower.endsWith('.json') || file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const normalized = parseTavernCard(text);

          setName(normalized.name);
          setTagline(normalized.tagline);
          setAvatar(normalized.avatar || AVATAR_PRESETS[0]);
          setBackgroundImage(normalized.backgroundImage || '');
          setGreeting(normalized.greeting);
          setAlternateGreetings(normalized.alternateGreetings || []);
          setPersonality(normalized.personality || '');
          setDescription(normalized.description);
          setSystemPrompt(normalized.systemPrompt);
          setPostHistoryInstructions(normalized.postHistoryInstructions || '');
          setCreatorNotes(normalized.creatorNotes || '');
          setCharacterVersion(normalized.characterVersion || '1.0');
          setScenario(normalized.scenario);
          setExampleDialogues(normalized.exampleDialogues);
          setSelectedTags(normalized.tags.length > 0 ? normalized.tags : ['Original']);
          setRating(normalized.rating);
          setVoiceName(normalized.voiceName || 'Puck');
          setLoreEntries(normalized.lorebook || []);

          setSuccessMsg(`Imported Tavern Card "${normalized.name}" successfully!`);
          setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err: any) {
          setErrorMsg('Failed to parse JSON card: ' + err.message);
          setTimeout(() => setErrorMsg(''), 4000);
        }
      };
      reader.readAsText(file);
      return;
    }

    // 4. Plain text / markdown / wiki source files
    if (/\.(txt|md|wiki|mediawiki|csv|yaml|yml)$/i.test(lower) || file.type.startsWith('text/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = (ev.target?.result as string) || '';
        setDescription((prev) => (prev ? `${prev}\n\n${text}` : text));
        const dataReader = new FileReader();
        dataReader.onload = (dEv) => {
          setAttachedFiles((prev) => [
            ...prev,
            { id: Math.random().toString(36).slice(2, 10), name: file.name, type: file.type || 'text/plain', size: file.size, dataUrl: (dEv.target?.result as string) || '' },
          ]);
        };
        dataReader.readAsDataURL(file);
        setSuccessMsg(`Imported text file "${file.name}" into Character Description & Attachments!`);
        setTimeout(() => setSuccessMsg(''), 4000);
      };
      reader.readAsText(file);
      return;
    }

    // 5. Any other file type (audio, video, images, zip, pdf, binaries, custom extensions)
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = (ev.target?.result as string) || '';
      if (file.type.startsWith('image/') && dataUrl) {
        setAvatar(dataUrl);
      }
      setAttachedFiles((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2, 10),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          dataUrl,
        },
      ]);
      setSuccessMsg(`Uploaded "${file.name}" (${file.type || 'any file'}) to Character Attachments!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    };
    reader.readAsDataURL(file);
  };

  // Alternate Greetings helpers
  const addAlternateGreeting = () => {
    setAlternateGreetings([...alternateGreetings, '']);
  };

  const updateAlternateGreeting = (index: number, val: string) => {
    const updated = [...alternateGreetings];
    updated[index] = val;
    setAlternateGreetings(updated);
  };

  const removeAlternateGreeting = (index: number) => {
    setAlternateGreetings(alternateGreetings.filter((_, i) => i !== index));
  };

  // Lorebook helpers + Community / Saved multi-lorebook attachment
  const savedLorebooks = React.useMemo<
    Array<{ id: string; name: string; description?: string; scanDepth?: number; entries: any[] }>
  >(() => {
    try {
      const raw = localStorage.getItem('palace_saved_lorebooks');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [showLorePicker]);

  React.useEffect(() => {
    let active = true;
    const loadCommunityLorebooks = async () => {
      try {
        setLoadingLorebooks(true);
        const params = new URLSearchParams();
        params.set('limit', '36');
        params.set('sort', 'popular');
        if (loreSearch.trim()) params.set('search', loreSearch.trim());
        const res = await fetch(`/api/lorebooks?${params.toString()}`);
        if (res.ok && active) {
          const data = await res.json();
          setCommunityLorebooks(Array.isArray(data.lorebooks) ? data.lorebooks : []);
        }
      } catch (err) {
        console.warn('Could not load community lorebooks:', err);
      } finally {
        if (active) setLoadingLorebooks(false);
      }
    };
    const t = setTimeout(loadCommunityLorebooks, loreSearch.trim() ? 180 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [loreSearch]);

  const attachLorebookToCharacter = (
    sourceName: string,
    rawEntries: unknown,
    sharedUuid?: string
  ) => {
    setLoreEntries((prev) => {
      const merged = mergeCharacterLoreEntries(prev, rawEntries);
      setLoreAttachNotice(
        merged.addedCount > 0
          ? `Attached "${sourceName}" (+${merged.addedCount} entries, ${merged.entries.length} total)`
          : `All entries from "${sourceName}" are already in this character's lorebook.`
      );
      setTimeout(() => setLoreAttachNotice(''), 4000);
      return merged.entries;
    });
    setAttachedLoreNames((prev) => (prev.includes(sourceName) ? prev : [...prev, sourceName]));

    if (sharedUuid) {
      setCommunityLorebooks((prev) =>
        prev.map((lb) => (lb.uuid === sharedUuid ? { ...lb, useCount: lb.useCount + 1 } : lb))
      );
      fetch(`/api/lorebooks/${encodeURIComponent(sharedUuid)}/use`, { method: 'POST' }).catch(
        console.error
      );
    }
  };

  React.useEffect(() => {
    if (!pendingLorebook) return;
    attachLorebookToCharacter(pendingLorebook.name, pendingLorebook.entries, pendingLorebook.uuid);
    setShowLorePicker(true);
    onConsumePendingLorebook?.();
  }, [pendingLorebook]);

  const handleImportLorebookFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse((ev.target?.result as string) || '{}');
        const rawList =
          parsed.entries ||
          (parsed.character_book && parsed.character_book.entries) ||
          (Array.isArray(parsed) ? parsed : []);
        const lbTitle = parsed.name || parsed.title || file.name.replace(/\.json$/i, '');
        attachLorebookToCharacter(lbTitle, rawList);
      } catch (err: any) {
        setLoreAttachNotice(`Invalid lorebook JSON: ${err?.message || 'Unable to parse'}`);
      }
    };
    reader.readAsText(file);
  };

  const handlePublishCharacterLorebook = async () => {
    const cleanEntries = loreEntries.filter((e) => e.key.trim() || e.content.trim());
    if (cleanEntries.length === 0) {
      setLoreAttachNotice('Add at least one lorebook entry before publishing.');
      return;
    }
    try {
      setPublishingLorebook(true);
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const loreTitle = name.trim() ? `${name.trim()} World Lorebook` : 'Character World Lorebook';
      const res = await fetch('/api/lorebooks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: loreTitle,
          description: tagline.trim() || `Shared lorebook from ${name.trim() || 'Palace Character'}.`,
          scanDepth: 4,
          entries: cleanEntries.map((item, idx) => ({
            id: `char_lb_${idx + 1}`,
            keys: item.key,
            secondaryKeys: '',
            content: item.content,
            insertionOrder: 100,
            enabled: true,
            constant: false,
            caseSensitive: false,
          })),
          tags: selectedTags.slice(0, 5),
          isPublic: true,
          guestId,
          creatorName: profile?.username || profile?.displayName || user?.displayName || 'Community',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lorebook) {
          setCommunityLorebooks((prev) => [data.lorebook, ...prev]);
          setLoreAttachNotice(`🌐 Published "${data.lorebook.name}" to Community Lorebooks!`);
        }
      }
    } catch (err) {
      console.error('Failed to publish character lorebook:', err);
    } finally {
      setPublishingLorebook(false);
    }
  };

  const addLoreEntry = () => {
    setLoreEntries([...loreEntries, { key: '', content: '' }]);
  };

  const updateLoreEntry = (index: number, key: string, content: string) => {
    const updated = [...loreEntries];
    updated[index] = { key, content };
    setLoreEntries(updated);
  };

  const removeLoreEntry = (index: number) => {
    setLoreEntries(loreEntries.filter((_, i) => i !== index));
  };

  const handleTestVoice = async () => {
    if (testingVoice) {
      stopActiveTTSPlayback(voiceAudioRef);
      setTestingVoice(false);
      return;
    }

    try {
      setTestingVoice(true);
      const sampleText =
        greeting || `Hello, my name is ${name || 'Palace'}. Ready for our adventure?`;
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText.slice(0, 140),
          voiceName,
          voiceStyle,
          customVoiceUuid: customVoiceUuid || undefined,
          ttsApi: customVoiceUuid ? 'chub_custom_voice' : 'gemini_flash_tts',
        }),
      });

      if (!res.ok) throw new Error('TTS voice generation failed');
      const data = await res.json();
      await playTTSResponseData(data, sampleText.slice(0, 140), {
        audioRef: voiceAudioRef,
        onStart: () => setTestingVoice(true),
        onEnd: () => setTestingVoice(false),
        onError: () => setTestingVoice(false),
      });
    } catch (err) {
      console.error(err);
      setTestingVoice(false);
    }
  };

  const handleExportJson = () => {
    const tavernData = exportTavernCard({
      name: name || 'Custom Character',
      tagline: tagline || 'A unique persona',
      avatar,
      backgroundImage,
      description,
      personality,
      greeting,
      alternateGreetings,
      systemPrompt,
      postHistoryInstructions,
      creatorNotes,
      characterVersion,
      scenario,
      exampleDialogues,
      tags: selectedTags,
      rating,
      voiceName,
      lorebook: loreEntries,
    });

    const blob = new Blob([JSON.stringify(tavernData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(name || 'character').toLowerCase().replace(/[^a-z0-9]/g, '_')}_chub_v2.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !tagline.trim() || !greeting.trim()) {
      setErrorMsg('Name, Tagline, and First Greeting message are required!');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');

      const attachmentMarkup = attachedFiles.length > 0
        ? '\n\n== Attached Character Files ==\n' +
          attachedFiles
            .map((f) => {
              if (f.type.startsWith('image/')) {
                return `<div style="margin:6px 0;"><img src="${f.dataUrl}" alt="${f.name}" style="max-width:240px;border-radius:10px;" /><p style="font-size:11px;color:#a1a1aa;">📎 ${f.name}</p></div>`;
              }
              if (f.type.startsWith('audio/')) {
                return `<div style="margin:6px 0;">🎵 <strong>${f.name}</strong><br/><audio controls src="${f.dataUrl}"></audio></div>`;
              }
              return `<div>📎 <strong>${f.name}</strong> (${Math.max(1, Math.round(f.size / 1024))} KB • ${f.type})</div>`;
            })
            .join('\n')
        : '';

      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const endpoint = editingCharacter
        ? `/api/characters/${encodeURIComponent(editingCharacter.uuid)}`
        : '/api/characters';
      const method = editingCharacter ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify({
          guestId,
          name: name.trim(),
          tagline: tagline.trim(),
          avatar,
          backgroundImage: backgroundImage.trim(),
          rating,
          greeting: greeting.trim(),
          alternateGreetings: alternateGreetings.filter((g) => g.trim().length > 0),
          personality: personality.trim(),
          description: (description.trim() || tagline.trim()) + attachmentMarkup,
          systemPrompt:
            systemPrompt.trim() ||
            `You are ${name}. Maintain character immersion at all times.`,
          postHistoryInstructions: postHistoryInstructions.trim(),
          creatorNotes: creatorNotes.trim(),
          characterVersion: characterVersion.trim() || '1.0',
          scenario: scenario.trim(),
          exampleDialogues: exampleDialogues.trim(),
          tags: selectedTags,
          voiceName,
          voiceStyle,
          customVoiceUuid: customVoiceUuid || null,
          thinkingDefault,
          searchDefault,
          gender: gender === 'Custom' ? customGender || 'Unknown' : gender,
          pronouns: pronouns === 'Custom' ? customPronouns || 'They/Them' : pronouns,
          model3dUrl: model3dUrl || null,
          model3dPose,
          lorebook: loreEntries.filter((l) => l.key.trim() && l.content.trim()),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || (editingCharacter ? 'Failed to update character' : 'Failed to create character')
        );
      }

      const data = await res.json();
      if (editingCharacter && onCharacterUpdated) {
        onCharacterUpdated(data.character);
      } else {
        onCharacterCreated(data.character);
      }
    } catch (err: any) {
      setErrorMsg(err.message || (editingCharacter ? 'Update failed' : 'Creation failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCurrentCharacter = async () => {
    if (!editingCharacter) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 4000);
      return;
    }
    try {
      setDeleting(true);
      setErrorMsg('');
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        `/api/characters/${encodeURIComponent(editingCharacter.uuid)}?guestId=${encodeURIComponent(guestId)}`,
        { method: 'DELETE', headers }
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete character');
      }
      onCharacterDeleted?.(editingCharacter.uuid);
    } catch (err: any) {
      setErrorMsg(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Top Title & Import Banner */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-purple-900/40 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 flex items-center gap-2">
            <span>{editingCharacter ? '✏️ Edit Character' : 'Character Studio'}</span>
            <span className="rounded-lg bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300 border border-purple-500/30 font-semibold">
              {editingCharacter ? `Editing: ${editingCharacter.name}` : 'Chub.ai & Tavern V2 Spec'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Every fill-in field from Chub.ai: Alternate greetings, Post-history instructions, NSFL ratings, and full lorebooks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* File input for ANY file type: JSON, PNG Card, 3D Model, Text, Media, Binary */}
          <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-purple-500/40 bg-purple-950/30 px-3.5 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-900/40 transition-all shadow-sm">
            <Upload className="h-4 w-4" />
            <span>Import Any File / Card</span>
            <input
              type="file"
              accept="*/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-all"
          >
            <Download className="h-4 w-4 text-purple-400" />
            <span className="hidden sm:inline">Export V2 JSON</span>
          </button>
        </div>
      </div>

      {/* URL Importer Bar (Chub.ai, Janitor.ai, SpicyChat.ai) */}
      <div className="mb-8 rounded-3xl border border-purple-500/40 bg-gradient-to-r from-purple-950/40 via-zinc-900/80 to-zinc-950 p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
            <LinkIcon className="h-4 w-4 text-amber-400" />
            <span>Import Character from URL</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="rounded-md bg-purple-900/50 border border-purple-500/30 px-2 py-0.5 text-purple-200">
              chub.ai
            </span>
            <span className="rounded-md bg-pink-900/50 border border-pink-500/30 px-2 py-0.5 text-pink-200">
              janitorai.com
            </span>
            <span className="rounded-md bg-amber-900/50 border border-amber-500/30 px-2 py-0.5 text-amber-200">
              spicychat.ai
            </span>
            <span className="rounded-md bg-red-900/50 border border-red-500/30 px-2 py-0.5 text-red-200">
              fandom.com
            </span>
            <span className="rounded-md bg-rose-900/50 border border-rose-500/30 px-2 py-0.5 text-rose-200">
              peppafanon.miraheze.org
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-2.5">
          <input
            type="text"
            aria-label="Character Import URL"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleImportFromUrl();
              }
            }}
            placeholder="Paste link (chub.ai, janitorai.com, spicychat.ai, fandom.com, peppafanon.miraheze.org...)"
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={importingUrl || !importUrl.trim()}
            onClick={handleImportFromUrl}
            className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-purple-500 disabled:opacity-50 transition-all shrink-0"
          >
            {importingUrl ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Importing Card...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>Import from Link</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Sample Links */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
          <span className="text-[10px] uppercase font-bold text-zinc-500">Quick Test Samples:</span>
          <button
            type="button"
            onClick={() => setImportUrl('https://chub.ai/characters/Anonymous/template-f0e0db2bf614')}
            className="rounded-lg bg-zinc-900 px-2 py-1 hover:bg-zinc-800 text-purple-300 transition-colors border border-zinc-800"
          >
            📋 Chub: Template f0e0db2bf614
          </button>
          <button
            type="button"
            onClick={() =>
              setImportUrl(
                'https://janitorai.com/characters/683af453-907c-42b9-b72a-1d850818193e_character-velvet-by-arzy-parzy'
              )
            }
            className="rounded-lg bg-zinc-900 px-2 py-1 hover:bg-zinc-800 text-pink-300 transition-colors border border-zinc-800"
          >
            🐱 JanitorAI: Velvet
          </button>
          <button
            type="button"
            onClick={() => setImportUrl('https://dandysworldcreepypasta.fandom.com/wiki/Nextor,w%C6%B4x?veaction=editsource')}
            className="rounded-lg bg-zinc-900 px-2 py-1 hover:bg-zinc-800 text-red-400 transition-colors border border-red-900/40"
          >
            👻 Fandom Creepypasta: Nextor,wƴx
          </button>
          <button
            type="button"
            onClick={() => setImportUrl('https://peppafanon.miraheze.org/wiki/Test?action=edit&create=Create+page')}
            className="rounded-lg bg-zinc-900 px-2 py-1 hover:bg-zinc-800 text-rose-300 transition-colors border border-rose-900/40"
          >
            🐷 Miraheze: Peppa Fanon Sandbox
          </button>
          <button
            type="button"
            onClick={() => setImportUrl('https://spicychat.ai/chatbot/e0c477e0-9a56-4918-a624-586bb3762dc3')}
            className="rounded-lg bg-zinc-900 px-2 py-1 hover:bg-zinc-800 text-amber-300 transition-colors border border-zinc-800"
          >
            🌶️ SpicyChat: Velvet
          </button>
        </div>

        {/* Optional Collapsible JanitorAI Token / Pasted Definition Override */}
        <div className="mt-3 pt-2.5 border-t border-zinc-800/70">
          <button
            type="button"
            aria-expanded={showAdvancedImport}
            onClick={() => setShowAdvancedImport((prev) => !prev)}
            className="text-[11px] font-semibold text-purple-300 hover:text-purple-200 transition-colors flex items-center gap-1.5"
          >
            <span>{showAdvancedImport ? '▾' : '▸'}</span>
            <span>Unlock Hidden JanitorAI Definition (Optional Token or Pasted Card Text)</span>
          </button>

          {showAdvancedImport && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  JanitorAI Bearer Token (Optional)
                </label>
                <input
                  type="password"
                  aria-label="JanitorAI Bearer Token"
                  value={importAuthToken}
                  onChange={(e) => setImportAuthToken(e.target.value)}
                  placeholder="Paste JanitorAI Bearer token to fetch login-gated card JSON..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-zinc-500">
                  Sent only for this import request and never stored.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Paste Verbatim Card Text / JSON (Optional)
                </label>
                <textarea
                  rows={2}
                  aria-label="Paste Verbatim Definition or V2 JSON"
                  value={importRawDefinition}
                  onChange={(e) => setImportRawDefinition(e.target.value)}
                  placeholder="Paste Personality / Scenario / Initial Message text or Tavern V2 JSON to override..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-xs font-semibold text-emerald-300 animate-in fade-in flex items-center gap-2">
          <Check className="h-4 w-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs font-semibold text-rose-300 animate-in fade-in flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Core Identity Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md">
          {/* Avatar selector & preview */}
          <div className="flex flex-col items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
              Character Avatar &amp; 3D Model
            </label>
            <div className="relative w-full max-w-[240px] min-h-[160px] max-h-[320px] flex items-center justify-center overflow-hidden rounded-2xl border-2 border-purple-500/60 shadow-lg mb-2 bg-zinc-950 group">
              {model3dUrl ? (
                <div className="h-64 w-full">
                  <ThreeAvatarViewer
                    characterName={name || 'Character'}
                    avatarUrl={avatar}
                    currentPose={model3dPose}
                    className="h-full w-full"
                  />
                </div>
              ) : (
                <>
                  <img
                    src={avatar}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full object-cover blur-xl scale-110 opacity-30 pointer-events-none"
                  />
                  <img
                    src={avatar}
                    alt="Avatar Preview"
                    referrerPolicy="no-referrer"
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      if (el.naturalWidth && el.naturalHeight) {
                        setAvatarDims({ w: el.naturalWidth, h: el.naturalHeight });
                      }
                    }}
                    className="relative z-10 max-h-[320px] w-full object-contain"
                  />
                </>
              )}

              {avatarDims && !model3dUrl && (
                <div
                  data-testid="avatar-resolution-badge"
                  className="absolute top-2 left-2 z-20 rounded-lg bg-black/75 border border-white/15 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-200 backdrop-blur-md"
                >
                  {avatarDims.w} &times; {avatarDims.h} px
                </div>
              )}

              {/* Direct File Upload Overlay Button (Any file accepted) */}
              <label className="absolute bottom-2 right-2 z-20 rounded-xl bg-black/70 border border-white/20 p-2 text-white hover:bg-black/90 cursor-pointer backdrop-blur-md shadow-md transition-all">
                <Upload className="h-3.5 w-3.5" />
                <input
                  type="file"
                  accept="*/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="w-full flex items-center gap-1.5 mb-2">
              <input
                type="text"
                aria-label="Avatar URL"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="Or paste image URL..."
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
              />
              <label className="rounded-xl border border-purple-500/40 bg-purple-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-purple-200 hover:bg-purple-900/40 cursor-pointer shrink-0">
                <Upload className="h-3 w-3 inline mr-1" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="*/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5 justify-center mb-3">
              {AVATAR_PRESETS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAvatar(p)}
                  className={`h-7 w-7 rounded-lg overflow-hidden border-2 transition-all ${
                    avatar === p
                      ? 'border-purple-400 scale-110'
                      : 'border-zinc-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={p} alt={`Preset ${i}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>

            {/* 3D Model Configuration */}
            <div className="w-full rounded-2xl border border-purple-900/30 bg-purple-950/20 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                <span className="flex items-center gap-1">
                  <Box className="h-3.5 w-3.5 text-purple-400" />
                  3D Avatar Model
                </span>
                <label className="text-[10px] text-purple-400 hover:underline cursor-pointer">
                  Upload Any 3D File
                  <input
                    type="file"
                    accept="*/*"
                    onChange={handle3DModelUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <input
                type="text"
                value={model3dUrl}
                onChange={(e) => setModel3dUrl(e.target.value)}
                placeholder="URL or upload 3D model (or procedural)"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300 focus:outline-none"
              />

              <div className="text-[10px] font-semibold text-zinc-400">Default 3D Pose:</div>
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

          {/* Name, Tagline & Rating */}
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                  Character Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sylvia Thorne, Lord Malakor"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm font-semibold text-zinc-100 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                  Version
                </label>
                <input
                  type="text"
                  value={characterVersion}
                  onChange={(e) => setCharacterVersion(e.target.value)}
                  placeholder="1.0"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs font-semibold text-zinc-100 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Content Rating Selector: SFW / NSFW / NSFL / NSFW + NSFL */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                Content Rating *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'SFW', label: 'SFW', desc: 'Safe for Work', color: 'emerald' },
                  { id: 'NSFW', label: 'NSFW', desc: 'Mature 18+', color: 'rose' },
                  { id: 'NSFL', label: 'NSFL', desc: 'Dark / Extreme', color: 'red' },
                  { id: 'NSFW + NSFL', label: 'NSFW + NSFL', desc: 'Mature & Dark', color: 'purple' },
                ].map((item) => {
                  const isSelected = rating === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRating(item.id as ContentRating)}
                      className={`rounded-xl border p-2.5 text-center transition-all ${
                        isSelected
                          ? 'border-purple-400 bg-purple-500/20 text-white ring-1 ring-purple-400'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="font-bold text-xs">{item.label}</div>
                      <div className="text-[10px] text-zinc-500">{item.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gender & Pronouns Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                  Gender
                </label>
                <div className="grid grid-cols-3 gap-1 mb-1.5">
                  {['Female', 'Male', 'Non-Binary', 'Agender', 'Unknown', 'Custom'].map((g) => (
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
                    placeholder="Enter custom gender..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-white"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                  Pronouns
                </label>
                <div className="grid grid-cols-3 gap-1 mb-1.5">
                  {['She/Her', 'He/Him', 'They/Them', 'It/Its', 'Any', 'Custom'].map((p) => (
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
                    placeholder="Enter custom pronouns..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-white"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                Short Tagline / Hook * (Appears on card)
              </label>
              <input
                type="text"
                required
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="A one-sentence hook summarizing their identity and intrigue..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Background Image URL, File Upload & Presets */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
                  Stage / Background Image URL (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setBackgroundImage(avatar)}
                    className="text-[10px] font-bold text-amber-300 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <ImageIcon className="h-3 w-3" />
                    <span>Use Avatar as Background</span>
                  </button>
                  <label className="text-[10px] text-purple-400 hover:underline cursor-pointer flex items-center gap-1">
                    <Upload className="h-3 w-3" />
                    <span>Upload Any Background File</span>
                    <input
                      type="file"
                      accept="*/*"
                      onChange={handleBackgroundUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={backgroundImage}
                  onChange={(e) => setBackgroundImage(e.target.value)}
                  placeholder="https://images.unsplash.com/... (Displays behind chat or upload any file)"
                  className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                />
                <div className="flex gap-1 shrink-0">
                  {BACKGROUND_PRESETS.map((bg, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBackgroundImage(bg)}
                      className="h-8 w-8 rounded-lg overflow-hidden border border-zinc-700 opacity-60 hover:opacity-100 transition-opacity"
                      title={`Backdrop ${idx + 1}`}
                    >
                      <img src={bg} alt="bg" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Voice & TTS Configuration (Gemini + Chub.ai Custom Voices Engine) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Volume2 className="h-4 w-4" />
                  Voice Persona &amp; Chub.ai Custom Voices Engine
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="open-custom-voice-studio-btn"
                    onClick={() => setIsVoiceStudioOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25 transition-all cursor-pointer"
                  >
                    <Mic className="h-3 w-3" />
                    <span>+ Custom Audio Voice</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTestVoice}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border cursor-pointer ${
                      testingVoice
                        ? 'bg-amber-500/30 text-amber-200 border-amber-400 animate-pulse'
                        : 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    {testingVoice ? (
                      <Square className="h-3 w-3 fill-current" />
                    ) : (
                      <Play className="h-3 w-3 fill-current" />
                    )}
                    <span>Test Voice Sample</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVoiceName(v)}
                    className={`rounded-xl border py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      voiceName === v
                        ? 'border-amber-400/80 bg-amber-500/20 text-amber-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <div className="border-t border-zinc-800/80 pt-2.5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-300 shrink-0">
                    <AudioWaveform className="h-3.5 w-3.5" />
                    <span>Chub Custom Audio Clone:</span>
                  </div>
                  <select
                    data-testid="studio-custom-voice-select"
                    value={customVoiceUuid}
                    onChange={(e) => setCustomVoiceUuid(e.target.value)}
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 focus:border-amber-400 focus:outline-none"
                  >
                    <option value="">None (Use Base Voice: {voiceName})</option>
                    {customVoices.map((cv) => (
                      <option key={cv.uuid} value={cv.uuid}>
                        🎙️ {cv.name} ({cv.baseVoiceName}, {cv.pitchShift >= 0 ? `+${cv.pitchShift}` : cv.pitchShift}st, {cv.speakingRate}%)
                      </option>
                    ))}
                  </select>
                </div>

                {customVoiceUuid && (() => {
                  const selectedCustom = customVoices.find((cv) => cv.uuid === customVoiceUuid);
                  if (!selectedCustom) return null;
                  return (
                    <div
                      data-testid="studio-custom-voice-preview"
                      className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-amber-200">
                          🎙️ Active Chub Custom Voice: {selectedCustom.name}
                        </span>
                        <span className="text-zinc-400 font-mono text-[10px]">
                          {selectedCustom.description || `${selectedCustom.pitchShift}st • ${selectedCustom.speakingRate}%`}
                        </span>
                      </div>
                      {selectedCustom.referenceAudioData && (
                        <audio controls src={selectedCustom.referenceAudioData} className="w-full h-8" />
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* AI Capabilities Flags */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={thinkingDefault}
                  onChange={(e) => setThinkingDefault(e.target.checked)}
                  className="rounded border-zinc-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="flex items-center gap-1 font-medium">
                  <BrainCircuit className="h-3.5 w-3.5 text-purple-400" />
                  Default to High-Thinking (gemini-4-argon)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={searchDefault}
                  onChange={(e) => setSearchDefault(e.target.checked)}
                  className="rounded border-zinc-700 text-sky-600 focus:ring-sky-500"
                />
                <span className="flex items-center gap-1 font-medium">
                  <Globe className="h-3.5 w-3.5 text-sky-400" />
                  Default Google Search Grounding
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* First Message / Greeting (Wiki Editor) */}
        <div className="space-y-1">
          <WikiEditor
            label="First Message / Greeting * (Primary conversation starter)"
            description="Write actions in asterisks like *I step forward* and spoken dialogue in quotes. Supports Fandom/Peppa Wiki styling, font sizes, images, and audio tracks."
            placeholder="*Rain taps gently against the leaded glass as I look up from my book.* Welcome to my sanctuary. What brings you through the storm?"
            value={greeting}
            onChange={setGreeting}
            rows={5}
            characterName={name || 'Character'}
          />
        </div>

        {/* Alternate Greetings List (Chub.ai Feature) */}
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                <span>Alternate Greetings ({alternateGreetings.length})</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Users can swipe or switch between these opening greetings when starting a new chat.
              </p>
            </div>
            <button
              type="button"
              onClick={addAlternateGreeting}
              className="flex items-center gap-1 rounded-xl bg-purple-600/30 border border-purple-500/50 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-600/50 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Alternate Greeting</span>
            </button>
          </div>

          {alternateGreetings.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-1">
              No alternate greetings added yet. Add variants for different moods or scenarios.
            </p>
          ) : (
            <div className="space-y-3">
              {alternateGreetings.map((alt, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px] text-purple-300 font-semibold">
                    <span>Alternate Greeting #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeAlternateGreeting(idx)}
                      className="text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={alt}
                    onChange={(e) => updateAlternateGreeting(idx, e.target.value)}
                    placeholder="*Alternative starting scene or intro dialogue...*"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Description & Appearance (Fandom Wiki Infobox & Character Profile) */}
        <div className="space-y-1">
          <WikiEditor
            label="Description & Appearance (Fandom Wiki Infobox & Profile)"
            description="Physical appearance, attire, backstory. Click 'Wiki Templates' to insert a Peppa Fanon Wiki Infobox or Attributes & Stats Table!"
            placeholder="Tall with raven hair, wearing a high-collared velvet trench coat..."
            value={description}
            onChange={setDescription}
            rows={7}
            characterName={name || 'Character'}
          />
        </div>

        {/* Personality & Scenario */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WikiEditor
            label="Personality & Mannerisms"
            description="Core behavioral traits, psychological temperament, mannerisms."
            placeholder="Stoic, fiercely loyal, sarcastic wit, guarded about their past..."
            value={personality}
            onChange={setPersonality}
            rows={5}
            characterName={name || 'Character'}
          />

          <WikiEditor
            label="Scenario / Setting"
            description="Initial circumstances, conflict, world context, or time/place."
            placeholder="You encounter each other in an abandoned clock tower during a fierce thunderstorm..."
            value={scenario}
            onChange={setScenario}
            rows={5}
            characterName={name || 'Character'}
          />
        </div>

        {/* Scenario & Post-History Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WikiEditor
            label="Post-History Instructions (Chub Jailbreak / Format Enforcer)"
            description="Injected right after chat history to strongly guide reply format, style, and tone."
            placeholder="[System: Write in vivid sensory prose. Describe actions between asterisks. Keep dialogue immersive.]"
            value={postHistoryInstructions}
            onChange={setPostHistoryInstructions}
            rows={5}
            characterName={name || 'Character'}
          />

          <WikiEditor
            label="Example Dialogues (<START> format)"
            description="Few-shot roleplay turns demonstrating dialect and vocabulary."
            placeholder={'<START>\n{{user}}: What are you doing here?\n{{char}}: *smiles faintly* "Waiting for someone interesting."'}
            value={exampleDialogues}
            onChange={setExampleDialogues}
            rows={5}
            characterName={name || 'Character'}
          />
        </div>

        {/* Core System Prompt */}
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
            Core System Prompt
          </label>
          <p className="text-[11px] text-zinc-400">
            Foundational directives, roleplay boundaries, and character persona anchor.
          </p>
          <textarea
            rows={4}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are Sylvia Thorne. Always speak from Sylvia's perspective. Never break character."
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Creator Notes */}
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
            Creator Notes &amp; Advice
          </label>
          <textarea
            rows={2}
            value={creatorNotes}
            onChange={(e) => setCreatorNotes(e.target.value)}
            placeholder="Special lore hints, recommended user persona, or best prompt settings..."
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Chub Dynamic Free-Form Tag Database Selector */}
        <TagInput
          selectedTags={selectedTags}
          onChange={setSelectedTags}
          title="Chub.ai Tag Database"
          subtitle="Type ANY custom tag and press Enter to save it permanently to the Chub.ai tag database, or toggle existing tags below."
        />

        {/* Lorebook Trigger Entries + Community / Saved Lorebook Picker */}
        <div
          data-testid="character-lorebook-section"
          className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                <span>World Lorebook / Trigger Entries ({loreEntries.length})</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Attach any number of Community or Saved lorebooks onto this character, or add custom keyword triggers.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLorePicker((v) => !v)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  showLorePicker
                    ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-purple-500/50'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>{showLorePicker ? 'Hide Shared Lorebooks' : 'Attach Shared Lorebooks'}</span>
              </button>

              <label className="flex items-center gap-1.5 cursor-pointer rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-purple-500/50 transition-all">
                <Upload className="h-3.5 w-3.5 text-purple-400" />
                <span>Import Lore JSON</span>
                <input
                  type="file"
                  accept=".json,application/json,*/*"
                  onChange={handleImportLorebookFile}
                  className="hidden"
                />
              </label>

              {loreEntries.length > 0 && (
                <button
                  type="button"
                  disabled={publishingLorebook}
                  onClick={handlePublishCharacterLorebook}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>{publishingLorebook ? 'Sharing...' : 'Share Lorebook'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={addLoreEntry}
                className="flex items-center gap-1 rounded-xl bg-purple-600/30 border border-purple-500/50 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-600/50 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Lore Key</span>
              </button>
            </div>
          </div>

          {loreAttachNotice && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3.5 py-2 text-xs font-semibold text-emerald-200 flex items-center gap-2">
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span>{loreAttachNotice}</span>
            </div>
          )}

          {attachedLoreNames.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-zinc-400 font-semibold">Attached Lorebooks:</span>
              {attachedLoreNames.map((lbName) => (
                <span
                  key={lbName}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 font-semibold text-amber-200"
                >
                  <BookOpen className="h-3 w-3" />
                  {lbName}
                </span>
              ))}
            </div>
          )}

          {/* Community & Saved Lorebooks Picker Panel */}
          {showLorePicker && (
            <div className="rounded-2xl border border-purple-500/25 bg-zinc-950/80 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 self-start">
                  <button
                    type="button"
                    onClick={() => setLorePickerTab('community')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                      lorePickerTab === 'community'
                        ? 'bg-purple-600/40 text-purple-100 border border-purple-500/40'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5 text-amber-300" />
                    <span>Community Lorebooks ({communityLorebooks.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLorePickerTab('saved')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                      lorePickerTab === 'saved'
                        ? 'bg-purple-600/40 text-purple-100 border border-purple-500/40'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <BookOpen className="h-3.5 w-3.5 text-purple-300" />
                    <span>Your Saved ({savedLorebooks.length})</span>
                  </button>
                </div>

                {lorePickerTab === 'community' && (
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      aria-label="Search community lorebooks to attach"
                      value={loreSearch}
                      onChange={(e) => setLoreSearch(e.target.value)}
                      placeholder="Search community lorebooks..."
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {lorePickerTab === 'community' ? (
                loadingLorebooks ? (
                  <div className="py-6 text-center text-xs text-zinc-400">Loading community lorebooks...</div>
                ) : communityLorebooks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-500">
                    No matching community lorebooks found. Publish one in Lorebook Studio or click &quot;Share Lorebook&quot; above!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                    {communityLorebooks.map((lb) => {
                      const lbEntries = parseLorebookEntries(lb.entries);
                      const isAttached = attachedLoreNames.includes(lb.name);
                      return (
                        <div
                          key={lb.uuid}
                          className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                            isAttached
                              ? 'border-amber-400/50 bg-amber-950/15'
                              : 'border-zinc-800 bg-zinc-900/70 hover:border-purple-500/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">{lb.name}</span>
                              <span className="text-[10px] font-semibold text-purple-300 shrink-0">
                                {lbEntries.length} entries
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate">
                              @{lb.creatorName} &bull; {lb.useCount} uses &bull; {lb.description}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => attachLorebookToCharacter(lb.name, lb.entries, lb.uuid)}
                            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                              isAttached
                                ? 'bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30'
                                : 'bg-purple-600 text-white hover:bg-purple-500'
                            }`}
                          >
                            <Plus className="h-3 w-3" />
                            <span>{isAttached ? 'Re-Attach' : 'Attach'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : savedLorebooks.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">
                  No locally saved lorebooks yet. Save lorebooks in the Lorebooks tab and they will appear here!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {savedLorebooks.map((lb) => {
                    const isAttached = attachedLoreNames.includes(lb.name);
                    return (
                      <div
                        key={lb.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">{lb.name}</div>
                          <div className="text-[11px] text-zinc-400 truncate">
                            {lb.entries?.length || 0} entries &bull; {lb.description}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => attachLorebookToCharacter(lb.name, lb.entries)}
                          className="flex items-center gap-1 rounded-xl bg-purple-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-purple-500 shrink-0 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                          <span>{isAttached ? 'Re-Attach' : 'Attach'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {loreEntries.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-2">
              No lorebook entries attached yet. Click &quot;Attach&quot; on any Community Lorebook above or click &quot;Add Lore Key&quot; to create entries!
            </p>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setLoreEntries([]);
                    setAttachedLoreNames([]);
                  }}
                  className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  Clear All Entries ({loreEntries.length})
                </button>
              </div>
              {loreEntries.map((entry, idx) => (
                <ViewportSlot
                  key={`${idx}-${entry.key.slice(0, 16)}`}
                  estimatedHeight={82}
                  rootMargin="120px 0px"
                  initialVisible={idx < 8}
                  testId="char-lore-entry-slot"
                >
                  <div className="flex flex-col sm:flex-row gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 items-start">
                    <input
                      type="text"
                      value={entry.key}
                      onChange={(e) => updateLoreEntry(idx, e.target.value, entry.content)}
                      placeholder="Keyword / Trigger (e.g. Citadel, Malakor)"
                      aria-label={`Lorebook keyword ${idx + 1}`}
                      className="w-full sm:w-52 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none shrink-0"
                    />
                    <textarea
                      rows={2}
                      value={entry.content}
                      onChange={(e) => updateLoreEntry(idx, entry.key, e.target.value)}
                      placeholder="Lore information injected when trigger is mentioned..."
                      aria-label={`Lorebook content ${idx + 1}`}
                      className="w-full flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeLoreEntry(idx)}
                      aria-label={`Remove lorebook entry ${idx + 1}`}
                      className="p-2 text-zinc-500 hover:text-rose-400 transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </ViewportSlot>
              ))}
            </div>
          )}
        </div>

        {/* Attached Files (ANY File Type Accepted) */}
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Paperclip className="h-4 w-4" />
                <span>Attached Character Files (All File Types Accepted)</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Attach any file type: PNGs, PDFs, ZIPs, TXT, Audio, Video, 3D Models (.glb/.vrm), JSON, or custom binary files.
              </p>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer rounded-xl bg-purple-600/30 border border-purple-500/50 px-3.5 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-600/50 transition-all shrink-0">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Any File(s)</span>
              <input
                type="file"
                accept="*/*"
                multiple
                onChange={handleAttachAnyFiles}
                className="hidden"
              />
            </label>
          </div>

          {attachedFiles.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-1">
              No extra files attached yet. Any file type you upload here will be bundled onto the character page.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {attachedFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {f.type.startsWith('image/') ? (
                      <img src={f.dataUrl} alt={f.name} className="h-9 w-9 rounded-lg object-cover shrink-0 border border-zinc-700" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-300 shrink-0">
                        <FileIcon className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-100 truncate">{f.name}</div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {f.type} &bull; {Math.max(1, Math.round(f.size / 1024))} KB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachedFile(f.id)}
                    className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                    title="Remove file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div>
            {editingCharacter && onCharacterDeleted && (
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteCurrentCharacter}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                  confirmingDelete
                    ? 'border-rose-500 bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                    : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                }`}
              >
                <Trash2 className="h-4 w-4" />
                <span>
                  {deleting
                    ? 'Deleting...'
                    : confirmingDelete
                    ? 'Click Again to Confirm Delete'
                    : 'Delete Character'}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-900/40 hover:from-purple-500 hover:to-amber-400 disabled:opacity-50 transition-all"
            >
              {editingCharacter ? <Edit3 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              <span>
                {saving
                  ? 'Saving Changes...'
                  : editingCharacter
                  ? 'Save Changes'
                  : 'Create & Publish Character'}
              </span>
            </button>
          </div>
        </div>
      </form>

      <CustomVoiceStudioModal
        isOpen={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
        defaultCharacterName={name}
        onVoiceCreated={(voice) => {
          setCustomVoices((prev) => [voice, ...prev.filter((v) => v.uuid !== voice.uuid)]);
          setCustomVoiceUuid(voice.uuid);
          setVoiceName(voice.baseVoiceName || voiceName);
          if (voice.description && !voiceStyle) {
            setVoiceStyle(voice.description);
          }
        }}
      />
    </div>
  );
};
