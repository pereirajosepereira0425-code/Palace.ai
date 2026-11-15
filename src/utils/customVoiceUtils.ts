import type { CustomVoiceRecord } from '../types/index.ts';

export interface CustomVoiceValidationResult {
  ok: boolean;
  error?: string;
  normalizedAudioData?: string;
  mimeType?: string;
}

const ALLOWED_AUDIO_MIMES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
]);

/**
 * Validates audio reference clip data URLs or external audio URLs for Chub.ai Custom Voices Engine.
 */
export function validateCustomVoiceInput(params: {
  name?: string;
  referenceAudioData?: string;
  referenceDurationSec?: number;
}): CustomVoiceValidationResult {
  const cleanName = (params.name || '').trim();
  if (!cleanName || cleanName.length < 2) {
    return { ok: false, error: 'Custom voice name must be at least 2 characters.' };
  }
  if (cleanName.length > 80) {
    return { ok: false, error: 'Custom voice name must be 80 characters or fewer.' };
  }

  const rawAudio = (params.referenceAudioData || '').trim();
  if (!rawAudio) {
    return { ok: false, error: 'Please upload, record, or link an audio sample of how the voice should sound.' };
  }

  if (rawAudio.startsWith('data:')) {
    const match = rawAudio.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      return { ok: false, error: 'Invalid base64 audio clip format.' };
    }
    const mime = match[1].toLowerCase().split(';')[0].trim();
    if (!mime.startsWith('audio/') && !ALLOWED_AUDIO_MIMES.has(mime)) {
      return { ok: false, error: `Unsupported audio format "${mime}". Upload WAV, MP3, OGG, M4A, or WebM audio.` };
    }
    // ~5.5MB base64 limit (~4MB raw audio)
    if (rawAudio.length > 5_600_000) {
      return { ok: false, error: 'Reference audio sample is too large (max ~4 MB / ~60 seconds).' };
    }
    return { ok: true, normalizedAudioData: rawAudio, mimeType: mime };
  }

  try {
    const parsed = new URL(rawAudio);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: 'Reference audio URL must start with http:// or https://' };
    }
    return { ok: true, normalizedAudioData: rawAudio, mimeType: 'audio/mpeg' };
  } catch {
    return { ok: false, error: 'Reference audio must be an uploaded audio clip or valid HTTP(S) URL.' };
  }
}

/**
 * Clamps pitch shift (-6..+6 semitones) and speaking rate (70..140%) and maps to Web Speech / TTS values.
 */
export function computeSpeechCalibration(params?: {
  pitchShift?: number | null;
  speakingRate?: number | null;
  baseVoiceName?: string | null;
}): {
  pitchShift: number;
  speakingRate: number;
  webSpeechPitch: number;
  webSpeechRate: number;
  baseVoiceName: string;
} {
  const pitchShift = Math.max(-6, Math.min(6, Math.round(Number(params?.pitchShift ?? 0))));
  const speakingRate = Math.max(70, Math.min(140, Math.round(Number(params?.speakingRate ?? 100))));

  const basePitchOffset =
    params?.baseVoiceName === 'Charon'
      ? -0.2
      : params?.baseVoiceName === 'Fenrir'
        ? -0.15
        : params?.baseVoiceName === 'Kore' || params?.baseVoiceName === 'Zephyr'
          ? 0.14
          : 0.04;

  const webSpeechPitch = Number(
    Math.max(0.5, Math.min(1.8, 1.0 + basePitchOffset + pitchShift * 0.075)).toFixed(2)
  );
  const webSpeechRate = Number(Math.max(0.65, Math.min(1.5, speakingRate / 100)).toFixed(2));

  return {
    pitchShift,
    speakingRate,
    webSpeechPitch,
    webSpeechRate,
    baseVoiceName: params?.baseVoiceName || 'Puck',
  };
}

/**
 * Builds an expressive style description and Chub.ai Custom Voices zero-shot payload
 * from the uploaded audio reference profile.
 */
export function buildChubCustomVoicePayload(params: {
  text: string;
  voice: CustomVoiceRecord;
  voiceStyle?: string | null;
}) {
  const cal = computeSpeechCalibration(params.voice);
  const cleanText = params.text.replace(/\*([^*]+)\*/g, '($1)').trim().slice(0, 600);
  const derivedStyle = [
    `Chub Custom Voice Clone: "${params.voice.name}"`,
    params.voice.description ? `Timbre: ${params.voice.description}` : '',
    params.voice.transcript ? `Reference Cadence Sample: "${params.voice.transcript}"` : '',
    cal.pitchShift !== 0 ? `Pitch shift ${cal.pitchShift > 0 ? '+' : ''}${cal.pitchShift} semitones` : '',
    cal.speakingRate !== 100 ? `Tempo ${cal.speakingRate}%` : '',
    params.voiceStyle || '',
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    engine: params.voice.engine || 'chub_custom_voice',
    voice_id: params.voice.uuid,
    voice_name: params.voice.name,
    text: cleanText,
    speaker_wav: params.voice.referenceAudioData,
    reference_audio: params.voice.referenceAudioData,
    reference_mime: params.voice.referenceAudioMime,
    reference_transcript: params.voice.transcript || undefined,
    pitch_shift: cal.pitchShift,
    speed: cal.webSpeechRate,
    base_voice: cal.baseVoiceName,
    derivedStyle,
  };
}

/**
 * Normalizes edited bot/user message content and updates the active swipe entry consistently.
 */
export function normalizeEditedMessageText(rawText: string): string {
  return rawText.replace(/\r\n/g, '\n').trim();
}

export function applyEditedSwipe(params: {
  swipesJsonOrArray?: string | string[] | null;
  activeSwipeIndex?: number | null;
  newContent: string;
}): {
  content: string;
  swipes: string[];
  swipesJson: string;
  activeSwipeIndex: number;
} {
  const cleaned = normalizeEditedMessageText(params.newContent);
  let swipes: string[] = [];
  if (Array.isArray(params.swipesJsonOrArray)) {
    swipes = [...params.swipesJsonOrArray];
  } else if (typeof params.swipesJsonOrArray === 'string' && params.swipesJsonOrArray.trim()) {
    try {
      const parsed = JSON.parse(params.swipesJsonOrArray);
      if (Array.isArray(parsed)) swipes = parsed.map((x) => String(x));
    } catch {
      swipes = [];
    }
  }

  const idx = Math.max(0, Number(params.activeSwipeIndex ?? 0));
  if (swipes.length === 0) {
    swipes = [cleaned];
  } else if (idx < swipes.length) {
    swipes[idx] = cleaned;
  } else {
    swipes.push(cleaned);
  }

  return {
    content: cleaned,
    swipes,
    swipesJson: JSON.stringify(swipes),
    activeSwipeIndex: Math.min(idx, swipes.length - 1),
  };
}
