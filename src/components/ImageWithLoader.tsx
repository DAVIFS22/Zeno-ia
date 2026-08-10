import React, { useState, useEffect, useRef } from 'react';
import { Download, Sparkles, Wand2, RefreshCw, AlertCircle, Eye, Check, Share2, Edit3, RotateCcw, Heart, Loader2 } from 'lucide-react';
import { downloadImage } from '../lib/downloadHelper';
import { copyToClipboard } from '../utils/clipboard';

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
      } else {
        setIsLoading(true);
      }
      setHasError(false);
    }
  }, [src]);

  // If browser already completed loading the image element before React attached onLoad
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      if (currentSrc) loadedImagesCache.add(currentSrc);
      setIsLoading(false);
    }
  }, [currentSrc]);



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
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleManualRetry = () => {
    setIsLoading(true);
    setHasError(false);
    // Reload original src
    const targetSrc = src;
    setCurrentSrc('');
    setTimeout(() => setCurrentSrc(targetSrc), 50);
  };



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
        <span className="flex flex-col items-center justify-center p-8 min-h-[320px] w-full bg-[#1e1e1e] relative select-none">
          <span className="relative z-10 flex flex-col items-center text-center space-y-4">
            <Loader2 className="w-8 h-8 text-zeno animate-spin" />
            <span className="text-sm font-medium text-neutral-400">Gerando imagem...</span>
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
                downloadSuccess ? 'text-zeno font-bold' : ''
              }`}
              title="Baixar imagem em alta resolução"
            >
              {isDownloading ? (
                <RefreshCw className="w-3.5 h-3.5 text-neutral-300 animate-spin" />
              ) : downloadSuccess ? (
                <Check className="w-3.5 h-3.5 text-zeno" />
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
                  copyToClipboard(currentSrc);
                  setShareSuccess(true);
                  setTimeout(() => setShareSuccess(false), 2000);
                }
              }}
              className="p-2 rounded-xl text-neutral-200 hover:bg-[#232326] hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Compartilhar imagem (copiar link)"
            >
              {shareSuccess ? (
                <Check className="w-3.5 h-3.5 text-zeno" />
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
                className="p-2 rounded-xl bg-zeno/10 hover:bg-zeno/20 border border-zeno/20 text-zeno transition-all flex items-center gap-1.5 text-xs font-semibold"
                title="Criar uma variação desta imagem"
              >
                <Sparkles className="w-3.5 h-3.5 text-zeno" />
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
