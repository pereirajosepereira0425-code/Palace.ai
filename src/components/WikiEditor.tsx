import React, { useState, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Palette,
  Eye,
  Code,
  Sparkles,
  Table,
  Columns,
  Check,
  X,
  Music,
  List,
  ListOrdered,
  Quote,
  Highlighter,
  SlidersHorizontal,
  ChevronDown,
  AlertTriangle,
  FolderPlus,
  Hash,
  CornerDownLeft,
  FileCode,
  BookOpen,
} from 'lucide-react';
import { renderWikiMarkup } from '../utils/characterUtils.ts';

interface WikiEditorProps {
  value: string;
  onChange: (val: string) => void;
  label: string;
  description?: string;
  placeholder?: string;
  rows?: number;
  characterName?: string;
}

const FONT_OPTIONS = [
  { name: 'Default Wiki Font', value: '' },
  { name: '🐷 Comic Sans (Peppa Fanon)', value: "'Comic Sans MS', cursive, sans-serif" },
  { name: '👻 Creepypasta / Cursed', value: "'Impact', 'Arial Black', sans-serif" },
  { name: '📜 Georgia (Grimoire / Serif)', value: "'Georgia', serif" },
  { name: '📟 Courier New (Terminal / Log)', value: "'Courier New', monospace" },
  { name: '🏰 Gothic / Old English Style', value: "'Palatino Linotype', 'Book Antiqua', serif" },
  { name: '💥 Impact (Meme / Headline)', value: "'Impact', sans-serif" },
  { name: '🏺 Papyrus (Ancient Puddle Relic)', value: "'Papyrus', fantasy" },
  { name: '🌐 Trebuchet MS (Classic Vector)', value: "'Trebuchet MS', sans-serif" },
];

const SIZE_OPTIONS = [
  { name: 'Size (Normal 100%)', value: '' },
  { name: 'Tiny (70%)', value: '70%' },
  { name: 'Small (85%)', value: '85%' },
  { name: 'Medium-Large (120%)', value: '120%' },
  { name: 'Large (150%)', value: '150%' },
  { name: 'Huge / Title (200%)', value: '200%' },
  { name: 'Colossal / Boss (300%)', value: '300%' },
];

const COLOR_OPTIONS = [
  { name: 'Default', value: '' },
  { name: 'Purple', value: '#c084fc', class: 'text-purple-400' },
  { name: 'Gold / Amber', value: '#fbbf24', class: 'text-amber-400' },
  { name: 'Crimson / Blood', value: '#f87171', class: 'text-rose-400' },
  { name: 'Emerald', value: '#34d399', class: 'text-emerald-400' },
  { name: 'Sky Blue', value: '#38bdf8', class: 'text-sky-400' },
  { name: 'Fuchsia / Peppa Pink', value: '#f472b6', class: 'text-pink-400' },
  { name: 'Eldritch Void', value: '#a855f7', class: 'text-purple-500' },
];

const SPECIAL_TOKENS = [
  { label: '{{}}', before: '{{', after: '}}', sample: 'Template' },
  { label: '[[]]', before: '[[', after: ']]', sample: 'WikiPage|Label' },
  { label: '|', before: ' | ', after: '', sample: '' },
  { label: "'''Bold'''", before: "'''", after: "'''", sample: 'bold' },
  { label: "''Italic''", before: "''", after: "''", sample: 'italic' },
  { label: '==Section==', before: '\n== ', after: ' ==\n', sample: 'Section Title' },
  { label: '===Sub===', before: '\n=== ', after: ' ===\n', sample: 'Sub-section' },
  { label: '----', before: '\n----\n', after: '', sample: '' },
  { label: '<ref>', before: '<ref>', after: '</ref>', sample: 'Citation info' },
  { label: '<gallery>', before: '\n<gallery mode="packed" heights="140">\nFile:Peppa.png|Caption\n</gallery>\n', after: '', sample: '' },
  { label: '<nowiki>', before: '<nowiki>', after: '</nowiki>', sample: 'code' },
  { label: '<br />', before: '<br />', after: '', sample: '' },
  { label: '<!-- -->', before: '<!-- ', after: ' -->', sample: 'editor note' },
  { label: '☠️', before: '☠️', after: '', sample: '' },
  { label: '★', before: '★', after: '', sample: '' },
  { label: '☆', before: '☆', after: '', sample: '' },
  { label: '⚔️', before: '⚔️', after: '', sample: '' },
  { label: '🛡️', before: '🛡️', after: '', sample: '' },
  { label: '🩸', before: '🩸', after: '', sample: '' },
  { label: '🐷', before: '🐷', after: '', sample: '' },
  { label: '👑', before: '👑', after: '', sample: '' },
  { label: '§', before: '§', after: '', sample: '' },
  { label: '—', before: '—', after: '', sample: '' },
];

