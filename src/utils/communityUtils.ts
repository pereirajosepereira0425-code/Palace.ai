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
 * stored in browser storage (`palace_active_lorebook`) so ChatRoom injects both seamlessly.
 */
export function mergeGlobalActiveLorebook(
  characterLorebookRaw: string | null | undefined,
  activeGlobalLorebookRaw: string | null | undefined
): string {
  const combined: Array<{ key: string; content: string; constant?: boolean }> = [];

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
      const content = String(item?.content ?? '').trim();
      if (!content) continue;
      if (key || item?.constant) {
        combined.push({
          key: key || '__constant__',
          content,
          constant: Boolean(item?.constant),
        });
      }
    }
  };

  pushCharacterLore(characterLorebookRaw);
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
