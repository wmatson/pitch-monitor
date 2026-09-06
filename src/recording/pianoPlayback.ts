import { midiFromFrequency } from '../music/pitchMath'
import type { RawSample } from './trace'

// Piano playback reconstructs the sung tune, not the pitch-history seismograph.
// Keep the recorded timeline, hard-snap pitches to target notes, and only remove
// one-sample note glitches before scheduling contiguous note runs.
export const PIANO_NOTE_TAIL_MS = 50

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

  for (let index = 0; index < targetMidis.length; index += 1) {
    if (index > 0 && targetMidis[index] === targetMidis[index - 1]) continue
    events.push({ midi: targetMidis[index], startMs: samples[index].timestampMs - firstTimestamp, durationMs: 0 })
  }

  for (let index = 0; index < events.length; index += 1) {
    const nextStart = events[index + 1]?.startMs
    const recordingEndMs = samples.at(-1)!.timestampMs - firstTimestamp
    const finalDuration = Math.max(PIANO_NOTE_TAIL_MS, recordingEndMs - events[index].startMs)
    events[index].durationMs = nextStart === undefined ? finalDuration : nextStart - events[index].startMs
  }
  return events
}
