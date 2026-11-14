import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Download,
  Upload,
  Save,
  Check,
  Sparkles,
  HelpCircle,
  Copy,
  Edit3,
} from 'lucide-react';

export interface LoreEntry {
  id: string;
  keys: string;
  secondaryKeys?: string;
  content: string;
  insertionOrder: number;
  enabled: boolean;
  constant: boolean;
  caseSensitive: boolean;
}

export interface SavedLorebook {
  id: string;
  name: string;
  description: string;
  scanDepth: number;
  entries: LoreEntry[];
  updatedAt: string;
}

export const LorebookStudio: React.FC = () => {
  const [editingLorebookId, setEditingLorebookId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savedLorebooks, setSavedLorebooks] = useState<SavedLorebook[]>(() => {
    try {
      const raw = localStorage.getItem('palace_saved_lorebooks');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [name, setName] = useState('New World Lorebook');
  const [description, setDescription] = useState('Comprehensive world info and lore triggers.');
  const [scanDepth, setScanDepth] = useState(4);
  const [entries, setEntries] = useState<LoreEntry[]>([
    {
      id: '1',
      keys: 'Neo-Veridia, Megalopolis',
      secondaryKeys: '',
      content: 'A high-vertical cyberpunk metropolis built on seven tectonic spires, ruled by the SynthGen syndicate.',
      insertionOrder: 100,
      enabled: true,
      constant: false,
      caseSensitive: false,
    },
    {
      id: '2',
      keys: 'Obsidian Citadel, Nightshade',
      secondaryKeys: '',
      content: 'The ancient gothic basalt fortress carved into Mount Umbra. Home to the vampire court of Malakor.',
      insertionOrder: 100,
      enabled: true,
      constant: false,
      caseSensitive: false,
    },
  ]);

  const [savedMsg, setSavedMsg] = useState('');

  const addEntry = () => {
    const newEntry: LoreEntry = {
      id: Math.random().toString(36).substring(2, 9),
      keys: '',
      secondaryKeys: '',
      content: '',
      insertionOrder: 100,
      enabled: true,
      constant: false,
      caseSensitive: false,
    };
    setEntries([...entries, newEntry]);
  };

  const updateEntry = (id: string, updates: Partial<LoreEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        setName(parsed.name || parsed.title || 'Imported Lorebook');
        setDescription(parsed.description || '');

        const importedEntries: LoreEntry[] = [];
        const rawEntries = parsed.entries || (parsed.character_book && parsed.character_book.entries) || [];

        for (const item of rawEntries) {
          const keysStr = Array.isArray(item.keys) ? item.keys.join(', ') : item.keys || item.key || '';
          importedEntries.push({
            id: Math.random().toString(36).substring(2, 9),
            keys: keysStr,
            secondaryKeys: Array.isArray(item.secondary_keys) ? item.secondary_keys.join(', ') : '',
            content: item.content || item.value || '',
            insertionOrder: item.insertion_order || 100,
            enabled: item.enabled !== false,
            constant: Boolean(item.constant),
            caseSensitive: Boolean(item.case_sensitive),
          });
        }

        if (importedEntries.length > 0) {
          setEntries(importedEntries);
        }

        setSavedMsg(`Imported ${importedEntries.length} lore entries successfully!`);
        setTimeout(() => setSavedMsg(''), 4000);
      } catch (err: any) {
        alert('Invalid lorebook JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleExportJson = () => {
    const exportData = {
      name,
      description,
      scan_depth: scanDepth,
      entries: entries.map((e, index) => ({
        keys: e.keys.split(',').map((k) => k.trim()).filter(Boolean),
        secondary_keys: e.secondaryKeys?.split(',').map((k) => k.trim()).filter(Boolean) || [],
        content: e.content,
        insertion_order: e.insertionOrder,
        enabled: e.enabled,
        constant: e.constant,
        case_sensitive: e.caseSensitive,
        id: index + 1,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_lorebook.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToBrowser = () => {
    const id = editingLorebookId || `lb_${Date.now()}`;
    const record: SavedLorebook = {
      id,
      name: name.trim() || 'Untitled Lorebook',
      description: description.trim(),
      scanDepth,
      entries,
      updatedAt: new Date().toISOString(),
    };
    const nextList = editingLorebookId
      ? savedLorebooks.map((lb) => (lb.id === id ? record : lb))
      : [record, ...savedLorebooks];
    setSavedLorebooks(nextList);
    setEditingLorebookId(id);
    localStorage.setItem('palace_saved_lorebooks', JSON.stringify(nextList));
    localStorage.setItem(
      'palace_active_lorebook',
      JSON.stringify({ name: record.name, description: record.description, entries })
    );
    setSavedMsg(editingLorebookId ? `Updated "${record.name}"!` : `Saved "${record.name}" to your Palace Lorebooks!`);
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const handleLoadForEdit = (lb: SavedLorebook) => {
    setEditingLorebookId(lb.id);
    setName(lb.name);
    setDescription(lb.description);
    setScanDepth(lb.scanDepth || 4);
    setEntries(lb.entries || []);
    setSavedMsg(`✏️ Editing "${lb.name}"`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartNewLorebook = () => {
    setEditingLorebookId(null);
    setName('New World Lorebook');
    setDescription('Comprehensive world info and lore triggers.');
    setScanDepth(4);
    setEntries([]);
  };

  const handleDeleteLorebook = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((curr) => (curr === id ? null : curr)), 3500);
      return;
    }
    setConfirmDeleteId(null);
    const nextList = savedLorebooks.filter((lb) => lb.id !== id);
    setSavedLorebooks(nextList);
    localStorage.setItem('palace_saved_lorebooks', JSON.stringify(nextList));
    if (editingLorebookId === id) {
      handleStartNewLorebook();
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Title & Import/Export Banner */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-purple-900/40 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 flex items-center gap-2">
            <span>Lorebook Studio</span>
            <span className="rounded-lg bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300 border border-purple-500/30 font-semibold">
              Chub &bull; World Info
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Build standalone lorebooks with trigger keywords, scan depth, and constant world rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-purple-500/40 bg-purple-950/30 px-3.5 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-900/40 transition-all shadow-sm">
            <Upload className="h-4 w-4" />
            <span>Import Lorebook</span>
            <input type="file" accept="*/*" onChange={handleImportJson} className="hidden" />
          </label>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-all"
          >
            <Download className="h-4 w-4 text-purple-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {savedMsg && (
        <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs font-semibold text-emerald-300 animate-in fade-in">
          {savedMsg}
        </div>
      )}

      {/* Meta Configuration Card */}
      <div className="mb-8 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
              Lorebook Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm font-semibold text-zinc-100 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
              Scan Depth (Messages)
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={scanDepth}
              onChange={(e) => setScanDepth(Number(e.target.value))}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm font-semibold text-zinc-100 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-200 focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Entries List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-400" />
            <span>Lorebook Entries ({entries.length})</span>
          </h2>

          <button
            onClick={addEntry}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600/30 border border-purple-500/50 px-3.5 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-600/50 transition-all shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add New Entry</span>
          </button>
        </div>

        <div className="space-y-4">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className={`rounded-2xl border p-4 space-y-3 transition-all backdrop-blur-md ${
                entry.enabled
                  ? 'border-zinc-800 bg-zinc-900/60'
                  : 'border-zinc-800/40 bg-zinc-950/40 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-500/20 text-[10px] font-bold text-purple-300">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={entry.keys}
                    onChange={(e) => updateEntry(entry.id, { keys: e.target.value })}
                    placeholder="Primary Keywords (comma-separated, e.g. Citadel, Malakor)"
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none w-64 sm:w-80"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.constant}
                      onChange={(e) => updateEntry(entry.id, { constant: e.target.checked })}
                      className="rounded border-zinc-700 text-purple-600"
                    />
                    <span>Constant</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.enabled}
                      onChange={(e) => updateEntry(entry.id, { enabled: e.target.checked })}
                      className="rounded border-zinc-700 text-purple-600"
                    />
                    <span>Enabled</span>
                  </label>

                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <textarea
                  rows={2}
                  value={entry.content}
                  onChange={(e) => updateEntry(entry.id, { content: e.target.value })}
                  placeholder="The knowledge or background injected into character context when the keywords are matched..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          {editingLorebookId && (
            <button
              type="button"
              onClick={handleStartNewLorebook}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white transition-all"
            >
              + New Lorebook
            </button>
          )}
          <button
            onClick={handleSaveToBrowser}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:from-purple-500 hover:to-fuchsia-500 transition-all"
          >
            <Save className="h-4 w-4" />
            <span>{editingLorebookId ? 'Update Lorebook' : 'Save to Palace Storage'}</span>
          </button>
        </div>

        {/* Saved Lorebooks List with Edit & Delete */}
        {savedLorebooks.length > 0 && (
          <div className="pt-6 border-t border-zinc-800/80 space-y-3">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-400" />
              <span>Your Saved Lorebooks ({savedLorebooks.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {savedLorebooks.map((lb) => (
                <div
                  key={lb.id}
                  className={`rounded-2xl border p-4 flex items-center justify-between gap-3 ${
                    editingLorebookId === lb.id
                      ? 'border-purple-500/60 bg-purple-950/20'
                      : 'border-zinc-800 bg-zinc-900/60'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{lb.name}</div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {lb.entries.length} entries &bull; Scan depth {lb.scanDepth}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadForEdit(lb)}
                      className="flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-all"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLorebook(lb.id)}
                      className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all ${
                        confirmDeleteId === lb.id
                          ? 'border-rose-500 bg-rose-600 text-white'
                          : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{confirmDeleteId === lb.id ? 'Confirm' : 'Delete'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
