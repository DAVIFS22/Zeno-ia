import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Loader2, User } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import imageCompression from 'browser-image-compression';
import { auth, db } from '../lib/firebase';
import { useTranslation } from '../i18n';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onUpdate: () => void;
  isDark: boolean;
}

export function EditProfileModal({ isOpen, onClose, user, onUpdate, isDark }: EditProfileModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(user?.displayName || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.photoURL || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(user?.displayName || '');
    setPhotoPreview(user?.photoURL || null);
  }, [user, isOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 500,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);
        setPhotoFile(compressedFile);
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result as string);
        reader.readAsDataURL(compressedFile);
      } catch (err) {
        console.error("Image compression error", err);
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let photoURL = user?.photoURL;
      if (photoFile) {
        const formData = new FormData();
        formData.append('image', photoFile);
        formData.append('userId', user.uid);
        formData.append('filename', 'profile.jpg');
            
        const response = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.imageUrl) {
            photoURL = data.imageUrl;
        } else {
            throw new Error(data.error || 'Upload failed');
        }
      }

      const updates: any = {};
      if (name !== user.displayName) updates.displayName = name;
      if (photoURL !== user.photoURL) updates.photoURL = photoURL;

      console.log("Updating profile...", updates);

      if (Object.keys(updates).length > 0) {
        await updateProfile(auth.currentUser!, updates);
        await updateDoc(doc(db, 'users', user.uid), updates);
        onUpdate();
        console.log("Profile updated successfully");
      }
      onClose();
    } catch (err: any) {
      console.error("Save error:", err);
      setError("Não foi possível salvar as alterações. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className={`w-full max-w-sm p-6 rounded-2xl border ${isDark ? 'bg-[#17171a] border-[#2C2C2E]' : 'bg-white border-neutral-200'}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Editar perfil</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-500/10">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="flex flex-col items-center mb-6">
          <div className="relative inline-block">
            <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-neutral-700 bg-neutral-800">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-400">
                  <User className="w-16 h-16" />
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`absolute bottom-1 right-1 p-2 rounded-full bg-zeno text-white hover:bg-zeno/90 border-[3px] ${isDark ? 'border-[#17171a]' : 'border-white'}`}
            >
              <Camera className="w-4 h-4" />
            </button>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-neutral-400 mb-2">Nome de exibição</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full p-3 rounded-xl border ${isDark ? 'bg-[#232326] border-[#2C2C2E] text-white' : 'bg-neutral-50 border-neutral-200 text-neutral-900'} text-sm`}
          />
          <p className="text-[10px] text-neutral-500 mt-1">Esse nome pode aparecer nas suas conversas e no seu perfil.</p>
        </div>

        {error && <div className="mb-4 text-xs text-red-400">{error}</div>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-400 hover:text-white">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={isLoading || !name.trim() || (name.trim() === (user?.displayName || '') && !photoFile)}
            className="px-4 py-2 rounded-xl bg-zeno text-white text-sm font-semibold disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
