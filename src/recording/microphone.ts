import { PitchDetector } from 'pitchy'

export const microphoneConstraints: MediaStreamConstraints = {
  audio: {
    channelCount: { ideal: 1 },
    // Browser DSP can suppress or reshape the harmonics needed to identify piano notes.
    echoCancellation: false,
    autoGainControl: false,
    noiseSuppression: false,
  },
}

export type PitchFrame = { pitch: number; clarity: number; loudness: number }
export type DetectedPitch = PitchFrame & { timestampMs: number }
export const LIVE_PITCH_TIMEOUT_MS = 1200

export const isReliablePitch = ({ pitch, clarity, loudness }: PitchFrame) =>
  clarity >= 0.75 && loudness > 0.003 && pitch > 65 && pitch < 1100

export const isPitchVisible = (arrowsEnabled: boolean, lastReliable: number, now: number) =>
  arrowsEnabled && lastReliable > 0 && now - lastReliable < LIVE_PITCH_TIMEOUT_MS

type MicrophoneMonitorOptions = {
  onPitch: (pitch: DetectedPitch) => void
  onFrame: (timestampMs: number) => void
  onEnded: () => void
}

type ExtendedWindow = Window & { webkitAudioContext?: typeof AudioContext }

export class MicrophoneMonitor {
  private currentStream: MediaStream | null = null
  private currentAudioContext: AudioContext | null = null
  private raf = 0
  private stopped = true
  private readonly handleVisibility = () => {
    if (!document.hidden) void this.currentAudioContext?.resume()
  }

  constructor(private readonly options: MicrophoneMonitorOptions) {}

  get stream() { return this.currentStream }
  get audioContext() { return this.currentAudioContext }

  async start() {
    if (this.currentStream) return true
    if (!navigator.mediaDevices?.getUserMedia) return false

    try {
      this.stopped = false
      this.currentStream = await navigator.mediaDevices.getUserMedia(microphoneConstraints)
      this.currentStream.getTracks().forEach((track) => track.addEventListener('ended', this.handleTrackEnded, { once: true }))
      const AudioContextConstructor = window.AudioContext ?? (window as ExtendedWindow).webkitAudioContext
      if (!AudioContextConstructor) throw new Error('AudioContext is unavailable')
      this.currentAudioContext = new AudioContextConstructor()
      await this.currentAudioContext.resume()
      const source = this.currentAudioContext.createMediaStreamSource(this.currentStream)
      const analyser = this.currentAudioContext.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      const detector = PitchDetector.forFloat32Array(analyser.fftSize)
      const buffer = new Float32Array(detector.inputLength)
      document.addEventListener('visibilitychange', this.handleVisibility)

      const loop = () => {
        if (this.stopped || !this.currentStream || !this.currentAudioContext) return
        try {
          analyser.getFloatTimeDomainData(buffer)
          const [pitch, clarity] = detector.findPitch(buffer, this.currentAudioContext.sampleRate)
          const loudness = Math.sqrt(buffer.reduce((sum, value) => sum + value * value, 0) / buffer.length)
          if (isReliablePitch({ pitch, clarity, loudness })) {
            this.options.onPitch({ pitch, clarity, loudness, timestampMs: performance.now() })
          }
        } catch {
          // A mobile browser can tear down an audio node while backgrounding the page.
          // The track-ended handler reports a real device stop; transient read failures
          // should not permanently stop the animation loop.
        }
        this.options.onFrame(performance.now())
        this.raf = requestAnimationFrame(loop)
      }
      loop()
      return true
    } catch {
      this.stop()
      return false
    }
  }

  stop() {
    this.stopped = true
    cancelAnimationFrame(this.raf)
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.currentStream?.getTracks().forEach((track) => track.stop())
    this.currentStream = null
    void this.currentAudioContext?.close()
    this.currentAudioContext = null
  }

  private readonly handleTrackEnded = () => {
    if (this.stopped) return
    this.stop()
    this.options.onEnded()
  }
}
