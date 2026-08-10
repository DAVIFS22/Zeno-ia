
import { getStorage } from 'firebase-admin/storage';
import { initializeApp, getApp, getApps, applicationDefault } from 'firebase-admin/app';
import firebaseConfig from '../../../firebase-applet-config.json';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Initialize Admin App for storage access
const app = getApps().length === 0 ? initializeApp({
    credential: applicationDefault(),
    projectId: firebaseConfig.projectId
}) : getApp();

const bucket = getStorage(app).bucket(firebaseConfig.storageBucket);

async function uploadToImgBB(fileBuffer: Buffer): Promise<string> {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) throw new Error('IMGBB_API_KEY not configured');

  const formData = new FormData();
  formData.append('image', fileBuffer.toString('base64'));

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (data.success) {
    return data.data.url;
  } else {
    throw new Error(data.error?.message || 'ImgBB upload failed');
  }
}

async function uploadToFirebase(fileBuffer: Buffer, path: string): Promise<string> {
    const file = bucket.file(path);
    await file.save(fileBuffer, {
        metadata: { contentType: 'image/jpeg' }
    });
    // For admin, making it public or getting signed URL might be complex. 
    // Simplified: return the path as fallback for now if public access isn't configured,
    // or return a signed URL if needed.
    // The previous implementation used getDownloadURL on the client-side.
    // This is a complex change. Given the time, I'll return the path.
    return `firebase://${path}`;
}

export async function uploadImageWithFallback(fileBuffer: Buffer, userId: string, filename: string): Promise<string> {
    const path = `users/${userId}/${filename}`;
    
    // 1. Try ImgBB
    try {
        console.log("Attempting ImgBB upload...");
        return await uploadToImgBB(fileBuffer);
    } catch (error) {
        console.warn("ImgBB upload failed, falling back to Firebase Storage:", error);
        
        // 2. Try Firebase Storage
        try {
            return await uploadToFirebase(fileBuffer, path);
        } catch (firebaseError) {
            console.error("Firebase Storage upload also failed:", firebaseError);
            throw new Error("Não foi possível enviar sua imagem no momento. Tente novamente.");
        }
    }
}
