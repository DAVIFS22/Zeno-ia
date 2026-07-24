export async function downloadImage(imageUrl: string, filename: string = 'zeno-image.jpg'): Promise<boolean> {
  try {
    // Strategy 1: Fetch image as Blob (Triggers native file download prompt across origins)
    const response = await fetch(imageUrl, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP error status: ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename.endsWith('.jpg') || filename.endsWith('.png') ? filename : `${filename}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    return true;
  } catch (err) {
    console.warn('Fetch blob download failed, trying canvas fallback:', err);
    
    // Strategy 2: Canvas Conversion Fallback
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 1024;
          canvas.height = img.naturalHeight || img.height || 1024;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context unavailable');
          ctx.drawImage(img, 0, 0);

          canvas.toBlob((blob) => {
            if (!blob) {
              fallbackDirectOpen();
              return resolve(false);
            }
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
            resolve(true);
          }, 'image/jpeg', 0.95);
        } catch (e) {
          fallbackDirectOpen();
          resolve(false);
        }
      };

      img.onerror = () => {
        fallbackDirectOpen();
        resolve(false);
      };

      img.src = imageUrl;

      function fallbackDirectOpen() {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
  }
}
