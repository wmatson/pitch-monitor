import { midiFromFrequency } from '../music/pitchMath'
import type { RawSample } from './trace'

// Piano playback reconstructs the sung tune, not the pitch-history seismograph.
// Keep the recorded timeline, hard-snap pitches to target notes, and segment
// note onsets/offsets so gaps in detection become rests.
export const PIANO_NOTE_TAIL_MS = 50
export const PIANO_NOTE_GAP_MS = 120
export const PIANO_GLITCH_MAX_MS = 35

export type PianoPlaybackEvent = {
  midi: number
  startMs: number
  durationMs: number
}

const removeIsolatedGlitches = (targetMidis: number[]) => {
  const cleaned = [...targetMidis]
  for (let index = 1; index < cleaned.length - 1; index += 1) {
    if (cleaned[index - 1] === cleaned[index + 1] && cleaned[index] !== cleaned[index - 1]) cleaned[index] = cleaned[index - 1]
  }
  return cleaned
}

export const pianoPlaybackEvents = (samples: RawSample[]): PianoPlaybackEvent[] => {
  if (!samples.length) return []
  const targetMidis = removeIsolatedGlitches(samples.map((sample) => midiFromFrequency(sample.frequencyHz)))
  const firstTimestamp = samples[0].timestampMs
  const events: PianoPlaybackEvent[] = []
  let segmentStart = 0

  const addSegment = (segmentEnd: number, nextStart: number | undefined) => {
    const startMs = samples[segmentStart].timestampMs - firstTimestamp
    const lastSampleMs = samples[segmentEnd].timestampMs - firstTimestamp
    const detectionGapMs = nextStart === undefined ? 0 : samples[nextStart].timestampMs - samples[segmentEnd].timestampMs
    const durationMs = detectionGapMs > PIANO_NOTE_GAP_MS
      ? Math.max(PIANO_NOTE_TAIL_MS, lastSampleMs - startMs + PIANO_NOTE_TAIL_MS)
      : nextStart === undefined
        ? Math.max(PIANO_NOTE_TAIL_MS, lastSampleMs - startMs + PIANO_NOTE_TAIL_MS)
        : samples[nextStart].timestampMs - firstTimestamp - startMs
    events.push({ midi: targetMidis[segmentStart], startMs, durationMs })
  }

  for (let index = 1; index <= targetMidis.length; index += 1) {
    const noteChanged = index < targetMidis.length && targetMidis[index] !== targetMidis[segmentStart]
    const detectionGap = index < samples.length && samples[index].timestampMs - samples[index - 1].timestampMs > PIANO_NOTE_GAP_MS
    if (index === targetMidis.length || noteChanged || detectionGap) {
      addSegment(index - 1, index < targetMidis.length ? index : undefined)
      segmentStart = index
    }
  }

  // A pitch detector can briefly cross a semitone boundary during vibrato or
  // a consonant. Do not make those sub-frame blips audible as piano attacks.
  const smoothed: PianoPlaybackEvent[] = []
  for (const event of events) {
    const prior = smoothed.at(-1)
    if (event.durationMs < PIANO_GLITCH_MAX_MS && prior) {
      prior.durationMs = Math.max(prior.startMs + prior.durationMs, event.startMs + event.durationMs) - prior.startMs
      continue
    }
    if (prior?.midi === event.midi && event.startMs <= prior.startMs + prior.durationMs) {
      prior.durationMs = Math.max(prior.startMs + prior.durationMs, event.startMs + event.durationMs) - prior.startMs
      continue
    }
    smoothed.push({ ...event })
  }
  return smoothed
}
