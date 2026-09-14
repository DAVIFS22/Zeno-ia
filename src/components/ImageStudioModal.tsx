import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Sparkles, Download, Copy, Check, RefreshCw, Sliders, Layers, Maximize2, ExternalLink, Wand2, Palette, Heart, Trash2, Search, RotateCcw, Edit3, Filter, Users, Clock, XCircle, Camera, PenTool, Flower, Clapperboard, Box, Building2, Flame, Rocket, Image, Brush, Triangle, Tag, Diamond, Circle, Hexagon, Square, Monitor, Smartphone, Loader2 } from 'lucide-react';
import { downloadImage } from '../lib/downloadHelper';
import { GeneratedImage } from '../types';
import { useTranslation } from '../i18n';
import { getStoredImages, saveStoredImages, addImageToLibrary } from '../lib/imageLibraryStorage';
import { copyToClipboard } from '../utils/clipboard';

interface ImageStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onSendToChat?: (imageUrl: string, prompt: string) => void;
  userEmail?: string;
  userId?: string;
  plan?: 'ZENO Free' | 'ZENO Pro';
  onOpenProFeatureModal?: () => void;
  onLimitReached?: () => void;
}

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  isOpen,
  onClose,
  theme,
  onSendToChat,
  userEmail,
  userId,
  plan,
  onOpenProFeatureModal,
  onLimitReached
}) => {
  const { t } = useTranslation();

  const STYLES = [
    { id: 'photorealistic', name: t.imageStudio.styles.photorealistic, icon: Camera, desc: 'Fotografia profissional 8K e luzes cinematográficas' },
    { id: 'ultra-realista', name: t.imageStudio.styles.ultraRealistic, icon: Camera, desc: 'Textura ultra detalhada, lente DSLR e profundidade' },
    { id: 'anime', name: t.imageStudio.styles.anime, icon: Palette, desc: 'Estilo de animação japonesa moderna' },
    { id: 'manga', name: t.imageStudio.styles.manga, icon: PenTool, desc: 'Traços em preto e branco marcantes' },
    { id: 'ghibli', name: t.imageStudio.styles.ghibli, icon: Flower, desc: 'Cenários poéticos desenhados à mão' },
    { id: 'pixar', name: t.imageStudio.styles.pixar, icon: Clapperboard, desc: 'Personagens 3D carismáticos e iluminação suave' },
    { id: '3d-render', name: t.imageStudio.styles.threeDRender, icon: Box, desc: 'Unreal Engine 5, Ray Tracing e Octane' },
    { id: 'cyberpunk', name: t.imageStudio.styles.cyberpunk, icon: Building2, desc: 'Neon cintilante e metrópole futurista' },
    { id: 'fantasy', name: t.imageStudio.styles.fantasy, icon: Flame, desc: 'Mundos mágicos e trajes detalhados' },
    { id: 'scifi', name: t.imageStudio.styles.scifi, icon: Rocket, desc: 'Tecnologia avançada e paisagens cósmicas' },
    { id: 'concept-art', name: t.imageStudio.styles.conceptArt, icon: Image, desc: 'Ilustração conceitual para cinema e jogos' },
    { id: 'digital', name: t.imageStudio.styles.digitalPainting, icon: Brush, desc: 'Pinceladas expressivas e cores ricas' },
    { id: 'watercolor', name: t.imageStudio.styles.watercolor, icon: Palette, desc: 'Pinceladas suaves de água e tons pastéis' },
    { id: 'vector', name: t.imageStudio.styles.vector, icon: Triangle, desc: 'Ilustração plana e formas geométricas limpas' },
    { id: 'logo', name: t.imageStudio.styles.logo, icon: Tag, desc: 'Design de marca minimalista e escalável' },
    { id: 'icon', name: t.imageStudio.styles.icon, icon: Diamond, desc: 'Símbolo em relevo para aplicativos e UI' },
    { id: 'minimalist', name: t.imageStudio.styles.minimalist, icon: Circle, desc: 'Composição limpa com espaço negativo' },
    { id: 'low-poly', name: t.imageStudio.styles.lowPoly, icon: Hexagon, desc: 'Arte em polígonos geométricos estilizados' }
  ];

  const ASPECT_RATIOS = [
    { id: '1:1', name: t.imageStudio.ratios.square, icon: Square },
    { id: '16:9', name: t.imageStudio.ratios.widescreen, icon: Monitor },
    { id: '9:16', name: t.imageStudio.ratios.stories, icon: Smartphone },
    { id: '4:3', name: t.imageStudio.ratios.classic, icon: Image },
    { id: '3:2', name: t.imageStudio.ratios.photo, icon: Camera }
  ];

  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('photorealistic');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [speedMode, setSpeedMode] = useState<'turbo' | 'quality'>('quality');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = getStoredImages(userId);
        setHistory(stored);
        if (stored.length > 0 && !currentImage) {
          setCurrentImage(stored[0]);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (history.length > 0) {
      try {
        saveStoredImages(history, userId);
      } catch (e) {
        console.error(e);
      }
    }
  }, [history, userId]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadDoneId, setDownloadDoneId] = useState<string | null>(null);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);



  if (!isOpen) return null;

  const handleCancelTask = async () => {
    if (!activeTaskId) return;
    try {
      await fetch('/api/tasks/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: activeTaskId, userEmail })
      });
    } catch (err) {
      console.error('Erro ao cancelar:', err);
    } finally {
      setIsGenerating(false);
      setActiveTaskId(null);
      setQueuePosition(null);
      setEstimatedTime(null);
    }
  };

  const pollTaskStatus = async (taskId: string, targetPrompt: string) => {
    try {
      const statusRes = await fetch(`/api/tasks/status/${taskId}`);
      if (!statusRes.ok) throw new Error('Falha ao obter status');
      
      const statusData = await statusRes.json();
      const task = statusData.task || statusData;
      const status = task.status;
      const result = task.result;
      
      if (status === 'completed') {
        const newImg = addImageToLibrary({
          imageUrl: result?.imageUrl || task.imageUrl,
          prompt: result?.prompt || task.prompt || targetPrompt,
          originalPrompt: result?.originalPrompt || targetPrompt,
          optimizedPrompt: result?.prompt || targetPrompt,
          aspectRatio: result?.aspectRatio || selectedRatio,
          style: result?.style || selectedStyle,
          seed: result?.seed,
          model: 'Estúdio ZENO Vision',
          provider: 'Flux Dev',
          collection: 'Geral',
        });
        setCurrentImage(newImg);
        setHistory(prev => [newImg, ...prev]);
        setIsGenerating(false);
        setActiveTaskId(null);
        setQueuePosition(null);
        setEstimatedTime(null);
      } else if (status === 'failed') {
        throw new Error(task.error || 'Erro interno no processamento do motor ZENO.');
      } else if (status === 'cancelled') {
        throw new Error('Geração de imagem cancelada.');
      } else {
        // Update live metrics
        if (statusData.position !== undefined) setQueuePosition(statusData.position);
        if (statusData.estimatedTimeSeconds !== undefined) setEstimatedTime(statusData.estimatedTimeSeconds);
        
        // Schedule next poll
        setTimeout(() => pollTaskStatus(taskId, targetPrompt), 1500);
      }
    } catch (pollErr: any) {
      console.error('[POLLING ERROR]', pollErr);
      setQueueError(pollErr?.message || 'Erro de rede ou processamento na fila.');
      setIsGenerating(false);
      setActiveTaskId(null);
      setQueuePosition(null);
      setEstimatedTime(null);
    }
  };

  const handleGenerate = async (customPrompt?: string) => {
    const targetPrompt = (customPrompt || prompt).trim();
    if (!targetPrompt || isGenerating) return;

    setIsGenerating(true);
    setActiveTaskId(null);
    setQueuePosition(null);
    setEstimatedTime(null);
    setQueueError(null);

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: targetPrompt,
          style: selectedStyle,
          aspectRatio: selectedRatio,
          enhance: true,
          speedMode,
          userEmail,
          userId,
          plan
        }),
      });

      if (res.status === 403 || res.status === 429) {
        setIsGenerating(false);
        onClose(); // Close studio
        if (res.status === 429) {
          if (onLimitReached) onLimitReached();
        } else if (plan === 'ZENO Free') {
          // Pro gate
          if (onOpenProFeatureModal) onOpenProFeatureModal();
        }
        return;
      }

      if (!res.ok) throw new Error('Erro na geração da imagem');

      const data = await res.json();

      // Check if task is queued (ZENO Free)
      if (data.taskId) {
        setActiveTaskId(data.taskId);
        if (data.position !== undefined) setQueuePosition(data.position);
        if (data.estimatedTimeSeconds !== undefined) setEstimatedTime(data.estimatedTimeSeconds);
        
        // Start polling task status
        pollTaskStatus(data.taskId, targetPrompt);
      } else {
        // Direct response (ZENO Pro or Admin)
        const newImg = addImageToLibrary({
          imageUrl: data.imageUrl,
          prompt: data.prompt,
          originalPrompt: data.originalPrompt || targetPrompt,
          optimizedPrompt: data.prompt,
          aspectRatio: data.aspectRatio || selectedRatio,
          style: data.style || selectedStyle,
          seed: data.seed,
          model: 'Estúdio ZENO Vision',
          provider: 'Flux Dev',
          collection: 'Geral',
        });

        setCurrentImage(newImg);
        setHistory(prev => [newImg, ...prev]);
        setIsGenerating(false);
      }
    } catch (err: any) {
      console.error(err);
      setQueueError(err?.message || 'Não foi possível gerar a imagem neste momento.');
      setIsGenerating(false);
    }
  };

  const toggleFavorite = (id: string) => {
    setHistory(prev => prev.map(img => {
      if (img.id === id) {
        const nextFav = !img.isFavorite;
        if (currentImage?.id === id) {
          setCurrentImage({ ...currentImage, isFavorite: nextFav });
        }
        return { ...img, isFavorite: nextFav };
      }
      return img;
    }));
  };

  const deleteImage = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(img => img.id !== id);
      try {
        localStorage.setItem('zeno_image_library', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      if (currentImage?.id === id) {
        setCurrentImage(updated[0] || null);
      }
      return updated;
    });
  };

  const handleCopyLink = (url: string, id: string) => {
    copyToClipboard(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = async (url: string, filename: string, id?: string) => {
    if (isDownloading) return;
    setIsDownloading(true);
    await downloadImage(url, filename || `zeno-${Date.now()}.jpg`);
    setIsDownloading(false);
    if (id) {
      setDownloadDoneId(id);
      setTimeout(() => setDownloadDoneId(null), 2500);
    }
  };

  const filteredHistory = history.filter(img => {
    const matchesSearch = !searchQuery || 
      img.prompt.toLowerCase().includes(searchQuery.toLowerCase()) || 
      img.originalPrompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || (activeTab === 'favorites' && img.isFavorite);
    return matchesSearch && matchesTab;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className={`relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
        theme === 'dark' ? 'bg-[#18181c] border-[#2C2C2E] text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          theme === 'dark' ? 'border-[#2C2C2E] bg-[#171717]' : 'border-neutral-200 bg-neutral-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#232326] border border-[#2C2C2E] text-neutral-200 shadow-md">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                {t.imageStudio.title}
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#232326] text-neutral-300 border border-[#2C2C2E]">
                  {t.imageStudio.subtitle}
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                {t.imageStudio.description}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-[#232326] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Body Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 scrollbar-custom">
          {/* Left Controls Column (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-5">
            {/* Prompt Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
                <span>{t.imageStudio.promptLabel}</span>
                <span className="text-[11px] text-neutral-400 font-normal">{t.composer.speedSmart}</span>
              </label>
              <div className={`relative rounded-2xl border transition-all ${
                theme === 'dark' ? 'bg-[#212121] border-[#2C2C2E] focus-within:border-neutral-500' : 'bg-neutral-50 border-neutral-300 focus-within:border-neutral-500'
              }`}>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t.imageStudio.promptPlaceholder}
                  rows={4}
                  className="w-full p-3.5 bg-transparent border-none focus:outline-none resize-none text-sm leading-relaxed text-neutral-200 placeholder-neutral-500"
                />
              </div>
            </div>

            {/* Style Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t.imageStudio.styleLabel}</span>
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-custom">
                {STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      selectedStyle === style.id
                        ? 'bg-neutral-700 border-neutral-500 text-neutral-100 font-semibold shadow-xs'
                        : theme === 'dark'
                          ? 'bg-[#212121] border-[#2C2C2E] hover:border-[#2C2C2E] text-neutral-300'
                          : 'bg-neutral-100 border-neutral-200 hover:border-neutral-300 text-neutral-700'
                    }`}
                  >
                    <style.icon className="w-5 h-5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{style.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t.imageStudio.ratioLabel}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIOS.map(ratio => (
                  <button
                    key={ratio.id}
                    onClick={() => setSelectedRatio(ratio.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-xs font-medium ${
                      selectedRatio === ratio.id
                        ? 'bg-neutral-700 border-neutral-500 text-neutral-100 shadow-xs'
                        : theme === 'dark'
                          ? 'bg-[#212121] border-[#2C2C2E] hover:border-[#2C2C2E] text-neutral-400'
                          : 'bg-neutral-100 border-neutral-200 hover:border-neutral-300 text-neutral-600'
                    }`}
                  >
                    <ratio.icon className="w-4 h-4" />
                    <span>{ratio.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Speed & Optimization Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Rocket className="w-3.5 h-3.5 text-neutral-400" />
                <span>Modo de Desempenho</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSpeedMode('turbo')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all text-xs font-medium ${
                    speedMode === 'turbo'
                      ? 'bg-neutral-700 border-neutral-500 text-neutral-100 shadow-xs'
                      : theme === 'dark'
                        ? 'bg-[#212121] border-[#2C2C2E] hover:border-[#2C2C2E] text-neutral-400'
                        : 'bg-neutral-100 border-neutral-200 hover:border-neutral-300 text-neutral-600'
                  }`}
                >
                  <Rocket className="w-4 h-4 text-emerald-400" />
                  <span>Turbo (Mais rápido)</span>
                </button>
                <button
                  onClick={() => setSpeedMode('quality')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all text-xs font-medium ${
                    speedMode === 'quality'
                      ? 'bg-neutral-700 border-neutral-500 text-neutral-100 shadow-xs'
                      : theme === 'dark'
                        ? 'bg-[#212121] border-[#2C2C2E] hover:border-[#2C2C2E] text-neutral-400'
                        : 'bg-neutral-100 border-neutral-200 hover:border-neutral-300 text-neutral-600'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-zeno" />
                  <span>Alta Qualidade</span>
                </button>
              </div>
            </div>

            {/* Generate Action Button */}
            <button
              onClick={() => handleGenerate()}
              disabled={!prompt.trim() || isGenerating}
              className={`w-full py-3.5 px-4 rounded-2xl font-semibold flex items-center justify-center gap-2.5 transition-all shadow-lg ${
                !prompt.trim() || isGenerating
                  ? 'bg-[#232326] text-neutral-500 cursor-not-allowed border border-[#2C2C2E]'
                  : 'bg-neutral-200 hover:bg-neutral-100 text-neutral-900 shadow-md active:scale-[0.99]'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-neutral-900" />
                  <span>{t.imageStudio.generating}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>{t.imageStudio.generateBtn}</span>
                </>
              )}
            </button>
          </div>

          {/* Right Display Area (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className={`flex-1 min-h-[360px] rounded-2xl border flex flex-col items-center justify-center p-4 relative overflow-hidden group ${
              theme === 'dark' ? 'bg-[#1e1e1e] border-[#2C2C2E]' : 'bg-neutral-100 border-neutral-200'
            }`}>
              {queueError ? (
                <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 w-full relative z-10">
                  <div className="w-12 h-12 rounded-full bg-neutral-500/20 text-neutral-400 flex items-center justify-center">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-neutral-100">{t.imageStudio.failed}</h4>
                    <p className="text-xs text-neutral-400 max-w-xs">{queueError}</p>
                  </div>
                  <button
                    onClick={() => {
                      setQueueError(null);
                      handleGenerate();
                    }}
                    className="py-1.5 px-4 bg-[#232326] hover:bg-neutral-700 text-neutral-200 border border-[#2C2C2E] text-xs font-semibold rounded-xl transition-all"
                  >
                    {t.imageStudio.tryAgain}
                  </button>
                </div>
              ) : isGenerating ? (
                <div className="flex flex-col items-center justify-center text-center p-8 space-y-5 w-full relative">
                  <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                    <Loader2 className="w-8 h-8 text-zeno animate-spin" />
                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold text-neutral-100">
                        {queuePosition !== null ? t.imageStudio.queueTitle : t.imageStudio.generating}
                      </h3>
                      {queuePosition === null && (
                        <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
                          {t.imageStudio.queueDesc}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* QUEUE STATUS DASHBOARD FOR FREE USERS */}
                  {queuePosition !== null && (
                    <div className="z-10 bg-[#252525] border border-[#2C2C2E] p-4 rounded-xl max-w-xs w-full shadow-lg space-y-3.5 transition-all mt-3">
                      <div className="flex items-center justify-between text-xs text-neutral-300">
                        <span className="flex items-center gap-1.5 font-medium text-neutral-400">
                          <Users className="w-4 h-4 text-neutral-500" />
                          {t.imageStudio.queuePosition}
                        </span>
                        <span className="font-extrabold text-neutral-100 bg-[#232326] px-2.5 py-1 rounded-lg border border-[#2C2C2E] font-mono">
                          #{queuePosition}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-neutral-300">
                        <span className="flex items-center gap-1.5 font-medium text-neutral-400">
                          <Clock className="w-4 h-4 text-neutral-500" />
                          {t.imageStudio.estimatedTime}
                        </span>
                        <span className="font-extrabold text-zeno font-mono bg-zeno/20/30 px-2 py-0.5 rounded-md">
                          ~{estimatedTime}s
                        </span>
                      </div>
                      
                      <button
                        onClick={handleCancelTask}
                        className="w-full mt-2 py-2 px-3 rounded-lg bg-[#121212]/30 hover:bg-[#1C1C1E]/40 text-neutral-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border border-neutral-500/20 active:scale-[0.98]"
                      >
                        <XCircle className="w-3.5 h-3.5 text-neutral-400" />
                        {t.imageStudio.cancelRequest}
                      </button>
                    </div>
                  )}
                </div>
              ) : currentImage ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  <img
                    src={currentImage.imageUrl}
                    alt={currentImage.prompt}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.opacity = '0.5';
                    }}
                    className="max-h-[420px] w-auto object-contain rounded-xl shadow-xl transition-transform duration-300 group-hover:scale-[1.01]"
                  />

                  {/* Floating Action Overlay */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 p-1.5 rounded-xl bg-[#212121]/90 backdrop-blur-md border border-[#2C2C2E] opacity-90 transition-opacity">
                    <button
                      onClick={() => toggleFavorite(currentImage.id)}
                      className={`p-2 rounded-lg transition-colors ${currentImage.isFavorite ? 'text-neutral-400 bg-neutral-500/20' : 'text-neutral-200 hover:bg-[#232326]'}`}
                      title={currentImage.isFavorite ? t.imageStudio.removeFromFavorites : t.imageStudio.addToFavorites}
                    >
                      <Heart className={`w-4 h-4 ${currentImage.isFavorite ? 'fill-neutral-400 text-neutral-400' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleGenerate(currentImage.originalPrompt || currentImage.prompt)}
                      disabled={isGenerating}
                      className="p-2 rounded-lg text-neutral-200 hover:bg-[#232326] transition-colors"
                      title={t.imageStudio.regenerate}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setFullscreenUrl(currentImage.imageUrl)}
                      className="p-2 rounded-lg text-neutral-200 hover:bg-[#232326] transition-colors"
                      title={t.imageStudio.fullscreen}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopyLink(currentImage.imageUrl, currentImage.id)}
                      className="p-2 rounded-lg text-neutral-200 hover:bg-[#232326] transition-colors"
                      title={t.imageStudio.copyLink}
                    >
                      {copiedId === currentImage.id ? <Check className="w-4 h-4 text-zeno" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDownload(currentImage.imageUrl, `zeno-${Date.now()}.jpg`, currentImage.id)}
                      disabled={isDownloading}
                      className="p-2 rounded-lg text-neutral-200 hover:bg-[#232326] transition-colors flex items-center gap-1"
                      title={t.imageStudio.download}
                    >
                      {isDownloading ? (
                        <RefreshCw className="w-4 h-4 text-neutral-300 animate-spin" />
                      ) : downloadDoneId === currentImage.id ? (
                        <Check className="w-4 h-4 text-zeno" />
                      ) : (
                        <Download className="w-4 h-4 text-neutral-300" />
                      )}
                    </button>
                  </div>

                  {/* Send to chat option */}
                  {onSendToChat && (
                    <div className="mt-3 flex justify-center gap-2">
                      <button
                        onClick={() => {
                          onSendToChat(currentImage.imageUrl, currentImage.originalPrompt || currentImage.prompt);
                          onClose();
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#232326] hover:bg-neutral-700 border border-[#2C2C2E] text-neutral-200 flex items-center gap-2 shadow-sm transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{t.imageStudio.sendToChat}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="p-4 rounded-2xl bg-[#232326] text-neutral-300 border border-[#2C2C2E]">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                  <h3 className="text-sm font-semibold">{t.imageStudio.noImageTitle}</h3>
                  <p className="text-xs text-neutral-400 max-w-xs">
                    {t.imageStudio.noImageDesc}
                  </p>
                </div>
              )}
            </div>

            {/* Gallery Library */}
            {history.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-[#2C2C2E]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 bg-[#232326]/80 p-1 rounded-xl border border-[#2C2C2E]">
                    <button
                      onClick={() => setActiveTab('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === 'all' ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {t.imageStudio.galleryTitle} ({history.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('favorites')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                        activeTab === 'favorites' ? 'bg-neutral-500/20 text-neutral-300 border border-neutral-500/30' : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <Heart className="w-3 h-3 text-neutral-400 fill-neutral-400" />
                      <span>{t.imageStudio.favoritesTitle} ({history.filter(i => i.isFavorite).length})</span>
                    </button>
                  </div>

                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t.imageStudio.searchPlaceholder}
                      className="w-full pl-8 pr-3 py-1 rounded-xl bg-[#232326] border border-[#2C2C2E] text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-custom">
                  {filteredHistory.map(img => (
                    <div
                      key={img.id}
                      className={`relative group flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                        currentImage?.id === img.id
                          ? 'border-neutral-300 scale-105 shadow-md'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <button
                        onClick={() => setCurrentImage(img)}
                        className="w-full h-full block"
                      >
                        <img
                          src={img.imageUrl}
                          alt={img.prompt}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>

                      {/* Favorite Indicator Badge */}
                      {img.isFavorite && (
                        <div className="absolute top-1 left-1 p-0.5 rounded-full bg-black/60 backdrop-blur-sm">
                          <Heart className="w-3 h-3 text-neutral-400 fill-neutral-400" />
                        </div>
                      )}

                      {/* Delete Overlay Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteImage(img.id);
                        }}
                        className="absolute top-1 right-1 p-1 rounded-lg bg-black/70 hover:bg-neutral-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title={t.imageStudio.deleteFromLibrary}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {filteredHistory.length === 0 && (
                    <div className="text-xs text-neutral-500 py-4 italic">
                      {t.imageStudio.emptyGallery} {activeTab === 'favorites' ? t.imageStudio.emptyFavorites : ''}.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Modal Lightbox */}
      {fullscreenUrl && (
        <div 
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setFullscreenUrl(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleDownload(fullscreenUrl, `zeno-fullscreen-${Date.now()}.jpg`)}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-2 text-xs font-semibold"
              title={t.imageStudio.download}
            >
              <Download className="w-5 h-5 text-neutral-300" />
              <span className="hidden sm:inline">{t.imageStudio.download}</span>
            </button>
            <button
              onClick={() => setFullscreenUrl(null)}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title={t.common.close}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <img
            src={fullscreenUrl}
            alt={t.imageStudio.fullscreen}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
