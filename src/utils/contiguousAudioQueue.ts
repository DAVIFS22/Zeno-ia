/**
 * ContiguousAudioQueue
 * 
 * Manages low-latency, gapless audio playback using Web Audio API and AudioBufferSourceNodes.
 * Features a look-ahead buffering engine with dynamic GainNode micro-crossfading / envelope
 * smoothing to eliminate zero-crossing clicks, popping, and clipping between TTS chunks.
 */

export interface ContiguousAudioQueueOptions {
  sampleRate?: number;
  initialBufferDelaySec?: number; // small lookahead window to prevent underruns (default 30ms)
  crossfadeSec?: number;          // crossfade look-ahead duration (10-20ms, default 15ms)
  onPlaybackStarted?: () => void;
  onPlaybackEnded?: () => void;
  onError?: (err: Error) => void;
}

interface ActiveAudioUnit {
  sourceNode: AudioBufferSourceNode;
  gainNode: GainNode;
  startTime: number;
  endTime: number;
}

export class ContiguousAudioQueue {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sampleRate: number;
  private initialBufferDelaySec: number;
  private crossfadeSec: number;
  private nextStartTime: number = 0;
  private activeUnits: ActiveAudioUnit[] = [];
  private isStarted: boolean = false;
  private isEnded: boolean = false;
  private isCancelled: boolean = false;
  private endCheckTimeout: any = null;

  // Look-ahead pre-decoded chunk queue
  private pendingChunkQueue: AudioBuffer[] = [];
  private isProcessingQueue: boolean = false;

  private onPlaybackStarted?: () => void;
  private onPlaybackEnded?: () => void;
  private onError?: (err: Error) => void;

  constructor(options?: ContiguousAudioQueueOptions) {
    this.sampleRate = options?.sampleRate || 24000;
    this.initialBufferDelaySec = options?.initialBufferDelaySec ?? 0.03; // 30ms initial jitter buffer
    // 15ms (0.015s) crossfade window in the 10-20ms range for smooth de-clicked transitions
    const requestedCrossfade = options?.crossfadeSec ?? 0.015;
    this.crossfadeSec = Math.max(0.010, Math.min(0.020, requestedCrossfade));
    this.onPlaybackStarted = options?.onPlaybackStarted;
    this.onPlaybackEnded = options?.onPlaybackEnded;
    this.onError = options?.onError;
  }

  /**
   * Initializes or attaches an existing AudioContext and configures the master audio bus
   */
  public initContext(existingCtx?: AudioContext | null): AudioContext {
    if (existingCtx && existingCtx.state !== 'closed') {
      this.ctx = existingCtx;
    } else if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass({ sampleRate: this.sampleRate });
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // Initialize master gain node and analyser node if needed
    if (this.ctx && !this.masterGain) {
      try {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

        this.analyserNode = this.ctx.createAnalyser();
        this.analyserNode.fftSize = 256;
        this.analyserNode.smoothingTimeConstant = 0.82;

        this.masterGain.connect(this.analyserNode);
        this.analyserNode.connect(this.ctx.destination);
      } catch (e) {}
    }

    return this.ctx;
  }

  /**
   * Returns the AnalyserNode for real-time frequency/waveform visualization
   */
  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  /**
   * Returns the underlying AudioContext
   */
  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Decodes a Base64-encoded 16-bit linear PCM chunk into an AudioBuffer
   */
  public decodePcmChunk(base64Data: string, mimeType?: string): AudioBuffer | null {
    if (!this.ctx) {
      this.initContext();
    }
    const ctx = this.ctx!;

    try {
      const rateMatch = mimeType?.match(/rate=(\d+)/);
      const effectiveSampleRate = rateMatch ? parseInt(rateMatch[1], 10) : this.sampleRate;

      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const numSamples = Math.floor(bytes.length / 2);
      if (numSamples === 0) return null;

      const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, numSamples);
      const float32Array = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, numSamples, effectiveSampleRate);
      audioBuffer.getChannelData(0).set(float32Array);

