import { BaseDetector } from "../BaseDetector";

type NoiseDetectorOptions = {
  durationMs?: number;
  decibelThreshold?: number;
};

const DEFAULT_DURATION_MS = 1500;
const DEFAULT_DECIBEL_THRESHOLD = -40;

export class NoiseDetector extends BaseDetector {
  private readonly durationMs: number;
  private readonly decibelThreshold: number;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private rafId: number | null = null;
  private noiseStartMs: number | null = null;
  private hasFlaggedCurrentNoiseWindow = false;

  constructor(options: NoiseDetectorOptions = {}) {
    super();
    this.durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
    this.decibelThreshold = options.decibelThreshold ?? DEFAULT_DECIBEL_THRESHOLD;
  }

  async start(): Promise<void> {
    if (this.audioContext) {
      return;
    }

    this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext();
    await this.audioContext.resume();
    this.sourceNode = this.audioContext.createMediaStreamSource(this.microphoneStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.85;
    this.analyser.minDecibels = -100;
    this.analyser.maxDecibels = -10;
    this.sourceNode.connect(this.analyser);

    this.noiseStartMs = null;
    this.hasFlaggedCurrentNoiseWindow = false;
    this.monitorNoise();
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
    }

    this.noiseStartMs = null;
    this.hasFlaggedCurrentNoiseWindow = false;
  }

  private monitorNoise(): void {
    if (!this.analyser || !this.audioContext) {
      return;
    }

    const sampleBuffer = new Float32Array(this.analyser.frequencyBinCount);

    const tick = (): void => {
      if (!this.analyser) {
        return;
      }

      this.analyser.getFloatFrequencyData(sampleBuffer);

      const currentDb = this.computeDecibelLevel(sampleBuffer);
      const isLoud = currentDb >= this.decibelThreshold;
      const now = performance.now();

      if (isLoud) {
        if (this.noiseStartMs === null) {
          this.noiseStartMs = now;
          this.hasFlaggedCurrentNoiseWindow = false;
        }

        const elapsed = now - this.noiseStartMs;
        if (elapsed >= this.durationMs && !this.hasFlaggedCurrentNoiseWindow) {
          this.emitNoiseFlag();
          this.hasFlaggedCurrentNoiseWindow = true;
        }
      } else {
        this.noiseStartMs = null;
        this.hasFlaggedCurrentNoiseWindow = false;
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private computeDecibelLevel(samples: Float32Array): number {
    let weightedSum = 0;
    let count = 0;

    for (let i = 0; i < samples.length; i += 1) {
      const value = samples[i];
      if (!Number.isFinite(value)) {
        continue;
      }

      // Emphasize louder bins so brief strong noise is not drowned out by silence.
      const shifted = value + 100;
      weightedSum += shifted * shifted;
      count += 1;
    }

    if (count === 0) {
      return -100;
    }

    const weightedAvg = Math.sqrt(weightedSum / count);
    return weightedAvg - 100;
  }

  private emitNoiseFlag(): void {
    const flag = {
      type: "NOISE_DETECTED",
      message: "Excessive background noise detected",
      timestamp: new Date(),
    };

    const maybeEmitter = this as unknown as {
      emitFlag?: (payload: typeof flag) => void;
      emit?: (payload: typeof flag) => void;
      flagEventBus?: { emit?: (payload: typeof flag) => void };
      eventBus?: { emit?: (payload: typeof flag) => void; publish?: (payload: typeof flag) => void };
    };

    if (typeof maybeEmitter.emitFlag === "function") {
      maybeEmitter.emitFlag(flag);
      return;
    }

    if (typeof maybeEmitter.emit === "function") {
      maybeEmitter.emit(flag);
      return;
    }

    if (typeof maybeEmitter.flagEventBus?.emit === "function") {
      maybeEmitter.flagEventBus.emit(flag);
      return;
    }

    if (typeof maybeEmitter.eventBus?.emit === "function") {
      maybeEmitter.eventBus.emit(flag);
      return;
    }

    if (typeof maybeEmitter.eventBus?.publish === "function") {
      maybeEmitter.eventBus.publish(flag);
      return;
    }

    // Fallback hook so UI/orchestrator layers can still subscribe to flags.
    window.dispatchEvent(new CustomEvent("PROCTORING_FLAG", { detail: flag }));
  }
}
