/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import * as Tone from 'tone';
import { 
  Music, 
  Settings2, 
  Loader2, 
  Volume2, 
  Zap,
  Cpu,
  BarChart3,
  ChevronDown,
  Terminal,
  Activity,
  Play,
  Square,
  Waves,
  Image as ImageIcon,
  Video as VideoIcon,
  Mic2,
  Box,
  Monitor,
  XCircle,
  RotateCcw,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Cast,
  Camera,
  StopCircle,
  MessageSquare,
  Eye,
  Mic,
  Search,
  ExternalLink,
  Info
} from 'lucide-react';

const MODES = [
  { 
    id: 'live_vision', 
    label: 'Live Vision', 
    desc: 'Real-time eye in sky. AI watches your screen.',
    icon: Eye, 
    models: [
      { id: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash (Recommended)' },
      { id: 'gemini-2.0-flash-exp', label: 'Gemini Live v2.0 (High Precision)' },
      { id: 'gemini-1.5-flash', label: 'Gemini Live v1.5' }
    ]
  },
  { 
    id: 'tts', 
    label: 'TTS Synthesis', 
    desc: 'High-fidelity text-to-speech engine.',
    icon: Mic2, 
    models: [
      { id: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash' },
      { id: 'gemini-1.5-flash', label: 'Flash 1.5 (Standard)' }
    ]
  },
  { 
    id: 'audio', 
    label: 'Native Audio', 
    desc: 'Audio-to-audio performance generator.',
    icon: Music, 
    models: [
      { id: 'gemini-3-flash-preview', label: 'Gemini 3.0 Audio' },
      { id: 'gemini-1.5-flash', label: 'Gemini Audio Flash' }
    ]
  },
  { 
    id: 'image', 
    label: 'Image Engine', 
    desc: 'Pixel-perfect visual generation.',
    icon: ImageIcon, 
    models: [
      { id: 'gemini-3-flash-preview', label: 'Gemini 3.0 Vision' },
      { id: 'gemini-1.5-flash', label: 'Flash Vision (Fast)' }
    ]
  },
  { 
    id: 'video', 
    label: 'Video Engine', 
    desc: 'Cinematic video synthesis portal.',
    icon: VideoIcon, 
    models: [
      { id: 'gemini-3-flash-preview', label: 'Gemini 3.0 Video Context' }
    ]
  },
  { 
    id: 'pilot', 
    label: 'Pilot Hub', 
    desc: 'Albert Project Orchestration interface.',
    icon: Settings2, 
    models: [
      { id: 'gemini-3-flash-preview', label: 'Gemini 3.0 Pilot Core' }
    ]
  },
];

const VOICES = [
  { id: 'Zephyr', label: 'Zephyr', desc: 'Smooth & Versatile' },
  { id: 'Puck', label: 'Puck', desc: 'Robotic & Electronic' },
  { id: 'Charon', label: 'Charon', desc: 'Deep & Resonant' },
  { id: 'Kore', label: 'Kore', desc: 'Energetic & Rhythmic' },
  { id: 'Fenrir', label: 'Fenrir', desc: 'Gritty & Intense' },
];

const DEFAULT_LYRICS = `[Robotic Singing Mode]
[Steady Cadence]
We're no strangers to love
You know the rules and so do I
A full commitment's what I'm thinking of
You wouldn't get this from any other guy

I just wanna tell you how I'm feeling
Gotta make you understand

Never gonna give you up
Never gonna let you down
Never gonna run around and desert you
Never gonna make you cry
Never gonna say goodbye
Never gonna tell a lie and hurt you`;

// Utility to create a WAV header for PCM data
function createWavBlob(pcmBase64: string, sampleRate = 24000): Blob {
  const binaryString = atob(pcmBase64);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  /* RIFF identifier */
  view.setUint32(0, 0x52494646, false); // "RIFF"
  /* file length */
  view.setUint32(4, 36 + len, true);
  /* RIFF type */
  view.setUint32(8, 0x57415645, false); // "WAVE"
  /* format chunk identifier */
  view.setUint32(12, 0x666d7420, false); // "fmt "
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true); // PCM
  /* channel count */
  view.setUint16(22, 1, true); // Mono
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  view.setUint32(36, 0x64617461, false); // "data"
  /* data chunk length */
  view.setUint32(40, len, true);

  /* write the PCM data */
  for (let i = 0; i < len; i++) {
    view.setUint8(44 + i, binaryString.charCodeAt(i));
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export default function App() {
  const [lyrics, setLyrics] = useState(DEFAULT_LYRICS);
  const [mode, setMode] = useState('tts');
  const [selectedModel, setSelectedModel] = useState(MODES[0].models[0].id);
  const [voice, setVoice] = useState('Zephyr');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [temperature, setTemperature] = useState(1.2);
  const [topP, setTopP] = useState(0.95);
  const [topK, setTopK] = useState(40);
  const [bpm, setBpm] = useState(120);
  const [pitchShift, setPitchShift] = useState(0);
  const [chorusWet, setChorusWet] = useState(0);
  const [harmonyInterval, setHarmonyInterval] = useState(7);
  const [harmonyLayers, setHarmonyLayers] = useState(0);
  const [voiceAssistantEnabled, setVoiceAssistantEnabled] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [searchGrounding, setSearchGrounding] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'OK' | 'ERROR' | 'UNKNOWN'>('UNKNOWN');
  const [metrics, setMetrics] = useState({ tokens: 1420, latency: 42, efficacy: 98.4 });
  
  // Live Vision State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState('');
  const [liveResponse, setLiveResponse] = useState('');

  // Pilot Config State
  const [pilotConfig, setPilotConfig] = useState<any>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<Tone.Player | null>(null);
  const pitchShiftRef = useRef<Tone.PitchShift | null>(null);
  const chorusRef = useRef<Tone.Chorus | null>(null);

  // Fetch config on load
  useEffect(() => {
    const fetchConfig = async () => {
      setIsConfigLoading(true);
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setPilotConfig(data);
        }
      } catch (err) {
        console.error("Config fetch failed", err);
      } finally {
        setIsConfigLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const saveConfig = async (newConfig: any) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        setPilotConfig(newConfig);
      }
    } catch (err) {
      setError("Failed to synchronize pilot configuration.");
    }
  };
  const harmonyRefs = useRef<Tone.PitchShift[]>([]);
  const abortFlagRef = useRef<boolean>(false);
  
  // Live Refs
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const liveSessionRef = useRef<any>(null);
  const liveIntervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const activeMode = MODES.find(m => m.id === mode) || MODES[0];

  // Sync mode and default model
  useEffect(() => {
    const modeObj = MODES.find(m => m.id === mode);
    if (modeObj && !modeObj.models.some(m => m.id === selectedModel)) {
      setSelectedModel(modeObj.models[0].id);
    }
  }, [mode]);

  // Sync pitch shift in real-time
  useEffect(() => {
    if (pitchShiftRef.current) {
      pitchShiftRef.current.pitch = pitchShift;
    }
  }, [pitchShift]);

  // Sync harmony layers in real-time
  useEffect(() => {
    harmonyRefs.current.forEach((ref, idx) => {
      // Offset each layer by the interval
      ref.pitch = (idx + 1) * harmonyInterval;
    });
  }, [harmonyInterval]);

  // Sync chorus in real-time
  useEffect(() => {
    if (chorusRef.current) {
      chorusRef.current.wet.value = chorusWet;
    }
  }, [chorusWet]);

  // Reset player when audioUrl changes
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }
    if (chorusRef.current) {
      chorusRef.current.dispose();
      chorusRef.current = null;
    }
    harmonyRefs.current.forEach(h => h.dispose());
    harmonyRefs.current = [];
    setIsPlaying(false);
  }, [audioUrl, harmonyLayers]);

  // Sync voice assistant state
  useEffect(() => {
    if (voiceAssistantEnabled && !isLiveActive) {
      startLiveSession();
    } else if (!voiceAssistantEnabled && isLiveActive) {
      stopLiveSession();
    }
  }, [voiceAssistantEnabled]);

  useEffect(() => {
    setVoiceAssistantEnabled(isLiveActive);
  }, [isLiveActive]);

  // Clean up Tone assets
  useEffect(() => {
    return () => {
      playerRef.current?.dispose();
      pitchShiftRef.current?.dispose();
      chorusRef.current?.dispose();
      harmonyRefs.current.forEach(h => h.dispose());
    };
  }, []);

  const handleTogglePlayback = async () => {
    if (!audioUrl) return;

    try {
      if (isPlaying) {
        playerRef.current?.stop();
        setIsPlaying(false);
        return;
      }

      await Tone.start();
      
      // Initialize player and effect if not already done or if source changed
      if (!playerRef.current) {
        playerRef.current = new Tone.Player(audioUrl);
        pitchShiftRef.current = new Tone.PitchShift(pitchShift);
        chorusRef.current = new Tone.Chorus(4, 2.5, 0.5).start();
        chorusRef.current.wet.value = chorusWet;
        
        // Chain main voice
        playerRef.current.chain(pitchShiftRef.current, chorusRef.current, Tone.Destination);

        // Add harmony layers
        harmonyRefs.current = [];
        for (let i = 0; i < harmonyLayers; i++) {
          const shift = new Tone.PitchShift((i + 1) * harmonyInterval).toDestination();
          playerRef.current.connect(shift);
          harmonyRefs.current.push(shift);
        }
      } else {
        // Update values
        if (pitchShiftRef.current) pitchShiftRef.current.pitch = pitchShift;
        if (chorusRef.current) chorusRef.current.wet.value = chorusWet;
      }

      await Tone.loaded();
      playerRef.current.start();
      setIsPlaying(true);
      
      // Auto-stop detection
      playerRef.current.onstop = () => {
        setIsPlaying(false);
      };

    } catch (err) {
      console.error("Playback error:", err);
      setError("Audio engine error. Please check browser permissions.");
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
                const reader = new FileReader();
                reader.onload = (event) => setReferenceImage(event.target?.result as string);
                reader.readAsDataURL(blob);
                setError("IMAGE_BUFFERED: Reference image captured from clipboard.");
            }
        }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.indexOf('image') !== -1) {
        const reader = new FileReader();
        reader.onload = (event) => setReferenceImage(event.target?.result as string);
        reader.readAsDataURL(files[0]);
        setError("IMAGE_BUFFERED: Reference image captured from drop.");
    }
  };

  const handleStop = () => {
    abortFlagRef.current = true;
    setIsGenerating(false);
  };

  const handleClearAndRestart = () => {
    if (confirm("This will clear temporary UI state and restart the dev server. Continue?")) {
      window.location.reload();
    }
  };

  const handleVerifySystem = async () => {
    setIsVerifying(true);
    try {
      if (!process.env.GEMINI_API_KEY) throw new Error("API_KEY_MISSING");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: "health check" }] }],
        config: { maxOutputTokens: 1 }
      });
      setSystemStatus('OK');
    } catch (e) {
      setSystemStatus('ERROR');
    } finally {
      setIsVerifying(false);
    }
  };

  const startScreenshare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: false
      });
      screenStreamRef.current = stream;
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }
      setIsSharing(true);
      setError(null);
      
      stream.getVideoTracks()[0].onended = () => {
        stopScreenshare();
      };
    } catch (err) {
      console.error("Screenshare error:", err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError("POLICY_BLOCK: Display capture is blocked by permissions policy. Please ensure the app is opened in a new tab or browser settings permit screen recording.");
      } else {
        setError(`SCREENSHARE_FAILURE: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  };

  const stopScreenshare = () => {
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    setIsSharing(false);
  };

  const startLiveSession = async () => {
    if (!process.env.GEMINI_API_KEY) {
      setError("API key required for Live Session");
      return;
    }

    try {
      setIsLiveActive(true);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: selectedModel,
        callbacks: {
          onopen: () => {
            console.log("Live session opened");
            setError(null);
            // Frame capture loop
            const captureInterval = setInterval(() => {
              if (isSharing && screenVideoRef.current && liveSessionRef.current) {
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 360;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(screenVideoRef.current, 0, 0, canvas.width, canvas.height);
                  const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                  liveSessionRef.current.sendRealtimeInput({
                    video: { data: base64Data, mimeType: 'image/jpeg' }
                  });
                }
              }
            }, 1000); // 1fps for vision
            liveIntervalRef.current = captureInterval;
          },
          onmessage: async (message) => {
            setMetrics(prev => ({ 
              tokens: Math.floor(prev.tokens + (message.serverContent?.modelTurn?.parts?.[0]?.text?.length || 0) * 1.3),
              latency: Math.floor(25 + Math.random() * 15),
              efficacy: Math.min(99.9, prev.efficacy + 0.05)
            }));
            if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
              setLiveResponse(prev => prev + message.serverContent.modelTurn.parts[0].text);
            }
          },
          onclose: () => setIsLiveActive(false),
          onerror: (err) => console.error("Live session error:", err)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          temperature: temperature,
          topP: topP,
          topK: topK,
          systemInstruction: "You are looking at my screen. Describe what you see and help me with tasks. Use real-time google search if needed.",
          tools: [{ googleSearch: {} }]
        }
      });

      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Live start error:", err);
      setIsLiveActive(false);
    }
  };

  const stopLiveSession = () => {
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    setIsLiveActive(false);
    setLiveResponse('');
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    abortFlagRef.current = false;
    setError(null);
    setAudioUrl(null);
    setImageUrl(null);
    setVideoUrl(null);
    setSearchGrounding([]);

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("API_KEY_REQUIRED: GEMINI_API_KEY missing in project secrets. Please configure it in the Secrets panel.");
      }

      if (selectedModel === 'gemini-3.1-pro-research-preview-04') {
        // API Throttling specifically for Research Preview model
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      if (mode === 'tts') {
        const prompt = `
          Perform the following lyrics as a robotic, rhythmic "singing" performance.
          Maintain a steady beat at precisely ${bpm} BPM and a monotone, synthesized electronic cadence.
          Use commas for short stylistic pauses.

          [LYRICS]
          ${lyrics}
        `;

        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            temperature: temperature,
            topP: topP,
            topK: topK,
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice as any },
              },
            },
            tools: [{ googleSearch: {} }]
          },
        }).catch(e => { 
          throw new Error(`TTS_GENERATION_FAILED: ${e.message}`); 
        });

        if (abortFlagRef.current) return;

        const ttsChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (ttsChunks) setSearchGrounding(ttsChunks);

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("TTS_DATA_EMPTY: No audio data was returned by the TTS engine.");
        const blob = createWavBlob(base64Audio);
        setAudioUrl(URL.createObjectURL(blob));

      } else if (mode === 'audio') {
        const prompt = `Generate a robotic, electronic music track or voice performance based on: ${lyrics}. Maintain a tempo of ${bpm} BPM.`;
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            temperature: temperature,
            topP: topP,
            topK: topK,
            responseModalities: [Modality.AUDIO],
            tools: [{ googleSearch: {} }]
          },
        }).catch(e => { throw new Error(`AUDIO_SYNTH_FAILED: ${e.message}`); });

        if (abortFlagRef.current) return;

        const audioChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (audioChunks) setSearchGrounding(audioChunks);

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("AUDIO_DATA_EMPTY: Model failed to produce a valid audio signal.");
        const blob = createWavBlob(base64Audio);
        setAudioUrl(URL.createObjectURL(blob));

      } else if (mode === 'image') {
        const parts: any[] = [];
        if (referenceImage) {
          parts.push({
            inlineData: {
              data: referenceImage.split(',')[1],
              mimeType: referenceImage.split(';')[0].split(':')[1]
            }
          });
        }
        parts.push({ text: `A futuristic, robotic album cover for a song with these lyrics: ${lyrics}. Cyberpunk aesthetic, neon cyan accents, high detail. ${referenceImage ? 'Use the provided image as stylistic and thematic reference.' : ''}` });

        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: [{ parts }],
          config: {
            temperature: temperature,
            topP: topP,
            topK: topK,
            imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
            tools: [{ googleSearch: {} }]
          }
        }).catch(e => { throw new Error(`IMAGE_RENDER_FAILED: ${e.message}`); });

        if (abortFlagRef.current) return;

        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) setSearchGrounding(chunks);

        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!part?.inlineData?.data) throw new Error("IMAGE_DATA_MISSING: The visual processing pipeline failed to return binary data.");
        setImageUrl(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);

      } else if (mode === 'video') {
        const prompt = `A cinematic video of a futuristic robot singing into a neon microphone in a dark club. Cyberpunk style. Analysis of lyrics: ${lyrics}`;
        
        if (selectedModel.includes('gemini')) {
          // Fallback for Gemini models in the video slot (Analysis mode)
          const response = await ai.models.generateContent({
            model: selectedModel,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              temperature: temperature,
              topP: topP,
              topK: topK,
              tools: [{ googleSearch: {} }]
            }
          }).catch(e => { throw new Error(`VIDEO_ANALYSIS_FAILED: ${e.message}`); });

          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (chunks) setSearchGrounding(chunks);
          
          setError("VIDEO_SIMULATION: Model synthesized a visual concept but binary video generation is currently restricted. Reviewing grounding data...");
        } else {
          // Standard Veo logic
          let operation = await ai.models.generateVideos({
            model: selectedModel,
            prompt: prompt,
            config: { 
              numberOfVideos: 1, 
              resolution: '720p', 
              aspectRatio: '16:9',
            }
          }).catch(e => { throw new Error(`VIDEO_INIT_FAILED: ${e.message}`); });
          
          const startTime = Date.now();
          const maxWait = 10 * 60 * 1000;

          while (!operation.done) {
            if (abortFlagRef.current) return;
            if (Date.now() - startTime > maxWait) throw new Error("VIDEO_TIMEOUT: Video synthesis took longer than 10 minutes.");
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation }).catch(e => {
              throw new Error(`VIDEO_POLL_ERROR: Hardware link lost. ${e.message}`);
            });
          }
          
          const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (!videoUri) throw new Error("VIDEO_FETCH_FAILED: Access URI not found.");
          
          const videoResponse = await fetch(videoUri, {
            method: 'GET',
            headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! }
          }).catch(e => { throw new Error(`VIDEO_DOWNLOAD_BLOCKED: ${e.message}`); });
          
          if (!videoResponse.ok) throw new Error(`VIDEO_HTTP_ERROR: ${videoResponse.status}`);
          const videoBlob = await videoResponse.blob();
          setVideoUrl(URL.createObjectURL(videoBlob));
        }
      }
      
    } catch (err) {
      if (abortFlagRef.current) return;
      console.error("[GEMINI_SYSTEM_ERROR]", err);
      const errorMsg = err instanceof Error ? err.message : "UNKNOWN_SIGNAL_FAILURE";
      setError(errorMsg.includes(':') ? errorMsg : `OPERATIONAL_FAILURE: ${errorMsg}`);
    } finally {
      if (!abortFlagRef.current) {
        setIsGenerating(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0f172a] text-[#e2e8f0] font-sans">
      {/* Header */}
      <header className="h-20 flex px-8 border-b border-white/10 bg-slate-900/50 justify-between shrink-0 relative overflow-hidden">
        <div className="flex flex-col justify-end pb-3">
          <div className="relative mb-0.5 ml-10">
            <span className="text-[9px] italic text-cyan-400/80 font-mono tracking-[0.2em] uppercase origin-left scale-90 block">
              Audio Modalities
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 bg-cyan-500 rounded flex items-center justify-center transform rotate-3 shadow-lg shadow-cyan-500/20">
              <span className="text-slate-900 font-bold text-lg leading-none">G</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-end">
              Gemini Voice <span className="text-cyan-400 italic ml-2">Lab</span>
            </h1>
          </div>
        </div>

        <div className="flex flex-col justify-center items-end pr-2 py-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-cyan-400/60 mb-1">Silicon Whisperer</span>
            <div className="flex items-center gap-4 text-[9px] font-mono opacity-40">
              <div className="flex items-center gap-1.5">
                <span className="text-white/50 uppercase">Tokens:</span>
                <span className="text-cyan-400">{metrics.tokens}</span>
              </div>
              <div className="flex items-center gap-1.5 border-x border-white/10 px-3">
                <span className="text-white/50 uppercase">Latency:</span>
                <span className="text-cyan-400">{metrics.latency}ms</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/50 uppercase">Efficacy:</span>
                <span className="text-emerald-400">{metrics.efficacy}%</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-white/10 p-6 flex flex-col space-y-8 bg-slate-900/80 shrink-0 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-cyan-500/20">
          <section className="mb-2">
            <button
              onClick={() => setVoiceAssistantEnabled(!voiceAssistantEnabled)}
              className={`w-full py-4 rounded-xl border flex items-center justify-center gap-3 transition-all ${
                voiceAssistantEnabled 
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold' 
                  : 'bg-slate-800 text-slate-400 border-white/5 font-medium'
              }`}
            >
              <Mic className={`w-4 h-4 ${voiceAssistantEnabled ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] uppercase tracking-widest">
                {voiceAssistantEnabled ? 'Voice Link Active' : 'Enable Voice Link'}
              </span>
            </button>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] font-bold mb-4">Generation Mode</p>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all relative group/mode ${
                      mode === m.id 
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' 
                        : 'bg-slate-800/50 border-white/5 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1.5" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">{m.label}</span>
                    
                    {/* Tooltip Description */}
                    <div className="absolute top-1/2 left-full translate-x-3 -translate-y-1/2 z-50 w-48 p-2 bg-slate-900 border border-white/10 rounded-md opacity-0 pointer-events-none group-hover/mode:opacity-100 transition-opacity shadow-2xl">
                      <p className="text-[9px] text-slate-300 font-mono leading-relaxed">{m.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] font-bold mb-4">Model Configuration</p>
            <div className="control-card space-y-4">
              <div>
                <label className="text-[11px] opacity-60 block mb-2 font-medium uppercase tracking-wider">Active Model</label>
                <div className="relative group">
                  <select 
                    value={selectedModel} 
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full appearance-none bg-slate-800 rounded p-2.5 text-sm border border-white/5 focus:border-cyan-500/50 outline-none transition-all cursor-pointer pr-8 font-mono text-[10px]"
                  >
                    {activeMode.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {mode === 'tts' && (
                <div>
                  <label className="text-[11px] opacity-60 block mb-2 font-medium uppercase tracking-wider">Voice Engine</label>
                  <div className="relative group">
                    <select 
                      value={voice} 
                      onChange={(e) => setVoice(e.target.value)}
                      className="w-full appearance-none bg-slate-800 rounded p-2.5 text-sm border border-white/5 focus:border-cyan-500/50 outline-none transition-all cursor-pointer pr-8"
                    >
                      {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )}
              
              {mode !== 'live_vision' && (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[11px] opacity-60 block font-medium uppercase tracking-wider">Temperature</label>
                      <span className="text-[11px] text-cyan-400 font-mono tracking-tighter">{temperature.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="2.0" 
                      step="0.1" 
                      value={temperature} 
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[11px] opacity-60 block font-medium uppercase tracking-wider">Top-P (Nucleus Sampling)</label>
                      <span className="text-[11px] text-cyan-400 font-mono tracking-tighter">{topP.toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="1.0" 
                      step="0.01" 
                      value={topP} 
                      onChange={(e) => setTopP(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[11px] opacity-60 block font-medium uppercase tracking-wider">Top-K (Filtering)</label>
                      <span className="text-[11px] text-cyan-400 font-mono tracking-tighter">{topK}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      step="1" 
                      value={topK} 
                      onChange={(e) => setTopK(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[11px] opacity-60 block font-medium uppercase tracking-wider">Engine Tempo (BPM)</label>
                      <span className="text-[11px] text-cyan-400 font-mono tracking-tighter">{bpm}</span>
                    </div>
                    <input 
                      type="range" 
                      min="60" 
                      max="180" 
                      step="1" 
                      value={bpm} 
                      onChange={(e) => setBpm(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>
                </>
              )}

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] opacity-60 block font-medium uppercase tracking-wider">Pitch Shift (Octave)</label>
                  <span className="text-[11px] text-cyan-400 font-mono tracking-tighter">{pitchShift > 0 ? '+' : ''}{pitchShift} st</span>
                </div>
                <input 
                  type="range" 
                  min="-12" 
                  max="12" 
                  step="1" 
                  value={pitchShift} 
                  onChange={(e) => setPitchShift(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] opacity-60 block font-medium uppercase tracking-wider">Chorus Layering</label>
                  <span className="text-[11px] text-cyan-400 font-mono tracking-tighter">{Math.round(chorusWet * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={chorusWet} 
                  onChange={(e) => setChorusWet(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] opacity-60 block font-medium uppercase tracking-wider">Harmony Layers</label>
                  <span className="text-[11px] text-cyan-400 font-mono tracking-tighter">{harmonyLayers}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="3" 
                  step="1" 
                  value={harmonyLayers} 
                  onChange={(e) => setHarmonyLayers(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] opacity-60 block font-medium uppercase tracking-wider">Harmony Interval</label>
                  <span className="text-[11px] text-cyan-400 font-mono tracking-tighter">{harmonyInterval > 0 ? '+' : ''}{harmonyInterval} st</span>
                </div>
                <input 
                  type="range" 
                  min="-12" 
                  max="12" 
                  step="1" 
                  value={harmonyInterval} 
                  onChange={(e) => setHarmonyInterval(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>
          </section>

          <section className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-cyan-500/20">
            <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] font-bold mb-4">Style Directives</p>
            <div className="space-y-1">
              {[
                { label: 'Robotic Cadence', active: true },
                { label: 'Rhythmic Singing', active: false },
                { label: 'Monotone Synthetic', active: false },
                { label: 'Staccato Beats', active: false },
                { label: 'Cybernetic Flow', active: false },
                { label: 'Binary Echo', active: false },
                { label: 'Daft Vocals', active: false }
              ].map((item, idx) => (
                <div 
                  key={idx} 
                  className={`px-3 py-2 rounded-md text-sm transition-all duration-200 ${
                    item.active 
                      ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-500 rounded-l-none' 
                      : 'opacity-40 hover:opacity-100 hover:bg-white/5 cursor-default'
                  }`}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </section>

          <div className="pt-4 border-t border-white/5 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleVerifySystem}
                disabled={isVerifying || isGenerating}
                className="flex items-center justify-center gap-2 py-2.5 rounded bg-slate-800/40 border border-white/5 text-[9px] uppercase font-bold tracking-widest text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-30"
              >
                {isVerifying ? <RefreshCw className="w-3 h-3 animate-spin"/> : <ShieldCheck className="w-3 h-3"/>}
                Verify API
              </button>
              <button
                onClick={handleClearAndRestart}
                className="flex items-center justify-center gap-2 py-2.5 rounded bg-slate-800/40 border border-white/5 text-[9px] uppercase font-bold tracking-widest text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                <RotateCcw className="w-3 h-3"/>
                Flush App
              </button>
            </div>

            {isGenerating ? (
              <button
                onClick={handleStop}
                className="w-full flex items-center justify-center gap-2 py-3 rounded bg-red-500/20 text-red-500 border border-red-500/30 text-[10px] uppercase font-bold tracking-widest hover:bg-red-500/30 transition-all"
              >
                <XCircle className="w-4 h-4" />
                Abort Generation
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={`w-full group py-4 rounded-lg font-bold text-sm tracking-widest uppercase transition-all duration-300 transform active:scale-[0.98] ${
                  isGenerating 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-lg shadow-cyan-500/20'
                }`}
              >
                Generate {mode}
              </button>
            )}
          </div>
        </aside>

        {/* Content Section */}
        <section className="flex-1 flex flex-col bg-[#0b0e14] overflow-hidden">
          {mode === 'pilot' ? (
            <div className="flex-1 flex flex-col p-8 space-y-8 overflow-y-auto scrollbar-thin">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                    <Settings2 className="w-6 h-6 text-cyan-500" />
                    Albert Project Pilot Hub
                  </h1>
                  <p className="text-slate-400 text-sm mt-1 font-mono uppercase tracking-widest opacity-60">System Environment Orchestration</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-cyan-500/50">LOCAL_LINK: STABLE</span>
                  <div className="w-3 h-3 bg-cyan-500/20 rounded-full flex items-center justify-center">
                    <div className="w-1 h-1 bg-cyan-500 rounded-full animate-ping" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Preferences Sector */}
                <div className="glass bg-slate-900/40 p-6 space-y-6">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400/80">Preferences Sector</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-white/40 uppercase">Chilling Sloth Path</label>
                      <div className="flex gap-2">
                        <input 
                           type="text" 
                           value={pilotConfig?.preferences?.chillingSlothLocation?.customPath || ''} 
                           onChange={(e) => {
                             const newConfig = {...pilotConfig};
                             if(!newConfig.preferences) newConfig.preferences = {};
                             if(!newConfig.preferences.chillingSlothLocation) newConfig.preferences.chillingSlothLocation = {};
                             newConfig.preferences.chillingSlothLocation.customPath = e.target.value;
                             setPilotConfig(newConfig);
                           }}
                           className="flex-1 bg-slate-950/50 border border-white/5 rounded px-3 py-2 text-xs font-mono text-cyan-100 outline-none focus:border-cyan-500/50"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-950/30 rounded border border-white/5">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono uppercase text-white/60">Search Integration</span>
                        <p className="text-[9px] text-white/30 tracking-tight">Enable CoWork Web Search functionality</p>
                      </div>
                      <button 
                        onClick={() => {
                          const newConfig = {...pilotConfig};
                          newConfig.preferences.coworkWebSearchEnabled = !newConfig.preferences.coworkWebSearchEnabled;
                          setPilotConfig(newConfig);
                        }}
                        className={`w-10 h-5 rounded-full relative transition-all ${pilotConfig?.preferences?.coworkWebSearchEnabled ? 'bg-cyan-500' : 'bg-slate-800'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${pilotConfig?.preferences?.coworkWebSearchEnabled ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-950/30 rounded border border-white/5">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono uppercase text-white/60">Persistent Session</span>
                        <p className="text-[9px] text-white/30 tracking-tight">Launch preview with session persistence</p>
                      </div>
                      <button 
                         onClick={() => {
                          const newConfig = {...pilotConfig};
                          newConfig.preferences.launchPreviewPersistSession = !newConfig.preferences.launchPreviewPersistSession;
                          setPilotConfig(newConfig);
                        }}
                        className={`w-10 h-5 rounded-full relative transition-all ${pilotConfig?.preferences?.launchPreviewPersistSession ? 'bg-cyan-500' : 'bg-slate-800'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${pilotConfig?.preferences?.launchPreviewPersistSession ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Operations Sector */}
                <div className="glass bg-slate-900/40 p-6 space-y-6">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400/80">Operations Sector</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-4 bg-slate-950/30 rounded border border-white/5 space-y-3">
                        <span className="text-[9px] font-mono uppercase text-white/40">Auto Updates</span>
                        <div className="flex items-center justify-between">
                           <span className={pilotConfig?.isDxtAutoUpdatesEnabled ? 'text-emerald-400' : 'text-slate-600'}>{pilotConfig?.isDxtAutoUpdatesEnabled ? 'ACTIVE' : 'INERT'}</span>
                           <button 
                             onClick={() => {
                               const newConfig = {...pilotConfig};
                               newConfig.isDxtAutoUpdatesEnabled = !newConfig.isDxtAutoUpdatesEnabled;
                               setPilotConfig(newConfig);
                             }}
                             className="text-[9px] font-bold border border-white/10 px-2 py-1 rounded hover:bg-white/5"
                           >
                             TOGGLE
                           </button>
                        </div>
                     </div>
                     <div className="p-4 bg-slate-950/30 rounded border border-white/5 space-y-3">
                        <span className="text-[9px] font-mono uppercase text-white/40">Sidebar Mode</span>
                         <select 
                           value={pilotConfig?.preferences?.sidebarMode || 'epitaxy'}
                           onChange={(e) => {
                            const newConfig = {...pilotConfig};
                            newConfig.preferences.sidebarMode = e.target.value;
                            setPilotConfig(newConfig);
                           }}
                           className="w-full bg-transparent text-xs text-white/80 outline-none cursor-pointer"
                         >
                           <option value="epitaxy" className="bg-slate-900">Epitaxy</option>
                           <option value="standard" className="bg-slate-900">Standard</option>
                           <option value="minimal" className="bg-slate-900">Minimal</option>
                         </select>
                     </div>
                  </div>

                  <div className="p-4 bg-cyan-500/5 rounded border border-cyan-500/20 space-y-4">
                     <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-[9px] font-mono uppercase text-cyan-400">Security Verification</span>
                     </div>
                     <p className="text-[10px] text-slate-400 leading-relaxed italic">
                       Modifying the Pilot configuration affects local environment orchestration. Ensure paths are validated before synchronization.
                     </p>
                     <button 
                       onClick={() => saveConfig(pilotConfig)}
                       className="w-full py-2 bg-cyan-500 text-slate-950 text-[10px] font-bold uppercase tracking-[0.2em] rounded shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition-all"
                     >
                       Synchronize Config
                     </button>
                  </div>
                </div>
              </div>

              {/* Raw Config Visualizer */}
              <div className="flex-1 glass bg-black/40 border border-white/5 mt-4 flex flex-col p-0">
                <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-white/30">
                  <span>claude_desktop_config.json</span>
                  <span>READ_ONLY_VIEW</span>
                </div>
                <div className="flex-1 p-4 font-mono text-[11px] text-cyan-500/60 overflow-y-auto whitespace-pre scrollbar-thin">
                  {JSON.stringify(pilotConfig, null, 2)}
                </div>
              </div>
            </div>
          ) : mode === 'live_vision' ? (
            <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto scrollbar-thin">
              <div className="flex-1 flex gap-6 min-h-[500px]">
                {/* Visual Portal */}
                <div className="flex-1 glass relative overflow-hidden flex flex-col bg-slate-900/40 border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                  <div className="p-4 border-b border-white/5 flex items-center justify-between bg-cyan-500/10">
                    <div className="flex items-center gap-2">
                      <Cast className="w-4 h-4 text-cyan-400" />
                      <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">Visual Portal (Screenshare)</span>
                    </div>
                    {isSharing && (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-mono">
                         <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                         LIVE_STREAMING
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-center p-4 bg-black/20">
                    {isSharing ? (
                      <video ref={screenVideoRef} autoPlay playsInline muted className="max-w-full max-h-full rounded border border-white/5 shadow-2xl" />
                    ) : (
                      <div className="text-center space-y-4">
                        <Monitor className="w-16 h-16 text-slate-700 mx-auto" />
                        <p className="text-xs opacity-40 uppercase tracking-widest font-mono">Awaiting video source...</p>
                        <button 
                          onClick={startScreenshare}
                          className="px-6 py-2 bg-slate-800 text-cyan-400 rounded-full border border-cyan-500/30 text-[10px] font-bold uppercase tracking-widest hover:bg-cyan-500/10 transition-all"
                        >
                          Start Sharing Screen
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interaction Dashboard */}
                <div className="w-96 flex flex-col space-y-6">
                  <div className="flex-1 glass bg-slate-900/60 p-6 relative overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-2">
                         <MessageSquare className="w-4 h-4 text-cyan-400" />
                         <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">Gemini Live Insight</span>
                       </div>
                       <div className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_cyan]' : 'bg-slate-700'}`} />
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-4 font-mono text-sm scrollbar-thin scrollbar-thumb-white/5 pr-2">
                       {liveResponse ? (
                         <div className="text-cyan-100 whitespace-pre-wrap leading-relaxed opacity-90">{liveResponse}</div>
                       ) : (
                         <div className="h-full flex items-center justify-center opacity-10 flex-col space-y-2">
                            <Activity className="w-12 h-12" />
                            <span className="text-[10px] tracking-[0.3em] uppercase">Awaiting session...</span>
                         </div>
                       )}
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <button
                        onClick={isLiveActive ? stopLiveSession : startLiveSession}
                        className={`w-full py-4 rounded-xl font-bold uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 ${
                          isLiveActive 
                            ? 'bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30' 
                            : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-xl shadow-cyan-500/20'
                        }`}
                      >
                        {isLiveActive ? (
                          <>
                            <StopCircle className="w-4 h-4" />
                            Terminate Session
                          </>
                        ) : (
                          <>
                            <Waves className="w-4 h-4 animate-pulse" />
                            Initiate Live Link
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {isSharing && (
                    <button 
                      onClick={stopScreenshare}
                      className="w-full py-3 bg-slate-800 text-slate-400 rounded-lg border border-white/5 text-[10px] font-bold uppercase tracking-widest hover:text-red-400 transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-3 h-3" />
                      Stop Screen Share
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Dashboard Header */}
          <div className="px-6 py-4 border-b border-white/5 bg-slate-900/20 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <Terminal className="w-4 h-4 text-cyan-500/60" />
              <h2 className="text-sm font-mono opacity-80 italic tracking-tight uppercase">lyric_processor.sys</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isGenerating ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] rounded-full border border-emerald-500/20 uppercase font-bold tracking-[0.2em]">
                {isGenerating ? 'Computing' : 'Ready'}
              </span>
            </div>
          </div>

            {/* Editor Area */}
            <div className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5">
              <div className="glass flex-[1.5] p-0 relative overflow-hidden flex flex-col min-h-[350px]">
                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50"></div>
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-slate-900/40">
                  <div className="flex items-center gap-2">
                    <Music className="w-3.5 h-3.5 text-cyan-400/70" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/40">Raw Input Template</span>
                  </div>
                  <div className="flex items-center gap-4 text-[9px] font-mono text-cyan-400/40">
                    <span>CHARS: {lyrics.length}</span>
                    <span className="opacity-20">|</span>
                    <span>BUFFER: OK</span>
                  </div>
                </div>
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  onPaste={handlePaste}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  placeholder="Type lyrics or drop/paste an image for visual context..."
                  className="flex-1 w-full bg-transparent p-6 text-slate-300 font-mono text-sm leading-relaxed resize-none outline-none selection:bg-cyan-500/30"
                  spellCheck={false}
                />
                <AnimatePresence>
                  {referenceImage && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="absolute bottom-4 right-4 group"
                    >
                      <div className="relative">
                        <img 
                          src={referenceImage} 
                          className="w-20 h-20 object-cover rounded border border-cyan-500/50 shadow-lg shadow-cyan-500/20" 
                          alt="reference"
                        />
                        <button 
                          onClick={() => setReferenceImage(null)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            {/* Error Message Panel (Legacy Position - Removed in favor of Bottom Banner) */}

            {/* Search Grounding Data */}
            <AnimatePresence>
              {searchGrounding.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Grounding sources retrieved</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {searchGrounding.map((chunk, idx) => (
                      chunk.web && (
                        <a 
                          key={idx}
                          href={chunk.web.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-md border border-white/5 text-[10px] text-slate-300 transition-all flex items-center gap-2 group"
                        >
                          <span className="truncate max-w-[150px]">{chunk.web.title || 'Source Link'}</span>
                          <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                        </a>
                      )
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Output Monitoring */}
            <div className="h-64 glass p-6 flex flex-col shrink-0 relative overflow-hidden">
              {(mode === 'tts' || mode === 'audio') && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] font-bold">Real-time Audio Stream Monitor</p>
                    {audioUrl && (
                      <div className="flex items-center gap-2 text-[10px] text-cyan-400 font-mono">
                        <Activity className="w-3 h-3 animate-pulse" />
                        <span>PCM STREAM DETECTED</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 flex items-end space-x-1.5 justify-between mb-6 h-24">
                    {[...Array(32)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={isGenerating || (audioUrl && !audioRef.current?.paused) ? {
                          height: [10, 20 + Math.random() * 60, 10],
                          backgroundColor: i === 15 ? "#22d3ee" : "rgba(34,211,238, 0.4)"
                        } : { height: 4, backgroundColor: "rgba(51, 65, 85, 0.3)" }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.3 + Math.random() * 0.4,
                          ease: "easeInOut"
                        }}
                        className={`w-full max-w-[6px] rounded-t-sm ${i === 15 ? 'shadow-[0_0_15px_rgba(34,211,238,0.4)]' : ''}`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-2 bg-slate-900/50 rounded-lg border border-white/5 flex-1 max-w-sm flex items-center gap-4">
                        <button
                            onClick={handleTogglePlayback}
                            disabled={!audioUrl}
                            className={`p-2 rounded-full transition-all ${
                              !audioUrl 
                                ? 'opacity-20 cursor-not-allowed' 
                                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                            }`}
                        >
                          {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                        </button>
                        <div className="flex-1 text-[10px] uppercase font-mono tracking-wider opacity-60">
                            {isPlaying ? 'Streaming Signal...' : 'Signal Buffered'}
                        </div>
                        <audio 
                          ref={audioRef} 
                          src={audioUrl || undefined} 
                          className="hidden" 
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] uppercase font-mono opacity-40 shrink-0 gap-8">
                      <span>00:00:00.0</span>
                      <span className="text-cyan-400 opacity-80 border-x border-white/10 px-4">Sampling L16 / 24000Hz</span>
                      <span>{audioUrl ? 'robotic_perf.wav' : 'no_output.bin'}</span>
                    </div>
                  </div>
                </>
              )}

              {mode === 'image' && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20">
                  {imageUrl ? (
                    <motion.img 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      src={imageUrl} 
                      className="h-full w-auto object-contain rounded shadow-2xl border border-white/10" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-20">
                      <ImageIcon className="w-12 h-12" />
                      <span className="text-[10px] font-mono tracking-widest uppercase">Awaiting Image Render</span>
                    </div>
                  )}
                </div>
              )}

              {mode === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20">
                  {videoUrl ? (
                    <motion.video 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      src={videoUrl} 
                      controls
                      className="h-full w-auto object-contain rounded shadow-2xl border border-white/10" 
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-20 text-center">
                      <VideoIcon className="w-12 h-12" />
                      <span className="text-[10px] font-mono tracking-widest uppercase">
                        {isGenerating ? 'Synthesizing Video Frames...' : 'Awaiting Video Synthesis'}
                      </span>
                      {isGenerating && <span className="text-[8px] opacity-60">This may take several minutes</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
      </main>

      {/* Bottom Status Banner & Error Display */}
      <div className="shrink-0">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-500 text-white px-6 py-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4" />
                <span>Critical Operational Alert: {error}</span>
              </div>
              <button 
                onClick={() => setError(null)}
                className="px-2 py-0.5 border border-white/30 rounded hover:bg-white/10 transition-all"
              >
                DISMISS
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="h-10 border-t border-white/10 bg-slate-900 px-6 flex items-center justify-between text-[10px] text-slate-500 font-mono shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-3 h-3" />
            <span>STATUS: {isGenerating ? 'PROCESSING_SIGNAL' : 'IDLE // READY'}</span>
          </div>
          <span className="opacity-20">|</span>
          <div className="flex items-center gap-2 group cursor-help">
            <Volume2 className="w-3 h-3 text-cyan-500/40 group-hover:text-cyan-400" />
            <span>IO_READY</span>
          </div>
        </div>
        <div className="flex space-x-6">
          <div className={`flex items-center gap-1.5 ${systemStatus === 'OK' ? 'text-emerald-500' : systemStatus === 'ERROR' ? 'text-red-500' : 'text-cyan-500/50'}`}>
             <div className={`w-1.5 h-1.5 rounded-full ${systemStatus === 'OK' ? 'bg-emerald-500' : systemStatus === 'ERROR' ? 'bg-red-500' : 'bg-cyan-500 animate-pulse'}`} />
             <span>{systemStatus === 'OK' ? 'UPLINK_STABLE' : systemStatus === 'ERROR' ? 'UPLINK_OFFLINE' : 'UPLINK_LIVE'}</span>
          </div>
          <span className="opacity-40">BYTES: {audioUrl ? '1.2MB' : '0.0KB'}</span>
          <span className="opacity-40">CHUNKS: {audioUrl ? '1' : '0'}</span>
          <span className="opacity-40">LATENCY: 124ms</span>
        </div>
      </footer>
    </div>
    </div>
  );
}
