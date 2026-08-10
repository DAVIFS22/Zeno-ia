import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { auth } from './firebase';

export const runStorageDiagnostic = async () => {
  console.log("--- Starting Storage Diagnostic ---");
  
  if (!auth.currentUser) {
    console.error("Diagnostic Failed: No user logged in.");
    return;
  }

  const testRef = ref(storage, 'test/ping.txt');
  try {
    console.log("Attempting upload to test/ping.txt...");
    await uploadString(testRef, 'ping');
    console.log("Upload successful!");
    
    const url = await getDownloadURL(testRef);
    console.log("Download URL:", url);
    
    console.log("Diagnostic Success!");
  } catch (error: any) {
    console.error("Diagnostic Failed!");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Full error:", error);
    
    if (error.code === 'storage/unauthorized') {
      console.warn("Hint: Security rules may be blocking this.");
    } else if (error.code === 'storage/object-not-found') {
      console.warn("Hint: Bucket might not exist or be incorrectly configured.");
    }
  }
  console.log("--- Ending Storage Diagnostic ---");
};
