import type { LorebookEntryItem } from '../types/index.ts';

export function clampBlurLevel(val: unknown, fallback: number = 2): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(20, Math.round(num)));
}

export function normalizeOverlayOpacity(val: unknown, fallbackPct: number = 65): {
  pct: number;
  float: number;
} {
  const num = Number(val);
  if (!Number.isFinite(num)) {
    const safePct = Math.max(10, Math.min(95, Math.round(fallbackPct)));
    return { pct: safePct, float: Number((safePct / 100).toFixed(2)) };
  }
  const pctRaw = num <= 1 ? num * 100 : num;
  const pct = Math.max(10, Math.min(95, Math.round(pctRaw)));
  return { pct, float: Number((pct / 100).toFixed(2)) };
}

export function parseLorebookEntries(raw: unknown): LorebookEntryItem[] {
  let list: any[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      return [];
    }
  }

  return list
    .map((item, idx) => {
      const keys = Array.isArray(item?.keys)
        ? item.keys.map((k: unknown) => String(k).trim()).filter(Boolean).join(', ')
        : String(item?.keys ?? item?.key ?? '').trim();
      const secondaryKeys = Array.isArray(item?.secondaryKeys)
        ? item.secondaryKeys.map((k: unknown) => String(k).trim()).filter(Boolean).join(', ')
        : String(item?.secondaryKeys ?? '').trim();
      const content = String(item?.content ?? item?.value ?? '').trim();
      return {
        id: String(item?.id || `entry_${idx + 1}`),
        keys,
        secondaryKeys,
        content,
        insertionOrder: Number.isFinite(Number(item?.insertionOrder))
          ? Number(item.insertionOrder)
          : 100,
        enabled: item?.enabled !== false,
        constant: Boolean(item?.constant),
        caseSensitive: Boolean(item?.caseSensitive),
      };
    })
    .filter((entry) => entry.keys || entry.content);
}

/**
 * Merges a character's built-in lorebook JSON with an optional active global/community lorebook
 * and active persona lorebook so ChatRoom & AI routes inject all three seamlessly.
 */
export function mergeGlobalActiveLorebook(
  characterLorebookRaw: string | null | undefined,
  activeGlobalLorebookRaw: string | null | undefined,
  personaLorebookRaw?: string | null | undefined
): string {
  const combined: Array<{ key: string; content: string; constant?: boolean }> = [];
  const seen = new Set<string>();

  const pushCharacterLore = (raw: unknown) => {
    if (!raw) return;
    let parsed: any = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
    }
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.entries)
      ? parsed.entries
      : [];
    for (const item of items) {
      if (item?.enabled === false) continue;
      const key = String(item?.key ?? item?.keys ?? '').trim();
      const content = String(item?.content ?? item?.value ?? '').trim();
      if (!content) continue;
      if (key || item?.constant) {
        const finalKey = key || '__constant__';
        const sig = `${finalKey.toLowerCase()}::${content.toLowerCase()}`;
        if (!seen.has(sig)) {
          seen.add(sig);
          combined.push({
            key: finalKey,
            content,
            constant: Boolean(item?.constant),
          });
        }
      }
    }
  };

  pushCharacterLore(characterLorebookRaw);
  pushCharacterLore(personaLorebookRaw);
  pushCharacterLore(activeGlobalLorebookRaw);

  return JSON.stringify(combined);
}

export function canFollowTarget(
  followerId: string | null | undefined,
  targetUid: string | null | undefined
): { allowed: boolean; reason?: string } {
  const cleanFollower = (followerId || '').trim();
  const cleanTarget = (targetUid || '').trim();
  if (!cleanFollower || !cleanTarget) {
    return { allowed: false, reason: 'Both follower and target user IDs are required' };
  }
  if (cleanFollower === cleanTarget) {
    return { allowed: false, reason: 'You cannot follow your own profile' };
  }
  return { allowed: true };
}

export interface CharacterLoreEntry {
  key: string;
  content: string;
}

/**
 * Merges incoming lorebook entries (from a shared community lorebook, saved local lorebook,
 * or imported JSON card) onto an existing character's lorebook entry list, deduplicating
 * identical (key, content) pairs while preserving unlimited stacked lorebooks.
 */
export function mergeCharacterLoreEntries(
  existing: CharacterLoreEntry[],
  incoming: unknown
): { entries: CharacterLoreEntry[]; addedCount: number } {
  const base: CharacterLoreEntry[] = Array.isArray(existing)
    ? existing.map((e) => ({
        key: String(e?.key ?? '').trim(),
        content: String(e?.content ?? '').trim(),
      }))
    : [];

  const seen = new Set(
    base
      .filter((e) => e.key || e.content)
      .map((e) => `${e.key.toLowerCase()}::${e.content.toLowerCase()}`)
  );

  const normalizedIncoming = parseLorebookEntries(incoming);
  let addedCount = 0;

  for (const item of normalizedIncoming) {
    if (item.enabled === false) continue;
    const key = (item.keys || (item.constant ? 'Constant Lore' : '')).trim();
    const content = item.content.trim();
    if (!key && !content) continue;

    const sig = `${key.toLowerCase()}::${content.toLowerCase()}`;
    if (!seen.has(sig)) {
      seen.add(sig);
      base.push({ key, content });
      addedCount += 1;
    }
  }

  return { entries: base, addedCount };
}

