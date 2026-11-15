import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Mic,
  Square,
  Upload,
  Link as LinkIcon,
  Volume2,
  Sparkles,
  Check,
  Trash2,
  AudioWaveform,
  Globe,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { CustomVoiceRecord } from '../types/index.ts';
import { validateCustomVoiceInput } from '../utils/customVoiceUtils.ts';

interface CustomVoiceStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceCreated: (voice: CustomVoiceRecord) => void;
  defaultCharacterName?: string;
}

const BASE_VOICES = [
  { id: 'Puck', label: 'Puck (Balanced / Expressive)' },
  { id: 'Charon', label: 'Charon (Deep / Resonant)' },
  { id: 'Kore', label: 'Kore (Warm / Velvet)' },
  { id: 'Fenrir', label: 'Fenrir (Gravelly / Fierce)' },
  { id: 'Zephyr', label: 'Zephyr (Airy / Melodic)' },
];

export const CustomVoiceStudioModal: React.FC<CustomVoiceStudioModalProps> = ({
  isOpen,
  onClose,
  onVoiceCreated,
  defaultCharacterName,
}) => {
  const { user, profile, guestId, getIdToken } = useAuth();

  const [sourceMode, setSourceMode] = useState<'upload' | 'record' | 'url'>('upload');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [transcript, setTranscript] = useState('');
  const [baseVoiceName, setBaseVoiceName] = useState('Puck');
  const [pitchShift, setPitchShift] = useState(0);
  const [speakingRate, setSpeakingRate] = useState(100);
  const [isPublic, setIsPublic] = useState(true);

  const [audioData, setAudioData] = useState('');
  const [audioMime, setAudioMime] = useState('audio/wav');
  const [audioFileName, setAudioFileName] = useState('');
  const [durationSec, setDurationSec] = useState(0);
  const [audioUrlInput, setAudioUrlInput] = useState('');

  // Mic Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (!name && defaultCharacterName) {
        setName(`${defaultCharacterName} Voice`);
      }
    } else {
      stopMicStream();
    }
    return () => stopMicStream();
  }, [isOpen, defaultCharacterName]);

  const stopMicStream = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  if (!isOpen) return null;

  const detectDuration = (src: string) => {
    try {
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => {
        if (Number.isFinite(probe.duration) && probe.duration > 0) {
          setDurationSec(Math.round(probe.duration * 10) / 10);
        }
      };
      probe.src = src;
    } catch {
      // ignore duration probe errors
    }
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');

    if (file.size > 4_100_000) {
      setErrorMsg('Audio sample must be under 4 MB (recommended 5–30 seconds).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') {
        setAudioData(result);
        setAudioMime(file.type || 'audio/wav');
        setAudioFileName(file.name);
        detectDuration(result);
      }
    };
    reader.onerror = () => setErrorMsg('Failed to read audio file.');
    reader.readAsDataURL(file);
  };

  const handleStartRecording = async () => {
    setErrorMsg('');
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setErrorMsg('Microphone recording is not supported in this browser. Upload an audio file or paste an audio URL instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result;
          if (typeof result === 'string') {
            setAudioData(result);
            setAudioMime(mimeType);
            setAudioFileName(`mic_sample_${Date.now()}.webm`);
            setDurationSec((prev) => Math.max(prev, recordingSeconds));
            detectDuration(result);
          }
        };
        reader.readAsDataURL(blob);
        stopMicStream();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Could not access microphone. Please allow mic permissions or upload an audio clip.'
      );
      stopMicStream();
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      stopMicStream();
    }
  };

  const handleApplyAudioUrl = () => {
    setErrorMsg('');
    const trimmed = audioUrlInput.trim();
    if (!trimmed) {
      setErrorMsg('Enter an audio URL (MP3, WAV, OGG, or M4A).');
      return;
    }
    setAudioData(trimmed);
    setAudioMime('audio/mpeg');
    setAudioFileName(trimmed.split('/').pop() || 'Audio URL');
    detectDuration(trimmed);
  };

  const handleSaveVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const effectiveAudio = sourceMode === 'url' && !audioData ? audioUrlInput.trim() : audioData;
    const validation = validateCustomVoiceInput({
      name,
      referenceAudioData: effectiveAudio,
      referenceDurationSec: durationSec,
    });

    if (!validation.ok || !validation.normalizedAudioData) {
      setErrorMsg(validation.error || 'Please provide a valid voice name and audio clip.');
      return;
    }

    try {
      setSaving(true);
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/voices', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          guestId,
          creatorName:
            profile?.displayName ||
            profile?.username ||
            user?.displayName ||
            'Creator',
          name: name.trim(),
          description: description.trim(),
          engine: 'chub_custom_voice',
          referenceAudioData: validation.normalizedAudioData,
          referenceAudioMime: validation.mimeType || audioMime,
          referenceDurationSec: durationSec || recordingSeconds || 5,
          transcript: transcript.trim(),
          pitchShift,
          speakingRate,
          baseVoiceName,
          isPublic,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save custom voice');
      }

      onVoiceCreated(data.voice);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save custom voice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="custom-voice-studio-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
    >
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-amber-500/40 bg-zinc-950 text-zinc-100 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/25 to-orange-500/25 border border-amber-400/40 text-amber-300">
              <AudioWaveform className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Chub.ai Custom Voices Engine</span>
                <span className="rounded-md bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  Audio Clone
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                Upload, record, or link an audio sample of how the character should sound
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
            aria-label="Close Custom Voice Studio"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSaveVoice} className="p-6 space-y-5 text-xs">
          {errorMsg && (
            <div className="rounded-2xl border border-rose-500/50 bg-rose-950/40 px-4 py-2.5 text-rose-200 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Voice Name & Timbre Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-amber-300 mb-1">
                Voice Name *
              </label>
              <input
                type="text"
                required
                data-testid="custom-voice-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Velvet Noir, Commander Bass..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-zinc-100 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-amber-300 mb-1">
                Base Acoustic Profile
              </label>
              <select
                value={baseVoiceName}
                onChange={(e) => setBaseVoiceName(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-amber-400 focus:outline-none"
              >
                {BASE_VOICES.map((bv) => (
                  <option key={bv.id} value={bv.id}>
                    {bv.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-amber-300 mb-1">
              Voice Style / Timbre Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Smoky midnight contralto, calm cadence with crisp British articulation"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
          </div>

          {/* Reference Audio Source Picker */}
          <div className="rounded-2xl border border-amber-500/30 bg-zinc-900/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-amber-200 flex items-center gap-1.5">
                <Volume2 className="h-4 w-4 text-amber-400" />
                <span>Reference Audio Sample *</span>
              </span>
              <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
                {[
                  { id: 'upload', label: 'Upload Audio', icon: Upload },
                  { id: 'record', label: 'Record Mic', icon: Mic },
                  { id: 'url', label: 'Audio URL', icon: LinkIcon },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSourceMode(tab.id as any)}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                        sourceMode === tab.id
                          ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {sourceMode === 'upload' && (
              <label
                data-testid="custom-voice-file-dropzone"
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-950/70 p-5 text-center hover:border-amber-400/60 transition-colors cursor-pointer"
              >
                <Upload className="h-6 w-6 text-amber-400" />
                <div className="font-bold text-zinc-200">
                  {audioFileName ? `Selected: ${audioFileName}` : 'Choose Audio Sample (.wav, .mp3, .ogg, .webm, .m4a)'}
                </div>
                <p className="text-[11px] text-zinc-400">
                  Best results with 5–30 seconds of clean speech (max 4 MB)
                </p>
                <input
                  type="file"
                  data-testid="custom-voice-file-input"
                  accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a,.flac"
                  onChange={handleAudioFileUpload}
                  className="sr-only"
                />
              </label>
            )}

            {sourceMode === 'record' && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 text-center">
                {isRecording ? (
                  <>
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-sm animate-pulse">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      <span>Recording... {recordingSeconds}s</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 font-bold text-white hover:bg-rose-500 cursor-pointer"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                      <span>Stop Recording</span>
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-zinc-400">
                      Speak 1–2 expressive sentences in the character&apos;s tone
                    </p>
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-2 font-bold text-white hover:from-amber-500 hover:to-orange-500 cursor-pointer"
                    >
                      <Mic className="h-4 w-4" />
                      <span>Start Microphone Recording</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {sourceMode === 'url' && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={audioUrlInput}
                  onChange={(e) => setAudioUrlInput(e.target.value)}
                  placeholder="https://example.com/voice-sample.wav"
                  className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 font-mono text-zinc-100 focus:border-amber-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyAudioUrl}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-2 font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                >
                  Load Clip
                </button>
              </div>
            )}

            {/* Audio Sample Preview */}
            {audioData && (
              <div
                data-testid="custom-voice-audio-preview"
                className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-3 space-y-2"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    <span>
                      {audioFileName || 'Reference Clip Ready'}
                      {durationSec > 0 ? ` (${durationSec}s)` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAudioData('');
                      setAudioFileName('');
                      setDurationSec(0);
                    }}
                    className="flex items-center gap-1 text-rose-300 hover:text-rose-200 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Clear</span>
                  </button>
                </div>
                <audio controls src={audioData} className="w-full h-9" />
              </div>
            )}
          </div>

          {/* Reference Transcript */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-amber-300 mb-1">
              Transcript of What the Audio Says (Optional — improves zero-shot sync)
            </label>
            <input
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="e.g. Welcome to the midnight archive. Watch where you step."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
          </div>

          {/* Pitch & Tempo Calibration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div>
              <div className="flex justify-between font-bold text-zinc-300 mb-1">
                <span>Pitch Shift</span>
                <span className="font-mono text-amber-300">
                  {pitchShift > 0 ? `+${pitchShift}` : pitchShift} st
                </span>
              </div>
              <input
                type="range"
                min={-6}
                max={6}
                step={1}
                value={pitchShift}
                onChange={(e) => setPitchShift(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div>
              <div className="flex justify-between font-bold text-zinc-300 mb-1">
                <span>Speaking Speed</span>
                <span className="font-mono text-amber-300">{speakingRate}%</span>
              </div>
              <input
                type="range"
                min={70}
                max={140}
                step={5}
                value={speakingRate}
                onChange={(e) => setSpeakingRate(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-800 text-amber-500"
            />
            <Globe className="h-3.5 w-3.5 text-amber-400" />
            <span>Share this voice in the Community Chub Voices library</span>
          </label>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 font-semibold text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="save-custom-voice-btn"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2 font-bold text-white shadow-lg hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>{saving ? 'Cloning & Saving...' : 'Save Custom Voice'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
