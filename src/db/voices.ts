import { db } from './index.ts';
import { customVoices } from './schema.ts';
import { desc, eq, or, sql } from 'drizzle-orm';
import { isOwnedByRequester, type RequesterIdentity } from '../utils/ownership.ts';

export interface CustomVoiceInsert {
  uuid: string;
  userId: string;
  creatorName: string;
  name: string;
  description?: string;
  engine?: string;
  referenceAudioData: string;
  referenceAudioMime?: string;
  referenceDurationSec?: number;
  transcript?: string;
  pitchShift?: number;
  speakingRate?: number;
  baseVoiceName?: string;
  isPublic?: boolean;
}

export async function getCustomVoices(userId?: string) {
  try {
    if (userId) {
      return await db
        .select()
        .from(customVoices)
        .where(or(eq(customVoices.isPublic, true), eq(customVoices.userId, userId)))
        .orderBy(desc(customVoices.useCount), desc(customVoices.createdAt));
    }
    return await db
      .select()
      .from(customVoices)
      .where(eq(customVoices.isPublic, true))
      .orderBy(desc(customVoices.useCount), desc(customVoices.createdAt));
  } catch (error) {
    console.error('getCustomVoices failed:', error);
    return [];
  }
}

export async function getCustomVoiceByUuid(uuid: string) {
  try {
    const list = await db
      .select()
      .from(customVoices)
      .where(eq(customVoices.uuid, uuid))
      .limit(1);
    return list[0] || null;
  } catch (error) {
    console.error('getCustomVoiceByUuid failed:', error);
    return null;
  }
}

export async function createCustomVoice(data: CustomVoiceInsert) {
  try {
    const res = await db
      .insert(customVoices)
      .values({
        uuid: data.uuid,
        userId: data.userId,
        creatorName: data.creatorName || 'Anonymous',
        name: data.name,
        description: data.description || '',
        engine: data.engine || 'chub_custom_voice',
        referenceAudioData: data.referenceAudioData,
        referenceAudioMime: data.referenceAudioMime || 'audio/wav',
        referenceDurationSec: Math.max(0, Math.round(data.referenceDurationSec || 0)),
        transcript: data.transcript || '',
        pitchShift: Math.max(-6, Math.min(6, Math.round(data.pitchShift ?? 0))),
        speakingRate: Math.max(70, Math.min(140, Math.round(data.speakingRate ?? 100))),
        baseVoiceName: data.baseVoiceName || 'Puck',
        isPublic: data.isPublic ?? true,
      })
      .returning();
    return res[0];
  } catch (error) {
    console.error('createCustomVoice failed:', error);
    throw new Error('Failed to create custom voice', { cause: error });
  }
}

export async function deleteCustomVoice(
  uuid: string,
  requester: RequesterIdentity
): Promise<{ status: 'ok' } | { status: 'not_found' } | { status: 'forbidden' }> {
  try {
    const existing = await getCustomVoiceByUuid(uuid);
    if (!existing) return { status: 'not_found' };
    if (!isOwnedByRequester(existing.userId, requester)) {
      return { status: 'forbidden' };
    }
    await db.delete(customVoices).where(eq(customVoices.id, existing.id));
    return { status: 'ok' };
  } catch (error) {
    console.error('deleteCustomVoice failed:', error);
    throw new Error('Failed to delete custom voice', { cause: error });
  }
}

export async function incrementCustomVoiceUseCount(uuid: string) {
  try {
    await db
      .update(customVoices)
      .set({ useCount: sql`${customVoices.useCount} + 1` })
      .where(eq(customVoices.uuid, uuid));
  } catch (error) {
    console.error('incrementCustomVoiceUseCount failed:', error);
  }
}
