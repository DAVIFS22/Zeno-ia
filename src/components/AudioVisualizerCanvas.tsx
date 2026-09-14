import React, { useEffect, useRef } from 'react';

interface AudioVisualizerCanvasProps {
  analyserNode?: AnalyserNode | null;
  mediaStream?: MediaStream | null;
  isActive: boolean;
  isSpeaking?: boolean;
  isAudioActive?: boolean;
  mode?: 'idle' | 'listening' | 'processing' | 'speaking';
  className?: string;
  variant?: 'bars' | 'wave' | 'combined';
  theme?: 'dark' | 'light';
}

export const AudioVisualizerCanvas: React.FC<AudioVisualizerCanvasProps> = ({
  analyserNode,
  mediaStream,
  isActive,
  isSpeaking = false,
  isAudioActive,
  mode = 'idle',
  className = '',
  variant = 'combined',
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Internal audio context & analyser for MediaStream prop
  const internalAudioCtxRef = useRef<AudioContext | null>(null);
  const internalAnalyserRef = useRef<AnalyserNode | null>(null);
  const internalSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Keep latest dynamic props in refs to avoid recreating the animation loop & observers
  const analyserRef = useRef<AnalyserNode | null>(analyserNode);
  const isActiveRef = useRef<boolean>(isActive);
  const isAudioActiveRef = useRef<boolean | undefined>(isAudioActive);
  const isSpeakingRef = useRef<boolean>(isSpeaking);
  const modeRef = useRef<'idle' | 'listening' | 'processing' | 'speaking'>(mode);
  const variantRef = useRef<'bars' | 'wave' | 'combined'>(variant);
  const themeRef = useRef<'dark' | 'light'>(theme);

  useEffect(() => {
    if (mediaStream && !analyserNode) {
      if (!internalAudioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        internalAudioCtxRef.current = new AudioCtxClass();
      }
      
      const ctx = internalAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (!internalAnalyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        internalAnalyserRef.current = analyser;
      }

      // Reconnect if the stream is different
      if (internalSourceRef.current && internalSourceRef.current.mediaStream !== mediaStream) {
        try { internalSourceRef.current.disconnect(); } catch (e) {}
        internalSourceRef.current = null;
      }

      if (!internalSourceRef.current) {
        try {
          const sourceNode = ctx.createMediaStreamSource(mediaStream);
          sourceNode.connect(internalAnalyserRef.current);
          internalSourceRef.current = sourceNode;
        } catch (e) {
           // Handle case where media stream has no audio tracks, etc.
        }
      }
      
      analyserRef.current = internalAnalyserRef.current;
    } else {
      analyserRef.current = analyserNode || null;
    }
  }, [mediaStream, analyserNode]);

  useEffect(() => {
    return () => {
      if (internalSourceRef.current) {
        try { internalSourceRef.current.disconnect(); } catch (e) {}
        internalSourceRef.current = null;
      }
      if (internalAnalyserRef.current) {
        try { internalAnalyserRef.current.disconnect(); } catch (e) {}
        internalAnalyserRef.current = null;
      }
      if (internalAudioCtxRef.current) {
        if (internalAudioCtxRef.current.state !== 'closed') {
          internalAudioCtxRef.current.close().catch(() => {});
        }
        internalAudioCtxRef.current = null;
      }
    };
  }, []);

  isActiveRef.current = isActive;
  isAudioActiveRef.current = isAudioActive;
  isSpeakingRef.current = isSpeaking;
  modeRef.current = mode;
  variantRef.current = variant;
  themeRef.current = theme;

  // Smoothed frequency values array for fluid transitions (cached)
  const smoothedFreqRef = useRef<Float32Array>(new Float32Array(32));
  const idlePhaseRef = useRef<number>(0);
  const cachedDataArrayRef = useRef<Uint8Array>(new Uint8Array(64));
  const cachedTimeArrayRef = useRef<Uint8Array>(new Uint8Array(64));

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let width = container.clientWidth || 320;
    let height = container.clientHeight || 96;

    const resizeCanvas = () => {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      width = Math.max(rect.width, 100);
      height = Math.max(rect.height, 40);
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 to conserve GPU bandwidth

      const newCanvasW = Math.floor(width * dpr);
      const newCanvasH = Math.floor(height * dpr);

      if (canvas.width !== newCanvasW || canvas.height !== newCanvasH) {
        canvas.width = newCanvasW;
        canvas.height = newCanvasH;
      }

      const ctx = canvas.getContext('2d', { alpha: true });
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);
    resizeCanvas();

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const render = () => {
      // If inactive, sleep RAF completely to conserve 100% CPU/GPU
      if (!isActiveRef.current) {
        ctx.clearRect(0, 0, width, height);
        animationFrameIdRef.current = null;
        return;
      }

      animationFrameIdRef.current = requestAnimationFrame(render);

      const activeMode = modeRef.current;
      const activeAnalyser = analyserRef.current;
      const explicitAudioActive = isAudioActiveRef.current;
      const activeSpeaking = isSpeakingRef.current;
      const currentVariant = variantRef.current;

      const shouldSample = explicitAudioActive !== undefined 
        ? explicitAudioActive 
        : (activeSpeaking || activeMode === 'speaking' || activeMode === 'listening');

      idlePhaseRef.current += shouldSample ? 0.08 : 0.03;

      ctx.clearRect(0, 0, width, height);

      let hasAudioSignal = false;
      if (activeAnalyser && shouldSample) {
        try {
          const binCount = activeAnalyser.frequencyBinCount || 64;
          if (cachedDataArrayRef.current.length !== binCount) {
            cachedDataArrayRef.current = new Uint8Array(binCount);
            cachedTimeArrayRef.current = new Uint8Array(binCount);
          }

          const dataArray = cachedDataArrayRef.current;
          const timeDomainArray = cachedTimeArrayRef.current;

          activeAnalyser.getByteFrequencyData(dataArray);
          activeAnalyser.getByteTimeDomainData(timeDomainArray);

          // Check if there is actual audio energy in vocal frequencies
          let sum = 0;
          const checkCount = Math.min(32, dataArray.length);
          for (let i = 0; i < checkCount; i++) {
            sum += dataArray[i];
          }
          hasAudioSignal = sum > 8;
        } catch (e) {
          hasAudioSignal = false;
        }
      }

      const centerY = height / 2;
      const numBars = 28;
      const barSpacing = 4;
      const totalSpacing = (numBars - 1) * barSpacing;
      const availableWidth = Math.min(width - 32, 420);
      const barWidth = Math.max(3, (availableWidth - totalSpacing) / numBars);
      const startX = (width - (numBars * barWidth + totalSpacing)) / 2;

      // Update smoothed frequencies
      const sensitivity = activeMode === 'listening' ? 1.35 : 1.0;
      const dataArray = cachedDataArrayRef.current;

      for (let i = 0; i < numBars; i++) {
        let targetValue = 0;

        if (hasAudioSignal) {
          // Map index to logarithmically spaced audio bins for punchy voice frequencies
          const binIndex = Math.min(
            dataArray.length - 1,
            Math.floor(Math.pow(i / numBars, 1.3) * (dataArray.length * 0.45)) + 1
          );
          const rawVal = ((dataArray[binIndex] || 0) / 255) * sensitivity;
          targetValue = Math.min(1.0, rawVal);
        } else if (activeMode === 'listening') {
          // Simulated organic speech wave for listening mode
          const t = idlePhaseRef.current * 1.6;
          const baseWave = Math.sin(t + i * 0.28) * 0.5 + 0.5;
          const harmonic = Math.sin(t * 1.5 - i * 0.18) * 0.3;
          const pulseCycle = Math.sin(t * 0.35) * 0.5 + 0.5; // active speaking / pause simulation
          const noise = (Math.sin(i * 91.23 + t * 4.0) * 0.5 + 0.5) * 0.2;
          
          targetValue = Math.max(0.08, (baseWave + harmonic + noise) * pulseCycle * 0.7 + 0.12);
        } else if (isActiveRef.current) {
          // Gentle ambient breathing wave when idle / waiting / processing
          const wave1 = Math.sin(idlePhaseRef.current + i * 0.25);
          const wave2 = Math.cos(idlePhaseRef.current * 0.7 - i * 0.18);
          targetValue = Math.max(0.04, (wave1 + wave2 + 2) / 4 * 0.16);
        } else {
          targetValue = 0.02;
        }

        // Lerp for smooth visual interpolation
        const current = smoothedFreqRef.current[i] || 0;
        const lerpFactor = (hasAudioSignal || activeMode === 'listening') ? 0.35 : 0.12;
        smoothedFreqRef.current[i] = current + (targetValue - current) * lerpFactor;
      }

      const isDark = themeRef.current === 'dark';

      // Draw background ambient frequency glow
      if (hasAudioSignal) {
        const glowGrad = ctx.createRadialGradient(width / 2, centerY, 10, width / 2, centerY, availableWidth / 2);
        glowGrad.addColorStop(0, isDark ? 'rgba(0, 132, 223, 0.18)' : 'rgba(0, 132, 223, 0.14)');
        glowGrad.addColorStop(1, 'rgba(0, 132, 223, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 1. Draw Central Smooth Waveform (if variant is combined or wave)
      if (currentVariant === 'combined' || currentVariant === 'wave') {
        ctx.beginPath();
        const wavePoints = numBars * 2;
        for (let i = 0; i <= wavePoints; i++) {
          const norm = i / wavePoints;
          const x = startX + norm * (numBars * barWidth + totalSpacing);
          const barIdx = Math.min(numBars - 1, Math.floor(norm * numBars));
          const val = smoothedFreqRef.current[barIdx];
          const envelope = Math.sin(norm * Math.PI); // Window function so wave tapers at ends
          const waveY = centerY + Math.sin(idlePhaseRef.current * 2 + norm * 8) * (val * (height * 0.42) * envelope);

          if (i === 0) {
            ctx.moveTo(x, waveY);
          } else {
            ctx.lineTo(x, waveY);
          }
        }
        ctx.strokeStyle = hasAudioSignal 
          ? (isDark ? 'rgba(0, 132, 223, 0.4)' : 'rgba(0, 132, 223, 0.6)') 
          : (isDark ? 'rgba(0, 132, 223, 0.15)' : 'rgba(0, 132, 223, 0.25)');
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 2. Draw Symmetrical Mirrored Frequency Bars
      if (currentVariant === 'combined' || currentVariant === 'bars') {
        for (let i = 0; i < numBars; i++) {
          const x = startX + i * (barWidth + barSpacing);
          const val = smoothedFreqRef.current[i];
          const maxHalfHeight = (height * 0.44);
          const barHalfHeight = Math.max(2, val * maxHalfHeight);

          // Bar top and bottom
          const topY = centerY - barHalfHeight;
          const barHeight = barHalfHeight * 2;
          const radius = Math.min(barWidth / 2, barHalfHeight);

          // Zeno Blue Gradient with Zeno White luminous cap
          const barGrad = ctx.createLinearGradient(0, topY, 0, topY + barHeight);
          if (hasAudioSignal) {
            barGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');       // Zeno White crest
            barGrad.addColorStop(0.18, 'rgba(0, 132, 223, 1)');         // Zeno Blue peak
            barGrad.addColorStop(0.5, isDark ? 'rgba(0, 132, 223, 0.85)' : 'rgba(0, 132, 223, 0.95)');       // Zeno Blue core
            barGrad.addColorStop(0.82, 'rgba(0, 132, 223, 1)');         // Zeno Blue
            barGrad.addColorStop(1, 'rgba(255, 255, 255, 0.95)');        // Zeno White bottom crest
          } else {
            barGrad.addColorStop(0, isDark ? 'rgba(0, 132, 223, 0.35)' : 'rgba(0, 132, 223, 0.45)');
            barGrad.addColorStop(0.5, isDark ? 'rgba(0, 132, 223, 0.2)' : 'rgba(0, 132, 223, 0.25)');
            barGrad.addColorStop(1, isDark ? 'rgba(0, 132, 223, 0.35)' : 'rgba(0, 132, 223, 0.45)');
          }

          ctx.fillStyle = barGrad;
          ctx.beginPath();
          ctx.roundRect(x, topY, barWidth, barHeight, radius);
          ctx.fill();

          // Subtle peak cap highlight when loud
          if (hasAudioSignal && val > 0.45) {
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(x + barWidth / 2, topY + 1.5, Math.min(1.5, barWidth / 2), 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + barWidth / 2, topY + barHeight - 1.5, Math.min(1.5, barWidth / 2), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };

    if (isActive) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      animationFrameIdRef.current = requestAnimationFrame(render);
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      resizeObserver.disconnect();
    };
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      id="zeno-audio-visualizer-container"
      className={`relative w-full flex items-center justify-center pointer-events-none select-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        id="zeno-audio-visualizer-canvas"
        className="w-full h-full block"
      />
    </div>
  );
};
