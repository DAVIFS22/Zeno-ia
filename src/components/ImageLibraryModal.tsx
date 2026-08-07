import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Search, Heart, Star, Download, Share2, Copy, Trash2, 
  Plus, Calendar, Sparkles, MessageSquare, Check, Image as ImageIcon, 
  Folder, Layers
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GeneratedImage, ImageCollection, UserPlan } from '../types';
import { 
  getStoredImages, 
  saveStoredImages,
  updateImageInLibrary, 
  deleteImageFromLibrary, 
  toggleFavoriteInLibrary, 
  getStoredCollections, 
  addStoredCollection
} from '../lib/imageLibraryStorage';
import { hasPremiumAccess } from '../config/admin';
import { copyToClipboard as safeCopyToClipboard } from '../utils/clipboard';

interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPlan: UserPlan;
  theme: 'dark' | 'light';
  userId?: string;
  onOpenConversation?: (sessionId: string) => void;
  onOpenStudioWithPrompt?: (prompt: string, style?: string) => void;
  onReusePrompt?: (promptText: string) => void;
  onOpenChat?: () => void;
  onUpgradeClick?: () => void;
}

export const ImageLibraryModal: React.FC<ImageLibraryModalProps> = ({
  isOpen,
  onClose,
  userPlan,
  theme,
  userId,
  onOpenConversation,
  onOpenStudioWithPrompt,
  onReusePrompt,
  onOpenChat,
  onUpgradeClick
}) => {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [collections, setCollections] = useState<ImageCollection[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionIcon, setNewCollectionIcon] = useState('Folder');

  // Load images and collections with real-time Firestore sync
  useEffect(() => {
    if (!isOpen) return;

    const loadedImages = getStoredImages(userId);
    setImages(loadedImages);
    setCollections(getStoredCollections(userId));

    if (!userId || userId === 'user-default' || userId.startsWith('anon_')) {
      return;
    }

    let unsubscribe = () => {};

    try {
      const imagesRef = collection(db, 'images');
      // Requirement 3: Query /images WHERE userId == uid ORDER BY timestamp DESC
      const qWithOrder = query(
        imagesRef,
        where('userId', '==', userId),
        orderBy('timestamp', 'desc')
      );

      const handleSnapshot = (snapshot: any) => {
        const firestoreImages: GeneratedImage[] = snapshot.docs.map((docSnap: any) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId: data.userId || userId,
            conversationId: data.conversationId,
            conversationTitle: data.conversationTitle,
            imageUrl: data.imageUrl,
            thumbnailUrl: data.thumbnailUrl || data.imageUrl,
            prompt: data.prompt || '',
            originalPrompt: data.originalPrompt || data.prompt || '',
            optimizedPrompt: data.optimizedPrompt || data.prompt || '',
            model: data.model || 'ZENO Vision',
            provider: data.provider || 'Flux Dev',
            width: data.width || 1024,
            height: data.height || 1024,
            aspectRatio: data.aspectRatio || '1:1',
            style: data.style || 'photorealistic',
            seed: data.seed,
            isFavorite: !!data.isFavorite,
            collection: data.collection || 'Geral',
            timestamp: typeof data.timestamp === 'number' ? data.timestamp : (data.timestamp?.toMillis ? data.timestamp.toMillis() : Date.now()),
          };
        });

        setImages(prev => {
          const map = new Map<string, GeneratedImage>();
          prev.forEach(img => map.set(img.id, img));
          firestoreImages.forEach(img => map.set(img.id, img));
          const merged = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
          saveStoredImages(merged, userId);
          return merged;
        });
      };

      unsubscribe = onSnapshot(
        qWithOrder,
        handleSnapshot,
        (err) => {
          console.warn('[ImageLibraryModal] Firestore ordered query warning, attempting fallback:', err.message);
          const qFallback = query(imagesRef, where('userId', '==', userId));
          unsubscribe = onSnapshot(qFallback, (snap) => handleSnapshot(snap), (err2) => {
            console.error('[ImageLibraryModal] Firestore query error:', err2.message);
          });
        }
      );
    } catch (err) {
      console.error('[ImageLibraryModal] Firestore listener error:', err);
    }

    return () => {
      unsubscribe();
    };
  }, [isOpen, userId]);

  // Filter logic (Hook placed at top level before any early return)
  const filteredImages = useMemo(() => {
    if (!isOpen) return [];
    return images.filter(img => {
      // 1. Category / Collection
      if (selectedCategory === 'favorites' && !img.isFavorite) return false;
      if (selectedCategory !== 'all' && selectedCategory !== 'favorites') {
        if (img.collection !== selectedCategory && img.style !== selectedCategory) return false;
      }

      // 2. Time Filter
      if (timeFilter !== 'all') {
        const now = Date.now();
        const diffMs = now - img.timestamp;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (timeFilter === 'today' && diffDays > 1) return false;
        if (timeFilter === 'yesterday' && (diffDays < 1 || diffDays > 2)) return false;
        if (timeFilter === '7days' && diffDays > 7) return false;
        if (timeFilter === '30days' && diffDays > 30) return false;
        if (timeFilter === 'year' && diffDays > 365) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPrompt = img.prompt?.toLowerCase().includes(q);
        const matchOpt = img.optimizedPrompt?.toLowerCase().includes(q);
        const matchModel = img.model?.toLowerCase().includes(q);
        const matchStyle = img.style?.toLowerCase().includes(q);
        const matchConv = img.conversationTitle?.toLowerCase().includes(q);
        const matchCollection = img.collection?.toLowerCase().includes(q);
        return matchPrompt || matchOpt || matchModel || matchStyle || matchConv || matchCollection;
      }

      return true;
    });
  }, [images, selectedCategory, timeFilter, searchQuery, isOpen]);

  if (!isOpen) return null;

  const isPro = hasPremiumAccess(userPlan);

  // Toggle favorite
  const handleToggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = toggleFavoriteInLibrary(id, userId);
    setImages(updated);
    if (selectedImage && selectedImage.id === id) {
      setSelectedImage(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
    }
  };

  // Delete image
  const handleDeleteImage = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm('Tem certeza de que deseja excluir esta imagem da sua biblioteca?')) {
      const updated = deleteImageFromLibrary(id, userId);
      setImages(updated);
      if (selectedImage && selectedImage.id === id) {
        setSelectedImage(null);
      }
    }
  };

  // Move image to collection
  const handleMoveCollection = (id: string, newCollectionName: string) => {
    const updated = updateImageInLibrary(id, { collection: newCollectionName }, userId);
    setImages(updated);
    if (selectedImage && selectedImage.id === id) {
      setSelectedImage(prev => prev ? { ...prev, collection: newCollectionName } : null);
    }
  };

  // Create new collection
  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    const updated = addStoredCollection(newCollectionName.trim(), newCollectionIcon, '#3B82F6', userId);
    setCollections(updated);
    setSelectedCategory(newCollectionName.trim());
    setNewCollectionName('');
    setIsCreatingCollection(false);
  };

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    safeCopyToClipboard(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Download helper
  const handleDownload = (imageUrl: string, promptText: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.target = '_blank';
    link.download = `zeno-image-${promptText.slice(0, 20).replace(/[^a-z0-9]/gi, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Share helper
  const handleShare = (imageUrl: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'Imagem Gerada pelo ZENO AI',
        url: imageUrl
      }).catch(() => {});
    } else {
      copyToClipboard(imageUrl, 'link');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 md:p-6 transition-all duration-200">
      <div className="relative w-full max-w-7xl h-[92vh] rounded-2xl flex flex-col overflow-hidden bg-[#0D0D0D] border border-[#303030] text-[#FFFFFF] shadow-2xl">
        
        {/* Top Header Bar */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-[#303030] bg-[#171717] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#242424] text-white">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-white">Biblioteca de Imagens</h2>
                {isPro ? (
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[#242424] text-[#A8A8A8] border border-[#303030]">
                    Ilimitado (PRO)
                  </span>
                ) : (
                  <button 
                    onClick={onUpgradeClick}
                    className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[#242424] text-white hover:bg-[#2F2F2F] border border-[#303030] transition-colors"
                  >
                    Plano Gratuito • Upgrade Pro
                  </button>
                )}
              </div>
              <p className="text-xs text-[#A8A8A8]">
                {images.length} {images.length === 1 ? 'imagem salva' : 'imagens salvas'}
              </p>
            </div>
          </div>

          {/* Search Box */}
          <div className="hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-sm w-80 bg-[#242424] border border-[#303030]">
            <Search className="w-4 h-4 text-white flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por prompt, estilo, modelo..."
              className="bg-transparent border-none focus:outline-none w-full text-xs text-white placeholder-[#A8A8A8]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-0.5 text-[#A8A8A8] hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#242424] text-[#A8A8A8] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Sidebar Filters */}
          <div className="w-60 flex-shrink-0 border-r border-[#303030] bg-[#171717] p-3.5 overflow-y-auto space-y-5 hidden sm:block">
            
            {/* Quick Filters */}
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-[#A8A8A8] uppercase tracking-wider px-3 mb-1.5">
                Navegação
              </div>
              
              <button
                onClick={() => setSelectedCategory('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-[#2F2F2F] text-white font-medium'
                    : 'text-[#A8A8A8] hover:text-white hover:bg-[#242424]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ImageIcon className="w-4 h-4" />
                  <span>Todas as Imagens</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] rounded-md bg-[#242424] text-[#A8A8A8]">{images.length}</span>
              </button>

              <button
                onClick={() => setSelectedCategory('favorites')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                  selectedCategory === 'favorites'
                    ? 'bg-[#2F2F2F] text-white font-medium'
                    : 'text-[#A8A8A8] hover:text-white hover:bg-[#242424]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Heart className="w-4 h-4 fill-white text-white" />
                  <span>Favoritos</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] rounded-md bg-[#242424] text-[#A8A8A8]">
                  {images.filter(i => i.isFavorite).length}
                </span>
              </button>
            </div>

            {/* Time Filter */}
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-[#A8A8A8] uppercase tracking-wider px-3 mb-1.5">
                Período
              </div>

              {[
                { id: 'all', label: 'Todo o Histórico' },
                { id: 'today', label: 'Hoje' },
                { id: 'yesterday', label: 'Ontem' },
                { id: '7days', label: 'Últimos 7 dias' },
                { id: '30days', label: 'Últimos 30 dias' },
                { id: 'year', label: 'Este Ano' }
              ].map(tf => (
                <button
                  key={tf.id}
                  onClick={() => setTimeFilter(tf.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-colors ${
                    timeFilter === tf.id
                      ? 'bg-[#2F2F2F] text-white font-medium'
                      : 'text-[#A8A8A8] hover:text-white hover:bg-[#242424]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-[#A8A8A8]" />
                  <span>{tf.label}</span>
                </button>
              ))}
            </div>

            {/* Collections */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-3">
                <span className="text-[11px] font-medium text-[#A8A8A8] uppercase tracking-wider">
                  Coleções
                </span>
                <button 
                  onClick={() => setIsCreatingCollection(true)}
                  className="p-1 hover:bg-[#242424] text-[#A8A8A8] hover:text-white rounded-lg transition-colors"
                  title="Criar nova coleção"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {isCreatingCollection && (
                <form onSubmit={handleCreateCollection} className="p-2 rounded-xl bg-[#242424] border border-[#303030] space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCollectionIcon}
                      onChange={(e) => setNewCollectionIcon(e.target.value)}
                      className="w-8 text-center bg-[#171717] rounded-lg p-1 text-xs border border-[#303030]"
                      maxLength={2}
                    />
                    <input
                      type="text"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="Nome..."
                      className="flex-1 bg-[#171717] rounded-lg px-2 py-1 text-xs border border-[#303030] text-white focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingCollection(false)}
                      className="px-2 py-1 text-[10px] text-[#A8A8A8] hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-1 text-[10px] bg-[#2F2F2F] hover:bg-[#303030] text-white font-medium rounded-lg border border-[#303030]"
                    >
                      Salvar
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-1">
                {collections.map(col => {
                  const count = images.filter(i => i.collection === col.name).length;
                  const isSelected = selectedCategory === col.name;

                  return (
                    <button
                      key={col.id}
                      onClick={() => setSelectedCategory(col.name)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-colors ${
                        isSelected
                          ? 'bg-[#2F2F2F] text-white font-medium'
                          : 'text-[#A8A8A8] hover:text-white hover:bg-[#242424]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span>{<Folder className="w-5 h-5 text-neutral-400" />}</span>
                        <span className="truncate">{col.name}</span>
                      </div>
                      <span className="text-[10px] text-[#A8A8A8] font-mono">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Image Grid View */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0D0D0D] scrollbar-custom flex flex-col">
            
            {/* Mobile Search Bar */}
            <div className="md:hidden mb-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-[#242424] border border-[#303030]">
                <Search className="w-4 h-4 text-white flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar imagens..."
                  className="bg-transparent border-none focus:outline-none w-full text-xs text-white"
                />
              </div>
            </div>

            {/* Grid Layout */}
            {filteredImages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#171717] border border-[#303030] flex items-center justify-center text-[#A8A8A8]">
                  <ImageIcon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {searchQuery || selectedCategory !== 'all' ? 'Nenhuma imagem encontrada' : 'Nenhuma imagem gerada ainda'}
                  </h3>
                  <p className="text-xs text-[#A8A8A8] mt-1 max-w-sm">
                    {searchQuery 
                      ? 'Tente pesquisar com outros termos.' 
                      : selectedCategory !== 'all'
                      ? 'Nenhuma imagem nesta categoria ou período.'
                      : 'Sua galeria do ZENO Vision está vazia. Peça ao ZENO no chat para criar uma imagem (ex: "Crie uma imagem de um astronauta")!'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenChat) {
                      onOpenChat();
                    } else if (onOpenStudioWithPrompt) {
                      onOpenStudioWithPrompt('');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs border border-blue-500 transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <MessageSquare className="w-4 h-4 text-white" />
                  Ir para o Chat
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {filteredImages.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => setSelectedImage(img)}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-[#171717] border border-[#303030] hover:border-[#505050] transition-colors cursor-pointer"
                  >
                    <img
                      src={img.imageUrl}
                      alt={img.prompt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {/* Simple Dark Overlay on Hover */}
                    <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col justify-between p-3">
                      
                      {/* Top Badges */}
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-md bg-[#242424] text-[10px] font-medium text-white border border-[#303030]">
                          {img.aspectRatio || '1:1'}
                        </span>
                        
                        <button
                          onClick={(e) => handleToggleFavorite(img.id, e)}
                          className="p-1.5 rounded-lg bg-[#242424] hover:bg-[#2F2F2F] text-white transition-colors"
                        >
                          <Heart className={`w-3.5 h-3.5 ${img.isFavorite ? 'fill-white text-white' : 'text-[#A8A8A8]'}`} />
                        </button>
                      </div>

                      {/* Bottom Details */}
                      <div>
                        <p className="text-[11px] font-normal text-white line-clamp-2 leading-tight">
                          {img.prompt}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#303030] text-[10px] text-[#A8A8A8]">
                          <span>{img.model || 'ZENO Vision'}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(img.imageUrl, img.prompt);
                              }}
                              className="p-1 hover:text-white"
                              title="Baixar"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteImage(img.id, e)}
                              className="p-1 hover:text-white"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Full Image Detail Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-3 md:p-6 transition-all duration-150">
          <div className="relative w-full max-w-5xl max-h-[92vh] bg-[#171717] border border-[#303030] rounded-2xl overflow-hidden flex flex-col md:flex-row text-white">
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-20 p-2 rounded-xl bg-[#242424] hover:bg-[#2F2F2F] text-[#A8A8A8] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Left Image Viewer */}
            <div className="flex-1 bg-[#0D0D0D] flex items-center justify-center p-4 min-h-[300px] md:min-h-[500px]">
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.prompt}
                className="max-h-[80vh] max-w-full object-contain rounded-xl"
              />
            </div>

            {/* Right Details Panel */}
            <div className="w-full md:w-96 p-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#303030] bg-[#171717] overflow-y-auto space-y-5">
              
              <div className="space-y-4">
                
                {/* Prompt Section */}
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-[#A8A8A8] uppercase tracking-wider mb-1.5">
                    <span>Prompt</span>
                    <button
                      onClick={() => copyToClipboard(selectedImage.prompt, 'prompt')}
                      className="flex items-center gap-1 text-[11px] text-white hover:text-[#A8A8A8] transition-colors"
                    >
                      {copiedField === 'prompt' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'prompt' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-white bg-[#242424] p-3 rounded-xl border border-[#303030] leading-relaxed">
                    {selectedImage.prompt}
                  </p>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#242424] border border-[#303030]">
                    <span className="text-[#A8A8A8] block text-[10px]">Modelo</span>
                    <span className="font-medium text-white">{selectedImage.model || 'ZENO Vision'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#242424] border border-[#303030]">
                    <span className="text-[#A8A8A8] block text-[10px]">Estilo</span>
                    <span className="font-medium text-white capitalize">{selectedImage.style || 'Photorealistic'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#242424] border border-[#303030]">
                    <span className="text-[#A8A8A8] block text-[10px]">Proporção</span>
                    <span className="font-medium text-white">{selectedImage.aspectRatio || '1:1'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#242424] border border-[#303030]">
                    <span className="text-[#A8A8A8] block text-[10px]">Seed</span>
                    <span className="font-mono text-white">{selectedImage.seed || 'Aleatório'}</span>
                  </div>
                </div>

                {/* Date & Collection */}
                <div className="space-y-2.5 pt-2 border-t border-[#303030] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#A8A8A8]">Data:</span>
                    <span className="text-white font-medium">
                      {new Date(selectedImage.timestamp).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#A8A8A8]">Coleção:</span>
                    <select
                      value={selectedImage.collection || 'Geral'}
                      onChange={(e) => handleMoveCollection(selectedImage.id, e.target.value)}
                      className="bg-[#242424] border border-[#303030] text-xs rounded-lg px-2 py-1 text-white focus:outline-none"
                    >
                      {collections.map(col => (
                        <option key={col.id} value={col.name}>{col.icon} {col.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Conversation Link */}
                {selectedImage.conversationId && onOpenConversation && (
                  <button
                    onClick={() => {
                      onOpenConversation(selectedImage.conversationId!);
                      setSelectedImage(null);
                      onClose();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#242424] hover:bg-[#2F2F2F] border border-[#303030] text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-white" />
                    <span>Abrir Conversa de Origem</span>
                  </button>
                )}

              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-3 border-t border-[#303030]">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleDownload(selectedImage.imageUrl, selectedImage.prompt)}
                    className="py-2 px-3 rounded-xl bg-[#242424] hover:bg-[#2F2F2F] text-white font-medium text-xs border border-[#303030] flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Baixar
                  </button>
                  <button
                    onClick={() => handleShare(selectedImage.imageUrl)}
                    className="py-2 px-3 rounded-xl bg-[#242424] hover:bg-[#2F2F2F] text-white font-medium text-xs border border-[#303030] flex items-center justify-center gap-2 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Compartilhar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleToggleFavorite(selectedImage.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 border transition-colors ${
                      selectedImage.isFavorite
                        ? 'bg-[#2F2F2F] text-amber-400 border-amber-500/40'
                        : 'bg-[#242424] text-[#A8A8A8] border-[#303030] hover:text-white'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${selectedImage.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                    {selectedImage.isFavorite ? 'Favorito' : 'Favoritar'}
                  </button>

                  <button
                    onClick={() => {
                      if (onReusePrompt) {
                        onReusePrompt(selectedImage.prompt);
                      } else if (onOpenStudioWithPrompt) {
                        onOpenStudioWithPrompt(selectedImage.prompt, selectedImage.style);
                      }
                      setSelectedImage(null);
                      onClose();
                    }}
                    className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-blue-500/20"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                    Reusar Prompt
                  </button>
                </div>

                <button
                  onClick={() => handleDeleteImage(selectedImage.id)}
                  className="w-full py-2 text-[#A8A8A8] hover:text-white hover:bg-[#242424] rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
