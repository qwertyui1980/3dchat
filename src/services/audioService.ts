export class AudioService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationId: number | null = null;
  private onVolumeChange: ((volume: number) => void) | null = null;
  public isMuted: boolean = true;
  private hasInteractionListeners: boolean = false;

  constructor() {
    this.setupInteractionResume();
  }

  private setupInteractionResume() {
    if (this.hasInteractionListeners || typeof window === 'undefined') return;
    this.hasInteractionListeners = true;

    const resumeAudio = () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    };

    window.addEventListener('click', resumeAudio, { passive: true });
    window.addEventListener('keydown', resumeAudio, { passive: true });
    window.addEventListener('touchstart', resumeAudio, { passive: true });
  }

  async ensureResumed(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn('[AudioService] Could not resume audio context:', e);
      }
    }
  }

  async start(onVolume: (volume: number) => void): Promise<MediaStream | null> {
    this.onVolumeChange = onVolume;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Enforce default muted state on all audio tracks
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume().catch(() => {});
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.3;

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.analyser);

      const bufferLength = this.analyser.fftSize;
      this.dataArray = new Uint8Array(bufferLength);
      const freqData = new Uint8Array(this.analyser.frequencyBinCount);
      let lastDispatchTime = 0;

      const analyzeAudio = (timestamp: number) => {
        if (!this.analyser || !this.dataArray) return;

        if (this.isMuted) {
          if (this.onVolumeChange && timestamp - lastDispatchTime > 60) {
            lastDispatchTime = timestamp;
            this.onVolumeChange(0);
          }
        } else {
          // Time-domain RMS for real sound pressure detection
          this.analyser.getByteTimeDomainData(this.dataArray as unknown as Uint8Array<ArrayBuffer>);
          let sumSquares = 0;
          for (let i = 0; i < this.dataArray.length; i++) {
            const norm = (this.dataArray[i] - 128) / 128;
            sumSquares += norm * norm;
          }
          const rms = Math.sqrt(sumSquares / this.dataArray.length);

          // Frequency spectrum energy for vocal resonance
          this.analyser.getByteFrequencyData(freqData as unknown as Uint8Array<ArrayBuffer>);
          let freqSum = 0;
          const speechBins = Math.min(freqData.length, 32);
          for (let i = 1; i < speechBins; i++) {
            freqSum += freqData[i];
          }
          const avgFreq = freqSum / (speechBins * 255);

          const rawEnergy = Math.max(rms, avgFreq * 0.45);
          // Noise Gate: ambient room noise, computer fans, breathing, keyboard clicks (~0.005 to 0.028)
          // are strictly gated to 0. Only genuine human voice sounds above 0.032 pass through.
          const NOISE_GATE = 0.032;
          const PEAK_RANGE = 0.20;
          let normalized = 0;
          if (rawEnergy > NOISE_GATE) {
            const excess = Math.min(1.0, (rawEnergy - NOISE_GATE) / PEAK_RANGE);
            // Non-linear power curve (gamma 1.5): suppresses low sounds and captures prominent vocal peaks
            normalized = Math.min(1.0, Math.pow(excess, 1.5) * 1.25);
          }

          if (this.onVolumeChange && timestamp - lastDispatchTime >= 30) {
            lastDispatchTime = timestamp;
            this.onVolumeChange(normalized);
          }
        }

        this.animationId = requestAnimationFrame(analyzeAudio);
      };

      this.animationId = requestAnimationFrame(analyzeAudio);
      return this.mediaStream;
    } catch (err) {
      console.warn('[AudioService] Could not access microphone:', err);
      throw err;
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
    if (!mute) {
      this.ensureResumed();
    }
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !mute;
      });
    }
    if (mute && this.onVolumeChange) {
      this.onVolumeChange(0);
    }
  }

  /**
   * Plays a subtle, minimal synthesized chime when someone joins the room.
   */
  playJoinSound() {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1: E5 (659.25 Hz) - subtle warm bell
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);

      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.linearRampToValueAtTime(0.06, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      // Note 2: A5 (880.00 Hz) - harmonized chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.08);

      gain2.gain.setValueAtTime(0.0001, now + 0.08);
      gain2.gain.linearRampToValueAtTime(0.05, now + 0.10);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.3);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.45);

      setTimeout(() => {
        try {
          ctx.close().catch(() => {});
        } catch (_) {}
      }, 500);
    } catch (_) {
      // Ignore audio autoplay restrictions
    }
  }

  getStream(): MediaStream | null {
    return this.mediaStream;
  }

  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}

export const audioServiceSingleton = new AudioService();
