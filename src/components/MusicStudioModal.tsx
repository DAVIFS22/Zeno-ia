import { useTranslation } from '../i18n';
import React, { useState, useEffect } from 'react';
import { 
  X, Music, Sparkles, Copy, Check, Volume2, AlertCircle, AlertTriangle, SlidersHorizontal, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { checkUsageLimit, FREE_LIMITS } from '../lib/subscription';
import { hasPremiumAccess } from '../config/admin';
import { copyToClipboard } from '../utils/clipboard';

interface MusicStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPlan: string;
  userEmail: string;
  dailyUsage: any;
  onUpdateUsage: (newUsage: any) => void;
  geminiApiKey?: string;
}

export const MusicStudioModal: React.FC<MusicStudioModalProps> = ({
  isOpen,
  onClose,
  userPlan,
  userEmail,
  dailyUsage,
  onUpdateUsage,
  geminiApiKey
}) => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [keySig, setKeySig] = useState('Alegre e leve');
  const [tempo, setTempo] = useState('Normal (100 BPM)');
  const [mode, setMode] = useState<'pro' | 'clip'>('pro');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [loadingText, setLoadingText] = useState(t.musicStudio.generating);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [songData, setSongData] = useState<{
    title: string;
    genre: string;
    key: string;
    tempo: string;
    lyrics: string;
    chordsSummary: string;
    audioUrl?: string;
    notice?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdmin = hasPremiumAccess(userEmail);
  const usageCheck = checkUsageLimit(userPlan as any, dailyUsage, 'music');

  const genres = [
    'Pop', 'Acoustic / Violão', 'Funk', 'Lo-Fi / Relax', 'Sertanejo', 
    'Rock', 'Eletrônica / Dance', 'MPB / Bossa Nova', 'Rap / Trap'
  ];

  const keys = [
    { label: 'Alegre e leve', value: 'Alegre e leve' },
    { label: 'Emotivo e triste', value: 'Emotivo e triste' }
  ];

  const tempos = [
    { label: 'Calmo (80 BPM)', value: '80 BPM' },
    { label: 'Normal (100 BPM)', value: '100 BPM' },
    { label: 'Animado (120 BPM)', value: '120 BPM' },
    { label: 'Rápido (140 BPM)', value: '140 BPM' }
  ];

  // Helper to strip out debug/notice tags and filler commentary from generated lyrics
  const cleanLyricsAndNotice = (rawText: string): { lyrics: string; notice?: string } => {
    if (!rawText) return { lyrics: '' };

    let notice: string | undefined = undefined;
    let text = rawText;

    // Detect and strip notice text if embedded in raw response
    if (
      text.includes('[Aviso:') ||
      text.includes('Aviso:') ||
      text.includes('cota do modelo') ||
      text.includes('Cota do modelo') ||
      text.includes('limite de uso atingido') ||
      text.includes('temporariamente indisponível')
    ) {
      notice = "Não foi possível gerar o áudio agora (limite de uso atingido). Sua letra foi criada normalmente.";
      text = text.replace(/\s*\[?Aviso:[^\]\n]*\]?\n*/gi, '');
      text = text.replace(/\s*\[?Aviso:[^\]\n]*\]?\n*/gi, '');
    }

    // Strip AI meta conversational introductions
    text = text.replace(/\s*\[?Aviso:[^\]\n]*\]?\n*/gi, '');
    text = text.replace(/\s*\[?Aviso:[^\]\n]*\]?\n*/gi, '');
    text = text.replace(/\s*\[?Aviso:[^\]\n]*\]?\n*/gi, '');
    text = text.replace(/\s*\[?Aviso:[^\]\n]*\]?\n*/gi, '');
    text = text.replace(/\s*\[?Aviso:[^\]\n]*\]?\n*/gi, '');
    text = text.replace(/moderna e comercial, estruturada nos padrões[^\n]*\n*/gi, '');

    // Strip lone section divider lines "---"
    text = text.replace(/\s*\[?Aviso:[^\]\n]*\]?\n*/gi, '');

    // Normalize multiple empty lines
    text = text.replace(/\n{3,}/g, '\n\n');

    return { lyrics: text.trim(), notice };
  };

  // Animated progress bar simulation during API call using requestAnimationFrame (120Hz/60Hz optimized)
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    if (isGenerating) {
      setProgressPercent(5);
      setLoadingText(t.musicStudio.generating);

      const tick = (now: number) => {
        if (now - lastTime >= 200) {
          lastTime = now;
          setProgressPercent((prev) => {
            if (prev >= 92) return 92;
            const increment = prev < 40 ? 12 : prev < 75 ? 6 : 2;
            return Math.min(92, prev + increment);
          });
        }
        animId = requestAnimationFrame(tick);
      };

      animId = requestAnimationFrame(tick);
    } else {
      setProgressPercent(0);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isGenerating]);

  const handleGenerate = async () => {
    if (!isAdmin && !usageCheck.allowed) {
      onClose();
      return;
    }

    if (!prompt.trim()) return;

    setIsGenerating(true);
    setErrorMsg(null);
    setSongData(null);

    const keyMapping: Record<string, string> = {
      'Alegre e leve': 'C Major',
      'Emotivo e triste': 'A Minor'
    };
    const technicalKeySig = keyMapping[keySig] || keySig || 'C Major';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt,
          genre,
          keySig: technicalKeySig,
          tempo,
          mode,
          geminiApiKey
        })
      });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.musicStudio.errorGen);
      }

      setProgressPercent(100);

      let audioUrl: string | undefined = undefined;
      if (data.audioData) {
        const binary = atob(data.audioData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
        audioUrl = URL.createObjectURL(blob);
      }

      const { lyrics: cleanedLyrics, notice: extractedNotice } = cleanLyricsAndNotice(data.lyrics || '');
      const finalNotice = data.notice || extractedNotice || (!audioUrl ? "Não foi possível gerar o áudio agora (limite de uso atingido). Sua letra foi criada normalmente." : undefined);

      setSongData({
        title: data.title || prompt.slice(0, 35),
        genre: data.genre || genre,
        key: data.key || keySig,
        tempo: data.tempo || tempo,
        lyrics: cleanedLyrics,
        chordsSummary: data.chordsSummary || keySig,
        audioUrl,
        notice: finalNotice
      });

      // Increment usage count if not admin
      if (!isAdmin) {
        const updated = {
          ...dailyUsage,
          musicGenCount: (dailyUsage.musicGenCount || 0) + 1
        };
        onUpdateUsage(updated);
      }

    } catch (err: any) {
      console.error(err);
      if (err.name === 'AbortError') {
        setErrorMsg('Tempo limite excedido. O servidor demorou para responder, tente novamente.');
      } else {
        setErrorMsg(err.message || t.musicStudio.errorOccurred);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!songData) return;
    const text = `${t.musicStudio.music}: ${songData.title}\n${t.musicStudio.genre}: ${songData.genre} | Tom: ${songData.key} | Ritmo: ${songData.tempo}\n\n${t.musicStudio.lyrics}:\n${songData.lyrics}`;
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-[#141416] border border-[#2C2C2E] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2C2C2E] bg-[#1C1C1E]/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2C2C2E] text-[#D4D4D8] rounded-xl border border-[#3A3A3C]">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#F5F5F5] tracking-tight">{t.musicStudio.title}</h2>
              <p className="text-xs text-[#9A9A9E]">{t.musicStudio.subtitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-[#9A9A9E] hover:text-[#F5F5F5] rounded-xl hover:bg-[#2C2C2E] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="music-studio-form p-6 overflow-y-auto space-y-5 flex-1 bg-[#121212]">
          {/* Usage Counter Badge for Free users */}
          {!isAdmin && (
            <div className="flex items-center justify-between bg-[#1C1C1E] border border-[#2C2C2E] px-4 py-2.5 rounded-xl text-xs">
              <span className="text-[#9A9A9E]">{t.musicStudio.freeGenerations}</span>
              <span className="font-semibold text-[#F5F5F5]">
                {usageCheck.remaining} de {FREE_LIMITS.MUSIC_PER_DAY}
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-[#121212]/40 border border-neutral-900/60 rounded-xl text-xs text-neutral-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-neutral-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Main Prompt Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#F5F5F5]">{t.musicStudio.yourIdea}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.musicStudio.yourIdeaPlaceholder}
              rows={3}
              className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-3 text-sm text-[#F5F5F5] placeholder-[#6E6E73] focus:outline-none focus:border-[#4A4A4E] transition-colors resize-none"
            />
          </div>

          {/* Advanced Options Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs font-medium text-[#9A9A9E] hover:text-[#F5F5F5] transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{t.musicStudio.advancedOptions}</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-[#9A9A9E]">{t.musicStudio.style}</label>
                      <select
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl px-3 py-2 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#4A4A4E]"
                      >
                        {genres.map(g => <option key={g} value={g} className="bg-[#1C1C1E] text-[#F5F5F5]">{g}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-[#9A9A9E]">{t.musicStudio.key}</label>
                      <select
                        value={keySig}
                        onChange={(e) => setKeySig(e.target.value)}
                        className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl px-3 py-2 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#4A4A4E]"
                      >
                        {keys.map(k => <option key={k.value} value={k.value} className="bg-[#1C1C1E] text-[#F5F5F5]">{k.label}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-[#9A9A9E]">{t.musicStudio.tempo}</label>
                      <select
                        value={tempo}
                        onChange={(e) => setTempo(e.target.value)}
                        className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl px-3 py-2 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#4A4A4E]"
                      >
                        {tempos.map(t => <option key={t.value} value={t.value} className="bg-[#1C1C1E] text-[#F5F5F5]">{t.label}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-[#9A9A9E]">{t.musicStudio.duration}</label>
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value as 'pro' | 'clip')}
                        className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl px-3 py-2 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#4A4A4E]"
                      >
                        <option value="pro" className="bg-[#1C1C1E]">{t.musicStudio.durationFull}</option>
                        <option value="clip" className="bg-[#1C1C1E]">{t.musicStudio.durationPreview}</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Loading status with styled visual progress bar */}
          {isGenerating ? (
            <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-[#F5F5F5]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin text-neutral-400" />
                  <span>{loadingText}</span>
                </div>
                <span className="text-[#9A9A9E] font-mono">{progressPercent}%</span>
              </div>

              {/* Progress Bar Track (120fps GPU accelerated scaleX) */}
              <div className="w-full h-2.5 bg-[#2C2C2E] rounded-full overflow-hidden p-0.5 border border-[#3A3A3C] contain-render">
                <div 
                  className="h-full w-full bg-gradient-to-r from-neutral-500 via-sky-500 to-neutral-400 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-transform duration-300 ease-out will-change-transform origin-left"
                  style={{ transform: `scaleX(${progressPercent / 100})` }}
                />
              </div>

              <p className="text-[11px] text-[#9A9A9E] text-center">
                Estamos compondo a harmonia e gerando o áudio para você.
              </p>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className="w-full py-3.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] border border-[#4A4A4E] text-[#F5F5F5] rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <Music className="w-4 h-4 text-[#D4D4D8]" />
              <span>{t.musicStudio.generateBtn}</span>
            </button>
          )}

          {/* Result Section */}
          {songData && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 space-y-4 pt-4 border-t border-[#2C2C2E]"
            >
              {/* 1. Header with Song Title, Metadata Badges, & Action */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-[#F5F5F5]">{songData.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="px-2.5 py-0.5 bg-[#1C1C1E] border border-[#2C2C2E] rounded-md text-[11px] font-medium text-[#D4D4D8]">
                      {songData.genre}
                    </span>
                    <span className="px-2.5 py-0.5 bg-[#1C1C1E] border border-[#2C2C2E] rounded-md text-[11px] font-medium text-[#9A9A9E]">
                      Tom: {songData.key}
                    </span>
                    <span className="px-2.5 py-0.5 bg-[#1C1C1E] border border-[#2C2C2E] rounded-md text-[11px] font-medium text-[#9A9A9E]">
                      Ritmo: {songData.tempo}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleCopy}
                  className="p-2 bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-[#2C2C2E] text-[#D4D4D8] rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  title="Copiar Letra"
                >
                  {copied ? <Check className="w-4 h-4 text-[#F5F5F5]" /> : <Copy className="w-4 h-4" />}
                  <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              {/* 2. Standardized Alert Banner Component (if quota/audio limitation occurred) */}
              {songData.notice && (
                <div className="flex items-center gap-3 p-3.5 bg-[#2A2A1F] border border-[#4A4A2E] rounded-xl text-xs text-neutral-200/90 leading-relaxed shadow-sm">
                  <AlertTriangle className="w-4 h-4 text-neutral-400 shrink-0" />
                  <span>{songData.notice}</span>
                </div>
              )}

              {/* 3. Audio Player Block / State */}
              <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-[#F5F5F5]">
                  <Volume2 className="w-4 h-4 text-[#D4D4D8]" />
                  <span>{t.musicStudio.generatedMusic}</span>
                </div>
                {songData.audioUrl ? (
                  <>
                    <audio controls src={songData.audioUrl} className="w-full accent-neutral-400" />
                    <p className="text-[10px] text-[#9A9A9E]">
                      ℹ️ Áudio gerado por IA contendo marca d'água SynthID de identificação de conteúdo.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-[#9A9A9E] italic">{t.musicStudio.audioUnavailable}</p>
                )}
              </div>

              {/* 4. Formatted Lyrics & Composition Box */}
              <div className="bg-[#121212] border border-[#2C2C2E] rounded-xl p-4 font-mono text-xs text-[#D4D4D8] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {songData.lyrics}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

