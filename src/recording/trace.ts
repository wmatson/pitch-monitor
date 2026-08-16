import { midiFromFrequency } from '../music/pitchMath'
import { notationForMidi, type KeySignature } from '../music/spelling'
export type RawSample = { timestampMs: number; frequencyHz: number; confidence: number }
export type TraceSegment = { startMs: number; endMs: number; points: RawSample[]; color: 'default' | 'red' | 'blue' | 'neutral'; accidental: string | null; marker: boolean }
export const traceSegments = (samples: RawSample[], key: KeySignature): TraceSegment[] => {
  const result: TraceSegment[] = []
  for (const sample of samples) {
    const target = midiFromFrequency(sample.frequencyHz)
    const notation = notationForMidi(target, key)
    const color = !notation.isChromatic ? 'default' : notation.written.accidental === 'sharp' ? 'red' : notation.written.accidental === 'flat' ? 'blue' : 'neutral'
    const prior = result.at(-1)
    const same = prior && prior.points.length && midiFromFrequency(prior.points[0].frequencyHz) === target && prior.color === color
    if (same) { prior.points.push(sample); prior.endMs = sample.timestampMs }
    else result.push({ startMs: sample.timestampMs, endMs: sample.timestampMs, points: [sample], color, accidental: notation.isChromatic ? notation.written.accidental : null, marker: false })
  }
  for (const segment of result) segment.marker = segment.color !== 'default' && segment.endMs - segment.startMs > 200
  return result
}
