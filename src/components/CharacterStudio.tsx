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
} from 'lucide-react';
import {
  parseTavernCard,
  exportTavernCard,
  extractChubPngCard,
  CHUB_ALL_TAGS,
} from '../utils/characterUtils.ts';
import { Character, ContentRating } from '../types/index.ts';
import { WikiEditor } from './WikiEditor.tsx';
import { ThreeAvatarViewer } from './ThreeAvatarViewer.tsx';

interface AttachedCharacterFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

interface CharacterStudioProps {
  onCharacterCreated: (character: Character) => void;
  onCancel: () => void;
  forkFromCharacter?: Character | null;
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
  onCancel,
  forkFromCharacter,
}) => {
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
  const [thinkingDefault, setThinkingDefault] = useState(false);
  const [searchDefault, setSearchDefault] = useState(false);
  const [gender, setGender] = useState('Unknown');
  const [customGender, setCustomGender] = useState('');
  const [pronouns, setPronouns] = useState('They/Them');
  const [customPronouns, setCustomPronouns] = useState('');
  const [model3dUrl, setModel3dUrl] = useState('');
  const [model3dPose, setModel3dPose] = useState('neutral');
  const [loreEntries, setLoreEntries] = useState<Array<{ key: string; content: string }>>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedCharacterFile[]>([]);

  // Pre-fill when Forking a character from Chub.ai / Janitor.ai detail view
  React.useEffect(() => {
    if (!forkFromCharacter) return;
    setName(`${forkFromCharacter.name} (Fork)`);
    setTagline(forkFromCharacter.tagline || '');
    setAvatar(forkFromCharacter.avatar || AVATAR_PRESETS[0]);
    setBackgroundImage(forkFromCharacter.backgroundImage || '');
    setRating(forkFromCharacter.rating || 'SFW');
    setGreeting(forkFromCharacter.greeting || '');
    try {
      const alts = typeof forkFromCharacter.alternateGreetings === 'string'
        ? JSON.parse(forkFromCharacter.alternateGreetings)
        : forkFromCharacter.alternateGreetings;
      setAlternateGreetings(Array.isArray(alts) ? alts : []);
    } catch {
      setAlternateGreetings([]);
    }
    setPersonality(forkFromCharacter.personality || '');
    setDescription(forkFromCharacter.description || '');
    setSystemPrompt(forkFromCharacter.systemPrompt || '');
    setPostHistoryInstructions(forkFromCharacter.postHistoryInstructions || '');
    setCreatorNotes(forkFromCharacter.creatorNotes || `Forked from ${forkFromCharacter.name} by @${forkFromCharacter.creatorName}`);
    setCharacterVersion(forkFromCharacter.characterVersion || '1.0');
    setScenario(forkFromCharacter.scenario || '');
    setExampleDialogues(forkFromCharacter.exampleDialogues || '');
    try {
      const tags = typeof forkFromCharacter.tags === 'string'
        ? JSON.parse(forkFromCharacter.tags)
        : forkFromCharacter.tags;
      setSelectedTags(Array.isArray(tags) ? tags : ['Fork']);
    } catch {
      setSelectedTags(['Fork']);
    }
    setVoiceName(forkFromCharacter.voiceName || 'Puck');
    setVoiceStyle(forkFromCharacter.voiceStyle || 'Expressive, natural character dialogue');
    setThinkingDefault(Boolean(forkFromCharacter.thinkingDefault));
    setSearchDefault(Boolean(forkFromCharacter.searchDefault));
    setGender(forkFromCharacter.gender || 'Unknown');
    setPronouns(forkFromCharacter.pronouns || 'They/Them');
    setModel3dUrl(forkFromCharacter.model3dUrl || '');
    setModel3dPose(forkFromCharacter.model3dPose || 'neutral');
    try {
      const lore = typeof forkFromCharacter.lorebook === 'string'
        ? JSON.parse(forkFromCharacter.lorebook)
        : forkFromCharacter.lorebook;
      setLoreEntries(Array.isArray(lore) ? lore : []);
    } catch {
      setLoreEntries([]);
    }
    setSuccessMsg(`Forked "${forkFromCharacter.name}"! Customize any field and publish your own version.`);
  }, [forkFromCharacter]);

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

  // Tag search query
  const [tagSearch, setTagSearch] = useState('');

  // URL Importer State
  const [importUrl, setImportUrl] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);

  // Status
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [testingVoice, setTestingVoice] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

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
        body: JSON.stringify({ url: importUrl.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to import character from URL');
      }

      const { character: imported, source } = await res.json();

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
      setLoreEntries(imported.lorebook || []);

      setSuccessMsg(
        `Successfully imported "${imported.name}" from ${source.toUpperCase()}! You can now edit and publish.`
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

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
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

  // Lorebook helpers
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
    if (testingVoice && audioElement) {
      audioElement.pause();
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
        }),
      });

      if (!res.ok) throw new Error('TTS voice generation failed');
      const data = await res.json();
      const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
      setAudioElement(audio);

      audio.onended = () => setTestingVoice(false);
      audio.onerror = () => setTestingVoice(false);
      await audio.play();
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

      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        throw new Error(errorData.error || 'Failed to create character');
      }

      const data = await res.json();
      onCharacterCreated(data.character);
    } catch (err: any) {
      setErrorMsg(err.message || 'Creation failed');
    } finally {
      setSaving(false);
    }
  };

  const filteredAllTags = CHUB_ALL_TAGS.filter((t) =>
    t.toLowerCase().includes(tagSearch.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Top Title & Import Banner */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-purple-900/40 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 flex items-center gap-2">
            <span>Character Studio</span>
            <span className="rounded-lg bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300 border border-purple-500/30 font-semibold">
              Chub.ai &amp; Tavern V2 Spec
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
            type="url"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
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
            onClick={() => setImportUrl('https://janitorai.com/characters/68b75f5b-9ffb-4be8-897f-4428bdf0f031_character-peppa-pig-multiverse')}
            className="rounded-lg bg-zinc-900 px-2 py-1 hover:bg-zinc-800 text-pink-300 transition-colors border border-zinc-800"
          >
            🐷 JanitorAI: Peppa Pig Multiverse
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
            onClick={() => setImportUrl('https://spicychat.ai/characters/chub-valerie-mercenary')}
            className="rounded-lg bg-zinc-900 px-2 py-1 hover:bg-zinc-800 text-amber-300 transition-colors border border-zinc-800"
          >
            ⚔️ SpicyChat: Valerie Combat
          </button>
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
            <div className="relative aspect-[3/4] w-40 overflow-hidden rounded-2xl border-2 border-purple-500/60 shadow-lg mb-2.5 bg-zinc-900 group">
              {model3dUrl ? (
                <ThreeAvatarViewer
                  characterName={name || 'Character'}
                  avatarUrl={avatar}
                  currentPose={model3dPose}
                  className="h-full w-full"
                />
              ) : (
                <img
                  src={avatar}
                  alt="Avatar Preview"
                  className="h-full w-full object-cover object-top"
                />
              )}

              {/* Direct File Upload Overlay Button (Any file accepted) */}
              <label className="absolute bottom-2 right-2 rounded-xl bg-black/70 border border-white/20 p-2 text-white hover:bg-black/90 cursor-pointer backdrop-blur-md shadow-md transition-all">
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
                type="url"
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
                  Stage / Background Image URL (Optional)
                </label>
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
              <div className="flex gap-2">
                <input
                  type="url"
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

            {/* Voice & TTS Configuration */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Volume2 className="h-4 w-4" />
                  Voice Persona (Gemini 3.8 Flash TTS)
                </span>
                <button
                  type="button"
                  onClick={handleTestVoice}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border ${
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

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVoiceName(v)}
                    className={`rounded-xl border py-1.5 text-xs font-semibold transition-all ${
                      voiceName === v
                        ? 'border-amber-400/80 bg-amber-500/20 text-amber-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {v}
                  </button>
                ))}
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

        {/* Chub All Tags Selector */}
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
                Chub.ai Tag Taxonomy ({selectedTags.length} selected)
              </label>
              <p className="text-xs text-zinc-400 mt-0.5">
                Select tags to help other users discover your character in the Palace.
              </p>
            </div>

            {/* Quick Tag Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Filter 50+ tags..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
            {filteredAllTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${
                    isSelected
                      ? 'border-purple-500 bg-purple-500/20 text-purple-200 shadow-sm'
                      : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lorebook Trigger Entries */}
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                <span>World Lorebook / Trigger Entries</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Dynamic knowledge injected when keywords appear during conversation
              </p>
            </div>
            <button
              type="button"
              onClick={addLoreEntry}
              className="flex items-center gap-1 rounded-xl bg-purple-600/30 border border-purple-500/50 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-600/50 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Lore Key</span>
            </button>
          </div>

          {loreEntries.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-2">
              No lorebook entries added yet. Click &quot;Add Lore Key&quot; to define kingdoms, factions, or spells.
            </p>
          ) : (
            <div className="space-y-3">
              {loreEntries.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 items-start"
                >
                  <input
                    type="text"
                    value={entry.key}
                    onChange={(e) => updateLoreEntry(idx, e.target.value, entry.content)}
                    placeholder="Keyword / Trigger (e.g. Citadel)"
                    className="w-full sm:w-48 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={entry.content}
                    onChange={(e) => updateLoreEntry(idx, entry.key, e.target.value)}
                    placeholder="Lore information injected when trigger is mentioned..."
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeLoreEntry(idx)}
                    className="p-2 text-zinc-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
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
        <div className="flex items-center justify-end gap-3 pt-4">
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
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving to Cloud SQL...' : 'Create & Publish Character'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