      return audioBuffer;
    } catch (err: any) {
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }

  /**
   * Enqueues a raw PCM chunk, immediately decodes it via look-ahead, and schedules it
   */
  public enqueuePcmChunk(base64Data: string, mimeType?: string): void {
    if (this.isCancelled) return;

    const audioBuffer = this.decodePcmChunk(base64Data, mimeType);
    if (!audioBuffer) return;

    // Look-ahead buffer ingestion
    this.pendingChunkQueue.push(audioBuffer);
    this.processLookaheadQueue();
  }

  /**
   * Look-ahead worker: processes and schedules pending chunks on the Web Audio API graph
   * with dynamic GainNode micro-crossfades to prevent clipping and clicks.
   */
  private processLookaheadQueue(): void {
    if (this.isCancelled || this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.pendingChunkQueue.length > 0 && !this.isCancelled) {
      const buffer = this.pendingChunkQueue.shift();
      if (buffer) {
        this.scheduleBufferWithLookahead(buffer);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Schedules an AudioBuffer on the timeline with dynamic gain envelope look-ahead
   */
  public scheduleBuffer(buffer: AudioBuffer): void {
    this.scheduleBufferWithLookahead(buffer);
  }

  /**
   * Schedules an AudioBuffer using dynamic GainNode envelope smoothing & look-ahead crossfading
   */
  private scheduleBufferWithLookahead(buffer: AudioBuffer): void {
    if (this.isCancelled) return;
    if (!this.ctx) {
      this.initContext();
    }
    const ctx = this.ctx!;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const currentTime = ctx.currentTime;
      const duration = buffer.duration;
      if (duration <= 0) return;

      // Create AudioBufferSourceNode and individual GainNode for smoothing
      const sourceNode = ctx.createBufferSource();
      const gainNode = ctx.createGain();

      sourceNode.buffer = buffer;
      sourceNode.connect(gainNode);

      // Route gainNode to master gain or destination
      if (this.masterGain) {
        gainNode.connect(this.masterGain);
      } else {
        gainNode.connect(ctx.destination);
      }

      let startTime: number;
      const crossfade = Math.min(this.crossfadeSec, duration / 2);

      if (!this.isStarted || this.nextStartTime <= currentTime) {
        // Initial chunk or underrun: start slightly ahead
        startTime = currentTime + this.initialBufferDelaySec;
        this.isStarted = true;
        this.onPlaybackStarted?.();

        // Smooth initial attack fade-in to prevent initial speaker click
        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.linearRampToValueAtTime(1.0, startTime + crossfade);
      } else {
        // Look-ahead crossfade: start overlapping slightly with the previous chunk's tail
        startTime = Math.max(currentTime + 0.002, this.nextStartTime - crossfade);

        // Smooth fade-in across boundary
        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.linearRampToValueAtTime(1.0, startTime + crossfade);
      }

      const endTime = startTime + duration;

      // Schedule natural decay / de-clicking fade-out at chunk end
      const fadeOutStart = Math.max(startTime + crossfade, endTime - crossfade);
      gainNode.gain.setValueAtTime(1.0, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0.0001, endTime);

      // Start the source node precisely on timeline
      sourceNode.start(startTime);
      this.nextStartTime = endTime;

      const unit: ActiveAudioUnit = {
        sourceNode,
        gainNode,
        startTime,
        endTime
      };
      this.activeUnits.push(unit);

      sourceNode.onended = () => {
        const idx = this.activeUnits.indexOf(unit);
        if (idx !== -1) {
          this.activeUnits.splice(idx, 1);
        }
        try {
          sourceNode.disconnect();
          gainNode.disconnect();
        } catch (e) {}
      };

      // Reset end timeout if new chunks are scheduled
      if (this.endCheckTimeout) {
        clearTimeout(this.endCheckTimeout);
        this.endCheckTimeout = null;
      }
    } catch (err: any) {
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Signals that all chunks for the current stream have been enqueued.
   * Schedules onPlaybackEnded when the last scheduled AudioBuffer ends.
   */
  public endStream(): void {
    if (this.isEnded || this.isCancelled) return;
    this.isEnded = true;

    // Process any remaining lookahead items
    this.processLookaheadQueue();

    const ctx = this.ctx;
    if (!ctx) {
      this.onPlaybackEnded?.();
      return;
    }

    const remainingSec = Math.max(0, this.nextStartTime - ctx.currentTime);
    const remainingMs = remainingSec * 1000;

    if (this.endCheckTimeout) {
      clearTimeout(this.endCheckTimeout);
    }

    this.endCheckTimeout = setTimeout(() => {
      if (!this.isCancelled) {
        this.onPlaybackEnded?.();
      }
    }, remainingMs + 50);
  }

  /**
   * Returns remaining playback duration in seconds
   */
  public getRemainingDuration(): number {
    if (!this.ctx) return 0;
    return Math.max(0, this.nextStartTime - this.ctx.currentTime);
  }

  /**
   * Cancels all active playing nodes, performs instant smooth fade-out and clears the queue
   */
  public cancel(): void {
    this.isCancelled = true;
    this.pendingChunkQueue = [];

    if (this.endCheckTimeout) {
      clearTimeout(this.endCheckTimeout);
      this.endCheckTimeout = null;
    }

    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;

    for (const unit of this.activeUnits) {
      try {
        if (ctx && ctx.state === 'running') {
          // Instant 5ms ramp-down to prevent pop when interrupting speech
          unit.gainNode.gain.cancelScheduledValues(now);
          unit.gainNode.gain.setValueAtTime(unit.gainNode.gain.value, now);
          unit.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.005);
          unit.sourceNode.stop(now + 0.006);
        } else {
          unit.sourceNode.stop();
        }
      } catch (e) {}
    }

    setTimeout(() => {
      for (const unit of this.activeUnits) {
        try {
          unit.sourceNode.disconnect();
          unit.gainNode.disconnect();
        } catch (e) {}
      }
      this.activeUnits = [];
    }, 20);

    this.nextStartTime = 0;
  }
}
