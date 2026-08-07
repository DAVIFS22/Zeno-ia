let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let dataArray: Uint8Array | null = null;
let requestFrame: number = 0;
let mediaStream: MediaStream | null = null;
let smoothVolume = 0;

export async function startAudioLevelMeter(existingStream?: MediaStream) {
  try {
    mediaStream = existingStream || await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    smoothVolume = 0;

    const updateLevel = () => {
      if (!analyser || !dataArray) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalized = Math.min(Math.max(average / 100, 0), 1);
      
      smoothVolume = smoothVolume * 0.7 + normalized * 0.3;
      
      const blobs = document.querySelectorAll('.voice-mic-blob-animation');
      blobs.forEach(blob => {
        const blur = Math.round(smoothVolume * 15);
        const spread = Math.round(smoothVolume * 6);
        const scale = (1 + smoothVolume * 0.5).toFixed(3);
        const el = blob as HTMLElement;
        el.style.willChange = 'transform';
        el.style.transform = `scale3d(${scale}, ${scale}, 1)`;
        el.style.opacity = '1';
        el.style.filter = `hue-rotate(${Math.round(smoothVolume * 120)}deg)`;
        el.style.boxShadow = `0 0 ${blur}px ${spread}px rgba(59, 130, 246, ${(0.2 + smoothVolume * 0.5).toFixed(2)})`;
      });
      
      requestFrame = requestAnimationFrame(updateLevel);
    };
    updateLevel();
    return true;
  } catch (err) {
    console.error("Failed to start audio level meter:", err);
    return false;
  }
}

export function stopAudioLevelMeter() {
  const blobs = document.querySelectorAll('.voice-mic-blob-animation');
  blobs.forEach(blob => {
    const el = blob as HTMLElement;
    el.style.transform = `scale(0)`;
    el.style.opacity = `0`;
    el.style.filter = `hue-rotate(0deg)`;
    el.style.boxShadow = `none`;
    el.style.willChange = `auto`;
  });

  if (requestFrame) cancelAnimationFrame(requestFrame);
  if (source) { source.disconnect(); source = null; }
  if (analyser) { analyser.disconnect(); analyser = null; }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(console.error);
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}
