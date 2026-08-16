import type { RawSample } from './recording/trace'
import { frequencyFromMidi } from './music/pitchMath'

export const demoTargetMidi = (lastPlayedMidi: number | null) => lastPlayedMidi ?? 60
export const makeDemoSamples = (nowMs = 0, centerMidi = 60): RawSample[] => {
  const points: RawSample[] = []
  for (let i = 0; i <= 80; i++) {
    const t = i * 100
    const phase = i / 8
    const midi = i < 20 ? centerMidi - 3 + i * 0.12 : i < 40 ? centerMidi + Math.sin(phase) * 0.18 : i < 60 ? centerMidi + 6 + Math.sin(phase * 1.7) * 0.2 : centerMidi + 7 + Math.sin(phase * 1.4) * 0.12
    points.push({ timestampMs: nowMs - 8000 + t, frequencyHz: frequencyFromMidi(midi), confidence: 0.96 })
  }
  return points
}
