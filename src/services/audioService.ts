export class AudioService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationId: number | null = null;
  private onVolumeChange: ((volume: number) => void) | null = null;
  public isMuted: boolean = false;
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

      const analyzeAudio = () => {
        if (!this.analyser || !this.dataArray) return;

        if (this.isMuted) {
          if (this.onVolumeChange) this.onVolumeChange(0);
        } else {
          // Time-domain RMS for real sound pressure detection
          this.analyser.getByteTimeDomainData(this.dataArray as unknown as Uint8Array<ArrayBuffer>);
          let sumSquares = 0;
          for (let i = 0; i < this.dataArray.length; i++) {
            const norm = (this.dataArray[i] - 128) / 128;
            sumSquares += norm * norm;
          }
          const rms = Math.sqrt(sumSquares / this.dataArray.length);

          // Calibrated sensitivity: ambient noise ~0.005, human voice ~0.02 to 0.20
          const normalized = Math.min(1, Math.max(0, (rms - 0.008) * 5.8));
          if (this.onVolumeChange) {
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
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !mute;
      });
    }
    if (mute && this.onVolumeChange) {
      this.onVolumeChange(0);
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
