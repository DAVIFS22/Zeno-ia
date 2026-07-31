import React, { useState, useEffect, useRef } from 'react';
import { Download, Sparkles, Wand2, RefreshCw, AlertCircle, Eye, Check, Share2, Edit3, RotateCcw, Heart } from 'lucide-react';
import { downloadImage } from '../lib/downloadHelper';

interface ImageWithLoaderProps {
  src: string;
  alt?: string;
  className?: string;
  onRegenerate?: () => void;
  onVary?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
}

// Global in-memory cache to track images that have already loaded in this session
const loadedImagesCache = new Set<string>();

export const ImageWithLoader: React.FC<ImageWithLoaderProps> = ({ 
  src, 
  alt,
  onRegenerate,
  onVary,
  onEdit,
  onShare
}) => {
  const isAlreadyLoaded = loadedImagesCache.has(src);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(isAlreadyLoaded);
  const [isLoading, setIsLoading] = useState(!isAlreadyLoaded);
  const [progress, setProgress] = useState(isAlreadyLoaded ? 100 : 12);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const prevSrcRef = useRef(src);

  // Lazy loading observer: defer image loading until it scrolls near the viewport
  useEffect(() => {
    if (isAlreadyLoaded || isIntersecting) return;

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsIntersecting(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '250px 0px 250px 0px',
        threshold: 0.01
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [src, isAlreadyLoaded, isIntersecting]);

  // Check favorite status from library on mount / src change
  useEffect(() => {
    try {
      const saved = localStorage.getItem('zeno_image_library');
      if (saved) {
        const list = JSON.parse(saved);
        const found = list.find((img: any) => img.imageUrl === currentSrc);
        if (found) {
          setIsFavorite(!!found.isFavorite);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentSrc]);

  const handleToggleFavorite = () => {
    try {
      const saved = localStorage.getItem('zeno_image_library');
      const list = saved ? JSON.parse(saved) : [];
      let updated = false;
      const newList = list.map((img: any) => {
        if (img.imageUrl === currentSrc) {
          updated = true;
          return { ...img, isFavorite: !isFavorite };
        }
        return img;
      });

      if (!updated && currentSrc) {
        newList.unshift({
          id: 'img-' + Date.now(),
          imageUrl: currentSrc,
          prompt: alt || 'Imagem Gerada pelo ZENO',
          originalPrompt: alt || 'Imagem Gerada pelo ZENO',
          aspectRatio: '1:1',
          style: 'photorealistic',
          timestamp: Date.now(),
          isFavorite: true
        });
      }

      localStorage.setItem('zeno_image_library', JSON.stringify(newList));
      setIsFavorite(!isFavorite);
    } catch (e) {
      console.error('Error toggling favorite:', e);
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    const cleanFilename = `zeno-art-${Date.now()}.jpg`;
    await downloadImage(currentSrc, cleanFilename);
    setIsDownloading(false);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  // Sync currentSrc only if parent prop src actually changes
  useEffect(() => {
    if (prevSrcRef.current !== src) {
      prevSrcRef.current = src;
      setCurrentSrc(src);
      if (loadedImagesCache.has(src)) {
        setIsLoading(false);
        setProgress(100);
      } else {
        setIsLoading(true);
        setProgress(12);
      }
      setHasError(false);
    }
  }, [src]);

  // If browser already completed loading the image element before React attached onLoad
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      if (currentSrc) loadedImagesCache.add(currentSrc);
      setIsLoading(false);
      setProgress(100);
    }
  }, [currentSrc]);

  // Smooth simulated progress up to 93% using requestAnimationFrame (120Hz/60Hz optimized)
  useEffect(() => {
    if (!isLoading) return;
    let animId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (now - lastTime >= 150) {
        lastTime = now;
        setProgress((prev) => {
          if (prev >= 93) return 93;
          const diff = (95 - prev) * 0.08;
          return Math.min(93, Math.round(prev + Math.max(1, diff)));
        });
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isLoading]);

  const handleImageLoad = () => {
    if (currentSrc) {
      loadedImagesCache.add(currentSrc);
      try {
        const saved = localStorage.getItem('zeno_image_library');
        const list = saved ? JSON.parse(saved) : [];
        if (!list.some((img: any) => img.imageUrl === currentSrc)) {
          const newImg = {
            id: 'img-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            imageUrl: currentSrc,
            prompt: alt || 'Imagem Gerada pelo ZENO',
            originalPrompt: alt || 'Imagem Gerada pelo ZENO',
            aspectRatio: '1:1',
            style: 'photorealistic',
            timestamp: Date.now()
          };
          localStorage.setItem('zeno_image_library', JSON.stringify([newImg, ...list]));
        }
      } catch (e) {
        console.error('Failed to save to image library:', e);
      }
    }
    setProgress(100);
    setIsLoading(false);
  };

  const handleImageError = () => {
    if (retryCount === 0) {
      setRetryCount(1);
      // Clean fallback URL
      const cleanAlt = encodeURIComponent(alt || 'digital art masterpiece');
      setCurrentSrc(`https://image.pollinations.ai/prompt/${cleanAlt}?width=1024&height=1024&nologo=true`);
    } else {
      setIsLoading(false);
      setHasError(true);
    }
  };

  const handleManualRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setProgress(15);
    const cleanAlt = encodeURIComponent(alt || 'artistic digital artwork');
    const randomSeed = Math.floor(Math.random() * 999999);
    setCurrentSrc(`https://image.pollinations.ai/prompt/${cleanAlt}?width=1024&height=1024&seed=${randomSeed}&nologo=true`);
  };

  // Determine message according to progress
  const getProgressStage = (p: number) => {
    if (p < 30) return { title: 'Interpretando Prompt', detail: 'Analisando conceitos e composição...' };
    if (p < 60) return { title: 'Sintetizando Pixels', detail: 'Criando formas, cores e iluminação...' };
    if (p < 85) return { title: 'Refinando Texturas', detail: 'Aplicando detalhes em alta definição...' };
    if (p < 100) return { title: 'Finalizando Imagem', detail: 'Renderizando nitidez e iluminação final...' };
    return { title: 'Concluído!', detail: 'Imagem gerada com sucesso.' };
  };

  const currentStage = getProgressStage(progress);

  if (!isIntersecting) {
    return (
      <span ref={containerRef} className="block my-4 relative w-full min-h-[220px] rounded-2xl bg-[#232326]/30 border border-[#2C2C2E]/60 animate-pulse flex flex-col items-center justify-center p-6 text-center select-none">
        <Sparkles className="w-5 h-5 text-neutral-500 mb-1" />
        <span className="text-xs text-neutral-500 font-medium">Carregando imagem...</span>
      </span>
    );
  }

  return (
    <span ref={containerRef} className="block my-4 relative group w-full rounded-2xl overflow-hidden border border-[#2C2C2E]/60 shadow-2xl bg-[#171717]">
      {/* Loading Container */}
      {isLoading && (
        <span className="flex flex-col items-center justify-center p-8 min-h-[320px] w-full bg-[#1e1e1e] relative overflow-hidden select-none">
          {/* Subtle Ambient Highlight */}
          <span className="absolute inset-0 bg-[#232326]/20 animate-pulse blur-2xl" />

          {/* Central AI Orb */}
          <span className="relative z-10 flex flex-col items-center text-center space-y-4">
            <span className="relative flex items-center justify-center">
              {/* Neutral icon box */}
              <span className="w-16 h-16 rounded-2xl bg-[#232326] border border-[#2C2C2E] flex items-center justify-center text-neutral-200 shadow-lg">
                <Wand2 className="w-8 h-8 text-neutral-300 animate-pulse" />
              </span>
              <Sparkles className="w-4 h-4 text-neutral-400 absolute -top-1.5 -right-1.5" />
            </span>

            {/* Stage Info */}
            <span className="space-y-1">
              <span className="flex items-center justify-center gap-2 text-sm font-semibold text-neutral-200">
                <Sparkles className="w-4 h-4 text-neutral-400" />
                <span>{currentStage.title}</span>
              </span>
              <span className="text-xs text-neutral-400 block max-w-xs leading-relaxed">
                {currentStage.detail}
              </span>
            </span>

            {/* Progress Bar & Percentage */}
            <span className="w-64 space-y-2 pt-1">
              <span className="flex justify-between items-center text-[11px] font-semibold text-neutral-400 px-0.5">
                <span className="text-neutral-400 font-mono flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-neutral-400" />
                  Gerando Imagem
                </span>
                <span className="font-mono text-neutral-300">{progress}%</span>
              </span>

              {/* Progress Track (120fps GPU accelerated scaleX) */}
              <span className="w-full h-1.5 bg-[#232326] rounded-full overflow-hidden relative border border-[#2C2C2E] block contain-render">
                <span
                  className="h-full w-full bg-neutral-200 rounded-full transition-transform duration-300 ease-out block relative overflow-hidden will-change-transform origin-left"
                  style={{ transform: `scaleX(${progress / 100})` }}
                >
                  <span className="absolute inset-0 bg-white/20 animate-shimmer block gpu-accelerated" />
                </span>
              </span>
            </span>
          </span>
        </span>
      )}

      {/* Error State */}
      {hasError && !isLoading && (
        <span className="flex flex-col items-center justify-center p-8 min-h-[260px] text-center space-y-3 bg-[#1e1e1e]">
          <AlertCircle className="w-10 h-10 text-neutral-400" />
          <span className="text-sm font-semibold text-neutral-200">Não foi possível carregar a imagem</span>
          <span className="text-xs text-neutral-400 max-w-xs">
            O provedor de renderização pode estar ocupado. Tente gerar novamente.
          </span>
          <button
            onClick={handleManualRetry}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#232326] hover:bg-neutral-700 border border-[#2C2C2E] text-neutral-200 text-xs font-semibold transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente</span>
          </button>
        </span>
      )}

      {/* Rendered Image */}
      {!hasError && (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt || 'Imagem Gerada pelo ZENO'}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`w-full h-auto object-cover rounded-2xl transition-all duration-700 ease-out ${
            isLoading
              ? 'opacity-0 absolute inset-0 pointer-events-none scale-95'
              : 'opacity-100 scale-100 group-hover:scale-[1.01]'
          }`}
        />
      )}

      {/* Action Buttons Row */}
      {!isLoading && !hasError && (
        <span className="block border-t border-[#2C2C2E] bg-[#16161a] p-2 flex flex-wrap items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className={`p-2 rounded-xl text-neutral-200 hover:bg-[#232326] hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold ${
                downloadSuccess ? 'text-sky-400 font-bold' : ''
              }`}
              title="Baixar imagem em alta resolução"
            >
              {isDownloading ? (
                <RefreshCw className="w-3.5 h-3.5 text-neutral-300 animate-spin" />
              ) : downloadSuccess ? (
                <Check className="w-3.5 h-3.5 text-sky-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-neutral-400" />
              )}
              <span className="hidden sm:inline">{downloadSuccess ? "Baixado" : "Download"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onShare) {
                  onShare();
                } else {
                  navigator.clipboard.writeText(currentSrc);
                  setShareSuccess(true);
                  setTimeout(() => setShareSuccess(false), 2000);
                }
              }}
              className="p-2 rounded-xl text-neutral-200 hover:bg-[#232326] hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Compartilhar imagem (copiar link)"
            >
              {shareSuccess ? (
                <Check className="w-3.5 h-3.5 text-sky-400" />
              ) : (
                <Share2 className="w-3.5 h-3.5 text-neutral-400" />
              )}
              <span className="hidden sm:inline">{shareSuccess ? "Link Copiado" : "Compartilhar"}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFavorite}
              className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold ${
                isFavorite 
                  ? 'text-neutral-400 bg-neutral-500/10 border border-neutral-500/20' 
                  : 'text-neutral-200 hover:bg-[#232326] hover:text-white'
              }`}
              title={isFavorite ? "Remover dos Favoritos" : "Favoritar Imagem"}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-neutral-400 text-neutral-400' : 'text-neutral-400'}`} />
              <span className="hidden sm:inline">{isFavorite ? "Favorito" : "Favoritar"}</span>
            </button>
          </span>

          <span className="flex items-center gap-1.5">
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="p-2 rounded-xl text-neutral-200 hover:bg-[#232326] hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
                title="Regenerar imagem com o mesmo prompt"
              >
                <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
                <span className="hidden sm:inline">Regenerar</span>
              </button>
            )}

            {onVary && (
              <button
                type="button"
                onClick={onVary}
                className="p-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 transition-all flex items-center gap-1.5 text-xs font-semibold"
                title="Criar uma variação desta imagem"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Variar</span>
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="p-2 rounded-xl text-neutral-200 hover:bg-[#232326] hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
                title="Editar prompt"
              >
                <Edit3 className="w-3.5 h-3.5 text-neutral-400" />
                <span className="hidden sm:inline">Editar</span>
              </button>
            )}

            <a
              href={currentSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl text-neutral-200 hover:bg-[#232326] hover:text-white transition-all flex items-center justify-center text-xs font-semibold"
              title="Abrir imagem em nova aba"
            >
              <Eye className="w-4 h-4 text-neutral-300" />
            </a>
          </span>
        </span>
      )}
    </span>
  );
};
