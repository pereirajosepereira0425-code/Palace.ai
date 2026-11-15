/**
 * Shared client TTS playback helper that supports both server-synthesized audio bytes
 * and calibrated client speech synthesis profiles returned by Chub.ai Custom Voices Engine.
 */
export interface TtsPlayCallbacks {
  audioRef?: { current: HTMLAudioElement | null };
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export function stopActiveTTSPlayback(audioRef?: { current: HTMLAudioElement | null }) {
  if (audioRef?.current) {
    audioRef.current.pause();
    audioRef.current = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export async function playTTSResponseData(
  data: any,
  fallbackText: string,
  callbacks: TtsPlayCallbacks = {}
): Promise<boolean> {
  const { audioRef, onStart, onEnd, onError } = callbacks;

  if (data?.mode === 'audio' && data.audioBase64) {
    const mime = data.mimeType || 'audio/wav';
    const audio = new Audio(`data:${mime};base64,${data.audioBase64}`);
    if (audioRef) audioRef.current = audio;
    audio.onended = () => onEnd?.();
    audio.onerror = () => onError?.();
    onStart?.();
    await audio.play();
    return true;
  }

  // Client calibrated voice profile fallback (Web Speech API pitch/rate tuned to custom voice)
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const cleaned = fallbackText.replace(/\*([^*]+)\*/g, '$1').trim().slice(0, 450);
    if (!cleaned) {
      onEnd?.();
      return false;
    }

    const utterance = new SpeechSynthesisUtterance(cleaned);
    const profile = data?.voiceProfile;
    if (profile) {
      if (typeof profile.webSpeechPitch === 'number') {
        utterance.pitch = Math.max(0.5, Math.min(2, profile.webSpeechPitch));
      }
      if (typeof profile.webSpeechRate === 'number') {
        utterance.rate = Math.max(0.5, Math.min(2, profile.webSpeechRate));
      }
    }
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    onStart?.();
    window.speechSynthesis.speak(utterance);
    return true;
  }

  onEnd?.();
  return false;
}
