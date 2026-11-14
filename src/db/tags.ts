import { db } from './index.ts';
import { tags, characters, personas } from './schema.ts';
import { desc, eq, ilike, sql } from 'drizzle-orm';
import { CHUB_ALL_TAGS } from '../utils/characterUtils.ts';
import { normalizeTagName, slugifyTag } from '../utils/chubOptions.ts';

let tagsSeeded = false;

/**
 * Ensure initial Chub.ai taxonomy + any existing character/persona tags are saved in the tags table.
 */
export async function ensureSeedTags() {
  if (tagsSeeded) return;
  try {
    // 1. Seed default Chub.ai tags if table is empty
    const existingCount = await db.select({ count: sql<number>`count(*)` }).from(tags);
    const allTagNames = new Set<string>(CHUB_ALL_TAGS);

    // 2. Also scan existing characters & personas in DB so any pre-existing custom tags are synced
    try {
      const charRows = await db.select({ tags: characters.tags }).from(characters);
      for (const row of charRows) {
        if (!row.tags) continue;
        try {
          const parsed = JSON.parse(row.tags);
          if (Array.isArray(parsed)) {
            for (const t of parsed) {
              if (typeof t === 'string' && t.trim()) allTagNames.add(t.trim());
            }
          }
        } catch {
          // ignore malformed JSON
        }
      }

      const personaRows = await db.select({ tags: personas.tags }).from(personas);
      for (const row of personaRows) {
        if (!row.tags) continue;
        try {
          const parsed = JSON.parse(row.tags);
          if (Array.isArray(parsed)) {
            for (const t of parsed) {
              if (typeof t === 'string' && t.trim()) allTagNames.add(t.trim());
            }
          }
        } catch {
          // ignore malformed JSON
        }
      }
    } catch (scanErr) {
      console.warn('Tag scan during seed skipped:', scanErr);
    }

    if (Number(existingCount[0]?.count || 0) === 0) {
      await upsertTags(Array.from(allTagNames), 'system', false);
    } else {
      // Ensure any custom tags found on characters/personas exist without inflating usageCount
      for (const tName of allTagNames) {
        const clean = normalizeTagName(tName);
        if (!clean) continue;
        const slug = slugifyTag(clean);
        await db
          .insert(tags)
          .values({
            name: clean,
            slug,
            usageCount: 1,
            createdBy: 'system',
          })
          .onConflictDoNothing();
      }
    }

    tagsSeeded = true;
  } catch (error) {
    console.error('ensureSeedTags failed:', error);
  }
}

/**
 * Fetch tags from the Cloud SQL tag database, ordered by usageCount desc & name asc
 */
export async function getTags(options?: { search?: string; limit?: number }) {
  try {
    await ensureSeedTags();
    const search = options?.search?.trim();
    const limit = options?.limit ?? 200;

    let query = db.select().from(tags).$dynamic();
    if (search) {
      query = query.where(ilike(tags.name, `%${search}%`));
    }
    return await query.orderBy(desc(tags.usageCount), tags.name).limit(limit);
  } catch (error) {
    console.error('getTags failed:', error);
    return [];
  }
}

/**
 * Upsert one or many free-form Chub.ai tags into the Cloud SQL database.
 * If incrementUsage is true, existing tags have usageCount incremented.
 */
export async function upsertTags(
  tagNames: string[],
  createdBy: string = 'system',
  incrementUsage: boolean = true
) {
  const saved: any[] = [];
  if (!Array.isArray(tagNames) || tagNames.length === 0) return saved;

  const seen = new Set<string>();
  for (const raw of tagNames) {
    if (typeof raw !== 'string') continue;
    const clean = normalizeTagName(raw);
    if (!clean) continue;
    const slug = slugifyTag(clean);
    if (seen.has(slug)) continue;
    seen.add(slug);

    try {
      const existing = await db
        .select()
        .from(tags)
        .where(eq(tags.slug, slug))
        .limit(1);

      if (existing.length > 0) {
        if (incrementUsage) {
          const updated = await db
            .update(tags)
            .set({ usageCount: sql`${tags.usageCount} + 1` })
            .where(eq(tags.id, existing[0].id))
            .returning();
          saved.push(updated[0]);
        } else {
          saved.push(existing[0]);
        }
      } else {
        // Also check case-insensitive name collision before inserting
        const byName = await db
          .select()
          .from(tags)
          .where(ilike(tags.name, clean))
          .limit(1);

        if (byName.length > 0) {
          if (incrementUsage) {
            const updated = await db
              .update(tags)
              .set({ usageCount: sql`${tags.usageCount} + 1` })
              .where(eq(tags.id, byName[0].id))
              .returning();
            saved.push(updated[0]);
          } else {
            saved.push(byName[0]);
          }
        } else {
          const inserted = await db
            .insert(tags)
            .values({
              name: clean,
              slug,
              usageCount: incrementUsage ? 1 : 0,
              createdBy: createdBy || 'guest',
            })
            .onConflictDoNothing()
            .returning();
          if (inserted[0]) {
            saved.push(inserted[0]);
          }
        }
      }
    } catch (err) {
      console.warn(`upsertTags failed for "${clean}":`, err);
    }
  }

  return saved;
}