export const WikiEditor: React.FC<WikiEditorProps> = ({
  value,
  onChange,
  label,
  description,
  placeholder,
  rows = 7,
  characterName = 'Character',
}) => {
  const [viewMode, setViewMode] = useState<'source' | 'preview' | 'split'>('source');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [editSummary, setEditSummary] = useState('');

  // Image modal state
  const [imgUrl, setImgUrl] = useState('');
  const [imgCaption, setImgCaption] = useState('');
  const [imgWidth, setImgWidth] = useState('280px');
  const [imgAlign, setImgAlign] = useState<'left' | 'center' | 'right'>('center');

  // File modal state
  const [fileTitle, setFileTitle] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileType, setFileType] = useState('Theme Audio');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper to insert wikitext at current cursor position
  const insertSyntax = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value + before + defaultText + after);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end) || defaultText;
    const replacement = before + selected + after;

    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selected.length
      );
    }, 10);
  };

  // Font family handler
  const handleApplyFont = (fontFamily: string) => {
    if (!fontFamily) return;
    insertSyntax(`<span style="font-family: ${fontFamily};">`, '</span>', 'Sample text');
  };

  // Font size handler
  const handleApplySize = (fontSize: string) => {
    if (!fontSize) return;
    insertSyntax(`<span style="font-size: ${fontSize};">`, '</span>', 'Resized text');
  };

  // Heading selector handler (MediaWiki == == syntax)
  const handleApplyHeading = (level: string) => {
    switch (level) {
      case 'h1':
        insertSyntax('\n= ', ' =\n', 'Page Title (Level 1)');
        break;
      case 'h2':
        insertSyntax('\n== ', ' ==\n', 'Section (Level 2)');
        break;
      case 'h3':
        insertSyntax('\n=== ', ' ===\n', 'Sub-section (Level 3)');
        break;
      case 'h4':
        insertSyntax('\n==== ', ' ====\n', 'Minor Section (Level 4)');
        break;
      case 'h5':
        insertSyntax('\n===== ', ' =====\n', 'Sub-minor Section (Level 5)');
        break;
      default:
        break;
    }
  };

  // Color Swatch handler
  const handleApplyColor = (colorHex: string) => {
    if (!colorHex) return;
    insertSyntax(`<span style="color: ${colorHex};">`, '</span>', 'Colored text');
    setShowColorMenu(false);
  };

  // Local Image File upload
  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImgUrl(dataUrl);
      if (!imgCaption) setImgCaption(file.name.replace(/\.[^/.]+$/, ''));
    };
    reader.readAsDataURL(file);
  };

  // Commit Image Insert
  const handleConfirmInsertImage = () => {
    if (!imgUrl.trim()) return;
    if (imgUrl.startsWith('data:image') || imgUrl.startsWith('http') || imgUrl.startsWith('/')) {
      const imageWikitext = `\n<div align="${imgAlign}">\n  <img src="${imgUrl}" alt="${imgCaption || 'Image'}" width="${imgWidth}" style="border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.5);" />\n  ${imgCaption ? `<p><em>${imgCaption}</em></p>` : ''}\n</div>\n`;
      insertSyntax(imageWikitext);
    } else {
      const fileWikitext = `\n<div style="background: rgba(24, 24, 27, 0.85); border: 1px solid rgba(168, 85, 247, 0.4); padding: 8px 12px; border-radius: 12px; margin: 8px 0; display: inline-flex; align-items: center; gap: 8px;">\n  <span>📎 <strong>Attached File:</strong> <a href="${imgUrl}" download="${imgCaption || 'attachment'}" style="color: #c084fc; text-decoration: underline;">${imgCaption || 'Download File'}</a></span>\n</div>\n`;
      insertSyntax(fileWikitext);
    }
    setShowImageModal(false);
    setImgUrl('');
    setImgCaption('');
  };

  // Local File / Any Attachment upload
  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileTitle(file.name);
    if (file.type.startsWith('audio/')) setFileType('Theme Audio');
    else if (file.type.startsWith('video/')) setFileType('Video Clip');
    else if (file.type.startsWith('image/')) setFileType('Embedded Image');
    else setFileType('Document / Any File');

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmInsertFile = () => {
    if (!fileTitle.trim()) return;
    let snippet = '';
    if ((fileType === 'Theme Audio' || fileUrl.startsWith('data:audio')) && fileUrl) {
      snippet = `\n<div class="audio-badge" style="background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.4); padding: 8px 12px; border-radius: 12px; margin: 8px 0; display: inline-flex; align-items: center; gap: 8px;">\n  <span>🎵 <strong>Theme Audio:</strong> ${fileTitle}</span>\n  <audio controls src="${fileUrl}" style="height: 28px; max-width: 220px;"></audio>\n</div>\n`;
    } else if ((fileType === 'Video Clip' || fileUrl.startsWith('data:video')) && fileUrl) {
      snippet = `\n<div style="margin: 10px 0;"><video controls src="${fileUrl}" style="max-width: 100%; max-height: 280px; border-radius: 12px;"></video><p style="font-size: 11px; color: #d4d4d8;">🎬 ${fileTitle}</p></div>\n`;
    } else if ((fileType === 'Embedded Image' || fileUrl.startsWith('data:image')) && fileUrl) {
      snippet = `\n<div align="center"><img src="${fileUrl}" alt="${fileTitle}" width="300px" style="border-radius: 12px;" /><p><em>${fileTitle}</em></p></div>\n`;
    } else if (fileUrl) {
      snippet = `\n<div style="background: rgba(24, 24, 27, 0.85); border: 1px solid rgba(168, 85, 247, 0.4); padding: 8px 12px; border-radius: 12px; margin: 8px 0; display: inline-flex; align-items: center; gap: 8px;">\n  <span>📁 <strong>Attached File:</strong> <a href="${fileUrl}" download="${fileTitle}" style="color: #c084fc; text-decoration: underline;">${fileTitle}</a></span>\n</div>\n`;
    } else {
      snippet = `\n<div style="background: rgba(24, 24, 27, 0.8); border: 1px solid rgba(63, 63, 70, 0.8); padding: 8px 12px; border-radius: 12px; margin: 8px 0; display: inline-flex; align-items: center; gap: 8px;">\n  <span>📁 <strong>File:</strong> ${fileTitle}</span>\n</div>\n`;
    }
    insertSyntax(snippet);
    setShowFileModal(false);
    setFileTitle('');
    setFileUrl('');
  };

  // Peppa Pig Fanon Wiki Infobox Template
  const insertPeppaFanonInfobox = () => {
    const template = `\n{| class="wikitable fandom-infobox" style="float: right; margin-left: 16px; margin-bottom: 16px; width: 300px; background: rgba(24, 24, 27, 0.95); border: 2px solid #ec4899; border-radius: 16px; overflow: hidden; font-size: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);"
|- style="background: linear-gradient(135deg, #db2777, #be123c); color: #ffffff; text-align: center; font-weight: bold; font-size: 15px;"
! colspan="2" | ${characterName || 'Character Profile'} (Fanon)
|-
| colspan="2" style="text-align: center; padding: 8px; background: #09090b;" | [[File:Avatar | 240px | thumb | center]]
|- style="background: rgba(236, 72, 153, 0.25); font-weight: bold; text-align: center;"
! colspan="2" | General Information
|-
| '''Full Name''' || ${characterName || 'Unknown Hero'}
|-
| '''Aliases''' || The Mud Pioneer, Empress of Puddles
|-
| '''Species / Origin''' || Porcine Sovereign / Peppa Fanon Miraheze
|-
| '''Alignment''' || Chaotic Good / Heroic
|-
| '''Weapon / Artifact''' || Golden Mud Boots of Destiny
|- style="background: rgba(236, 72, 153, 0.25); font-weight: bold; text-align: center;"
! colspan="2" | Powers & Combat Statistics
|-
| '''Special Abilities''' || Mud Deluge, Super Sonic Snort, Royal Decree
|-
| '''Power Tier''' || ★★★★★ (Infinite Puddle Resonance)
|-
| '''Likes''' || Muddy puddles, royal banquets, dramatic monologues
|-
| '''Dislikes''' || Soap, dry seasons, uninvited wolves
|-
| '''Status''' || Active in Palace.ai
|}\n`;
    insertSyntax(template);
    setShowTemplateMenu(false);
  };

  // Dandy's World Creepypasta Entity Log Template (Nextor,wƴx style)
  const insertDandysWorldCreepypastaLog = () => {
    const template = `\n== Anomaly Log: Entity Encounter ==
{{Warning|CONFIDENTIAL CREEPYPASTA LOG: Unregistered Toon Entity Detected. Viewing this document requires Level 4 clearance.}}

{| class="wikitable creepypasta-log" style="width: 100%; border-collapse: collapse; margin: 12px 0; background: rgba(15, 15, 18, 0.95); border: 2px solid #ef4444; border-radius: 12px; font-size: 12px;"
|- style="background: linear-gradient(135deg, #7f1d1d, #991b1b); color: #fecaca; font-weight: bold;"
! colspan="2" | DANDY'S WORLD CORRUPTED LOG: ${characterName || 'NEXTOR, WƳX'}
|-
| '''Entity Classification''' || Anomalous Toon / Corrupted Variant
|-
| '''Threat Level''' || ☠️ S-TIER (Severe Reality Distortion)
|-
| '''Origin Level''' || Sub-Floor -99 / The Forgotten Elevators
|-
| '''Distinguishing Marks''' || Glitched optical seams, inverted mouth, shadowy halo
|-
| '''Audio Signature''' || Reverse chromatic laughter, static audio bursts
|-
| '''Containment Protocol''' || Do not engage with normal Ichor extractors. Maintain eye contact while backing away.
|}

=== Observation Records ===
<gallery mode="packed" heights="120">
File:Encounter_Cam1.png|First elevator sighting (Floor -14)
File:Audio_Waveform.png|Distorted vocal frequencies
</gallery>

{{Quote|You thought the elevator would save you? Every floor you descend belongs to me.|${characterName || 'Nextor'}}}
`;
    insertSyntax(template);
    setShowTemplateMenu(false);
  };

  // Combat Attributes Table
  const insertStatsTable = () => {
    const template = `\n{| class="wikitable stats-table" style="width: 100%; border-collapse: collapse; margin: 12px 0; background: rgba(18, 18, 23, 0.85); border: 1px solid #3f3f46; border-radius: 12px; overflow: hidden; font-size: 12px;"
|- style="background: rgba(147, 51, 234, 0.25); text-align: left;"
! Attribute !! Rating !! Technique / Fanon Notes
|-
| '''Combat Power''' || ★★★★☆ (4/5) || Devastating close-range melee techniques
|-
| '''Agility & Speed''' || ★★★★★ (5/5) || Sub-second reflex neural implants
|-
| '''Intelligence''' || ★★★★☆ (4/5) || Master tactician and cryptographer
|-
| '''Durability''' || ★★★☆☆ (3/5) || Kinetic dampening energy barrier
|-
| '''Charisma''' || ★★★★☆ (4/5) || Theatrical Shakespearean dialogue cadence
|}\n`;
    insertSyntax(template);
    setShowTemplateMenu(false);
  };

  return (
    <div className="rounded-3xl border border-zinc-800/90 bg-zinc-950/80 backdrop-blur-md overflow-hidden shadow-2xl">
      {/* Top Header: Miraheze / Fandom Identity & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-3 bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-purple-950/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-pink-400" />
              <span>{label}</span>
            </span>
            <span className="rounded-md bg-pink-950/60 border border-pink-500/30 px-2 py-0.5 text-[9px] font-bold text-pink-300">
              peppafanon.miraheze.org
            </span>
            <span className="rounded-md bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 text-[9px] font-bold text-purple-300">
              ?veaction=editsource
            </span>
          </div>
          {description && (
            <p className="text-[11px] text-zinc-400 mt-0.5">{description}</p>
          )}
        </div>

        {/* View Mode Tabs (Visual, Source, Preview, Split) */}
        <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('source')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
              viewMode === 'source'
                ? 'bg-purple-600/40 text-purple-200 border border-purple-500/50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Edit Raw Wikitext / Source Code (veaction=editsource)"
          >
            <FileCode className="h-3 w-3 text-purple-400" />
            <span>Edit Source</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
              viewMode === 'preview'
                ? 'bg-purple-600/40 text-purple-200 border border-purple-500/50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="View Rendered Fandom Wiki Page"
          >
            <Eye className="h-3 w-3 text-pink-400" />
            <span>Wiki Preview</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`hidden md:flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
              viewMode === 'split'
                ? 'bg-purple-600/40 text-purple-200 border border-purple-500/50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Side-by-side Live Editor & Preview"
          >
            <Columns className="h-3 w-3 text-amber-400" />
            <span>Split View</span>
          </button>
        </div>
      </div>

      {/* Main Wiki Toolbar (Row 1: Fonts, Sizes, Inline, Inserts, Advanced Toggle) */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800/80 bg-zinc-900/50 px-3 py-2 text-xs">
        {/* Font Family Selector (Peppa Fanon / Comic Sans / Creepypasta) */}
        <select
          onChange={(e) => {
            handleApplyFont(e.target.value);
            e.target.value = '';
          }}
          defaultValue=""
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-zinc-300 focus:outline-none focus:border-pink-500 cursor-pointer"
          title="Font Family (Peppa Fanon Comic Sans, Creepypasta, Gothic)"
        >
          <option value="" disabled>
            Font Family...
          </option>
          {FONT_OPTIONS.map((f) => (
            <option key={f.name} value={f.value}>
              {f.name}
            </option>
          ))}
        </select>

        {/* Text Size Selector */}
        <select
          onChange={(e) => {
            handleApplySize(e.target.value);
            e.target.value = '';
          }}
          defaultValue=""
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer"
          title="Text Size (70% to 300%)"
        >
          <option value="" disabled>
            Text Size...
          </option>
          {SIZE_OPTIONS.map((s) => (
            <option key={s.name} value={s.value}>
              {s.name}
            </option>
          ))}
        </select>

        {/* MediaWiki Heading Selector */}
        <select
          onChange={(e) => {
            handleApplyHeading(e.target.value);
            e.target.value = '';
          }}
          defaultValue=""
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer"
          title="MediaWiki Headings (== Section ==)"
        >
          <option value="" disabled>
            Heading...
          </option>
          <option value="h1">Page Title (= Level 1 =)</option>
          <option value="h2">Section (== Level 2 ==)</option>
          <option value="h3">Sub-section (=== Level 3 ===)</option>
          <option value="h4">Minor Section (==== Level 4 ====)</option>
          <option value="h5">Sub-minor (===== Level 5 =====)</option>
        </select>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {/* Standard Inline Styling */}
        <button
          type="button"
          onClick={() => insertSyntax("'''", "'''", 'bold text')}
          className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          title="Bold ('''text''')"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => insertSyntax("''", "''", 'italic text')}
          className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          title="Italic (''text'')"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => insertSyntax('<u>', '</u>', 'underlined text')}
          className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          title="Underline (<u>text</u>)"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => insertSyntax('<del>', '</del>', 'struck-through text')}
          className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          title="Strikethrough (<del>text</del>)"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => insertSyntax('<mark>', '</mark>', 'highlighted text')}
          className="rounded-lg p-1.5 text-amber-400 hover:bg-zinc-800 hover:text-amber-300 transition-colors"
          title="Highlight / Mark"
        >
          <Highlighter className="h-3.5 w-3.5" />
        </button>

        {/* Color Palette Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorMenu(!showColorMenu)}
            className="flex items-center gap-1 rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            title="Text & Highlight Color"
          >
            <Palette className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-[10px] hidden sm:inline">Color</span>
          </button>

          {showColorMenu && (
            <div className="absolute left-0 top-full mt-1 z-30 flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl min-w-[175px]">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => handleApplyColor(c.value)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-zinc-900 transition-colors"
                >
                  <span
                    className="h-3 w-3 rounded-full border border-zinc-700"
                    style={{ backgroundColor: c.value || '#ffffff' }}
                  />
                  <span className={c.class || 'text-zinc-200'}>{c.name}</span>
                </button>
              ))}
              <div className="border-t border-zinc-800 my-1 pt-1.5 px-1 space-y-1.5">
                <label className="flex items-center justify-between gap-2 text-[11px] text-zinc-300 cursor-pointer">
                  <span>Custom Color</span>
                  <input
                    type="color"
                    defaultValue="#ff4d6d"
                    onChange={(e) => handleApplyColor(e.target.value)}
                    className="h-5 w-8 cursor-pointer rounded border border-zinc-700 bg-transparent p-0"
                    aria-label="Pick custom text color"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    insertSyntax('<span style="background-color: rgba(236, 72, 153, 0.25); color: #fbcfe8; padding: 1px 6px; border-radius: 4px;">', '</span>', 'Highlighted text');
                    setShowColorMenu(false);
                  }}
                  className="w-full rounded-lg bg-pink-950/50 border border-pink-500/30 px-2 py-1 text-left text-[11px] text-pink-200 hover:bg-pink-900/50 transition-colors"
                >
                  ✨ Pink Highlight Badge
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {/* Insert Image & File Modal Buttons */}
        <button
          type="button"
          onClick={() => setShowImageModal(true)}
          className="flex items-center gap-1 rounded-lg border border-pink-500/30 bg-pink-950/30 px-2 py-1 text-[11px] font-semibold text-pink-300 hover:bg-pink-900/40 transition-colors"
          title="Insert / Upload Image"
        >
          <ImageIcon className="h-3.5 w-3.5 text-pink-400" />
          <span>Insert Image</span>
        </button>

        <button
          type="button"
          onClick={() => setShowFileModal(true)}
          className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
          title="Insert File / Audio Theme"
        >
          <Upload className="h-3.5 w-3.5 text-amber-400" />
          <span>File / Audio</span>
        </button>

        {/* Fandom Wiki Templates Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTemplateMenu(!showTemplateMenu)}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/40 px-2.5 py-1 text-[11px] font-bold text-purple-200 hover:from-purple-600/50 hover:to-pink-600/50 transition-all"
            title="Wiki Templates (Peppa Fanon Infobox, Dandy's World Creepypasta Log, Stats Table)"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Templates</span>
          </button>

          {showTemplateMenu && (
            <div className="absolute right-0 sm:left-0 top-full mt-1 z-30 flex flex-col gap-1 rounded-2xl border border-purple-500/40 bg-zinc-950 p-2 shadow-2xl min-w-[240px]">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-pink-400">
                Peppa Fanon &bull; Fandom Blocks
              </div>

              <button
                type="button"
                onClick={insertPeppaFanonInfobox}
                className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold text-zinc-200 hover:bg-pink-950/40 hover:text-white transition-colors"
              >
                <Table className="h-3.5 w-3.5 text-pink-400" />
                <div>
                  <div>Peppa Fanon Character Infobox</div>
                  <div className="text-[10px] text-zinc-500 font-normal">Miraheze profile sidebar card</div>
                </div>
              </button>

              <button
                type="button"
                onClick={insertDandysWorldCreepypastaLog}
                className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold text-zinc-200 hover:bg-rose-950/40 hover:text-white transition-colors"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                <div>
                  <div>Dandy&apos;s World Creepypasta Log</div>
                  <div className="text-[10px] text-zinc-500 font-normal">Nextor,wƴx style entity anomaly</div>
                </div>
              </button>

              <button
                type="button"
                onClick={insertStatsTable}
                className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold text-zinc-200 hover:bg-purple-950/40 hover:text-white transition-colors"
              >
                <Table className="h-3.5 w-3.5 text-amber-400" />
                <div>
                  <div>Attributes &amp; Stats Table</div>
                  <div className="text-[10px] text-zinc-500 font-normal">Power, Agility, Intelligence</div>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {/* ADVANCED MODE TOGGLE (Mirroring MediaWiki / Fandom "Advanced" Dropdown) */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all border ${
            showAdvanced
              ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
              : 'border-zinc-800 bg-zinc-950 text-purple-300 hover:bg-zinc-900'
          }`}
          title="Toggle Advanced Mode Toolbar (Fandom veaction=editsource)"
        >
          <SlidersHorizontal className="h-3 w-3" />
          <span>Advanced</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Row 2: Advanced Toolbar (Revealed in Advanced Mode) */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-purple-500/30 bg-purple-950/20 px-3 py-2 text-xs animate-in fade-in">
          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mr-1">
            Advanced:
          </span>

          {/* Superscript & Subscript */}
          <button
            type="button"
            onClick={() => insertSyntax('<sup>', '</sup>', '2')}
            className="rounded-lg px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-mono text-[11px]"
            title="Superscript (x²)"
          >
            x²
          </button>

          <button
            type="button"
            onClick={() => insertSyntax('<sub>', '</sub>', '2')}
            className="rounded-lg px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-mono text-[11px]"
            title="Subscript (x₂)"
          >
            x₂
          </button>

          {/* Internal Wiki Link */}
          <button
            type="button"
            onClick={() => insertSyntax('[[', ']]', 'Page Name|Label')}
            className="flex items-center gap-1 rounded-lg px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px]"
            title="Wiki Internal Link [[Page|Label]]"
          >
            <LinkIcon className="h-3 w-3 text-purple-400" />
            <span>[[]] Link</span>
          </button>

          {/* Picture Gallery */}
          <button
            type="button"
            onClick={() => insertSyntax('\n<gallery mode="packed" heights="140">\nFile:Peppa_God.png|Lord Baconus in full regalia\nFile:Nextor_Cursed.png|Corrupted sighting\n</gallery>\n')}
            className="flex items-center gap-1 rounded-lg px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px]"
            title="MediaWiki Gallery (<gallery>)"
          >
            <ImageIcon className="h-3 w-3 text-pink-400" />
            <span>&lt;gallery&gt;</span>
          </button>

          {/* Callout Quote */}
          <button
            type="button"
            onClick={() => insertSyntax('{{Quote|', `|${characterName || 'Author'}}}`, 'Quote text here')}
            className="flex items-center gap-1 rounded-lg px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px]"
            title="Callout Quote ({{Quote|...|Author}})"
          >
            <Quote className="h-3 w-3 text-amber-400" />
            <span>&#123;&#123;Quote&#125;&#125;</span>
          </button>

          {/* Creepypasta / Fanon Warning Banner */}
          <button
            type="button"
            onClick={() => insertSyntax('{{Warning|', '}}', 'Dandy\'s World Anomaly: Corrupted Toon Alert')}
            className="flex items-center gap-1 rounded-lg px-2 py-1 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-500/40 text-[11px] font-semibold"
            title="Warning Banner ({{Warning|...}})"
          >
            <AlertTriangle className="h-3 w-3 text-rose-400" />
            <span>&#123;&#123;Warning&#125;&#125;</span>
          </button>

          {/* Category Tag */}
          <button
            type="button"
            onClick={() => insertSyntax('\n[[Category:', ']]\n', 'Peppa Fanon Lore')}
            className="flex items-center gap-1 rounded-lg px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px]"
            title="Category Tag [[Category:Name]]"
          >
            <FolderPlus className="h-3 w-3 text-emerald-400" />
            <span>Category</span>
          </button>

          {/* No Wiki Formatting */}
          <button
            type="button"
            onClick={() => insertSyntax('<nowiki>', '</nowiki>', 'raw text')}
            className="rounded-lg px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px] font-mono"
            title="Escape Wiki Formatting (<nowiki>)"
          >
            &lt;nowiki&gt;
          </button>

          {/* Horizontal Line ---- */}
          <button
            type="button"
            onClick={() => insertSyntax('\n----\n')}
            className="rounded-lg px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px]"
            title="Horizontal Divider (----)"
          >
            Divider (----)
          </button>
        </div>
      )}

      {/* Editor Main Content Area */}
      {viewMode === 'source' && (
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'Write your character details here in MediaWiki or Markdown...'}
            className="w-full bg-zinc-950 p-4 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none font-mono leading-relaxed"
          />
        </div>
      )}

      {viewMode === 'preview' && (
        <div className="min-h-[180px] max-h-[500px] overflow-y-auto bg-zinc-900/40 p-4">
          {value.trim() ? (
            <div
              className="wiki-rendered-content text-zinc-100 text-xs sm:text-sm prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: renderWikiMarkup(value, characterName) }}
            />
          ) : (
            <p className="text-zinc-500 italic p-6 text-center text-xs">
              No content written yet. Use the Miraheze / Fandom formatting toolbar above or write in Wikitext to preview!
            </p>
          )}
        </div>
      )}

      {viewMode === 'split' && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
          <textarea
            ref={textareaRef}
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-zinc-950 p-4 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none font-mono leading-relaxed resize-none"
          />
          <div className="max-h-[380px] overflow-y-auto bg-zinc-900/40 p-4">
            {value.trim() ? (
              <div
                className="wiki-rendered-content text-zinc-100 text-xs sm:text-sm prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: renderWikiMarkup(value, characterName) }}
              />
            ) : (
              <p className="text-zinc-500 italic p-4 text-center text-xs">Live Wiki Preview</p>
            )}
          </div>
        </div>
      )}

      {/* SPECIAL CHARACTERS / SYMBOLS TRAY (Authentic Fandom editsource character bar) */}
      <div className="border-t border-zinc-800/80 bg-zinc-950 px-3 py-1.5 flex flex-wrap items-center gap-1 text-[11px]">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mr-1">
          Insert:
        </span>
        {SPECIAL_TOKENS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => insertSyntax(t.before, t.after, t.sample)}
            className="rounded px-1.5 py-0.5 bg-zinc-900/80 hover:bg-purple-900/40 hover:text-purple-200 text-zinc-400 border border-zinc-800 font-mono text-[10px] transition-colors"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bottom Summary Bar (Like Miraheze / MediaWiki Edit Summary) */}
      <div className="border-t border-zinc-800/60 bg-zinc-900/30 px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-zinc-400 shrink-0">Summary:</span>
          <input
            type="text"
            value={editSummary}
            onChange={(e) => setEditSummary(e.target.value)}
            placeholder="Briefly describe your edits (e.g. Added Peppa Fanon infobox, stats table, or anomaly log)..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'preview' ? 'source' : 'preview')}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            {viewMode === 'preview' ? 'Show Source' : 'Show Preview'}
          </button>
        </div>
      </div>

      {/* Insert Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-pink-500/40 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-pink-400" />
                <span>Insert / Embed Image (Fandom &amp; Miraheze)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Image URL or Direct Link
                </label>
                <input
                  type="url"
                  value={imgUrl}
                  onChange={(e) => setImgUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or paste image URL"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Or Upload Local File (Any File Accepted)
                </label>
                <input
                  type="file"
                  accept="*/*"
                  onChange={handleLocalImageUpload}
                  className="w-full text-xs text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-pink-900/40 file:text-pink-300 file:font-semibold hover:file:bg-pink-800/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Caption</label>
                  <input
                    type="text"
                    value={imgCaption}
                    onChange={(e) => setImgCaption(e.target.value)}
                    placeholder="e.g. Royal Golden Boots"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-100 placeholder-zinc-600 focus:border-pink-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Display Width</label>
                  <select
                    value={imgWidth}
                    onChange={(e) => setImgWidth(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-100 focus:border-pink-500 focus:outline-none"
                  >
                    <option value="200px">Thumbnail (200px)</option>
                    <option value="280px">Medium (280px)</option>
                    <option value="450px">Large (450px)</option>
                    <option value="100%">Full Width (100%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Alignment</label>
                <div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">
                  {(['left', 'center', 'right'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setImgAlign(a)}
                      className={`flex-1 rounded-lg py-1 font-semibold uppercase text-[10px] transition-all ${
                        imgAlign === a
                          ? 'bg-pink-600 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {imgUrl && (
                <div className="relative h-24 w-full overflow-hidden rounded-xl border border-pink-500/30">
                  <img src={imgUrl} alt="Preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInsertImage}
                disabled={!imgUrl.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-pink-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-pink-500 disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Embed Image</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insert File / Audio Modal */}
      {showFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-purple-500/40 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Music className="h-4 w-4 text-amber-400" />
                <span>Embed Media / Any File</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFileModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Item Title / File Name</label>
                <input
                  type="text"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  placeholder="e.g. Muddy Puddle Requiem - Peppa Fanon OST"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Attachment Type</label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-100 focus:border-purple-500 focus:outline-none"
                >
                  <option value="Theme Audio">Theme Audio (Plays in chat/profile)</option>
                  <option value="Video Clip">Video Clip</option>
                  <option value="Embedded Image">Embedded Image</option>
                  <option value="Document / Any File">Document / Lore / Any File</option>
                  <option value="Tavern V2 Spec">Tavern V2 Spec File</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Upload Any File (All Types Accepted)</label>
                <input
                  type="file"
                  accept="*/*"
                  onChange={handleLocalFileUpload}
                  className="w-full text-xs text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-purple-900/40 file:text-purple-300 file:font-semibold hover:file:bg-purple-800/40"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowFileModal(false)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInsertFile}
                disabled={!fileTitle.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Embed File</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
