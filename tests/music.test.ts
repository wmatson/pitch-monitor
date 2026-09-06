import { describe, expect, it } from 'vitest'
import {
  A4_MIDI,
  centsFromTarget,
  frequencyFromMidi,
  midiFromFrequency,
  correctionAngle,
} from '../src/music/pitchMath'
import {
  KEY_SIGNATURES,
  keyAt,
  notationForMidi,
  isDiatonicMidi,
} from '../src/music/spelling'
import { staffPosition, candidateFromStaff, staffY, semitoneOffsetForModifiers, staffLayout } from '../src/music/staff'
import { traceSegments } from '../src/recording/trace'
import { makeDemoSamples, demoTargetMidi } from '../src/demo'
import { microphoneConstraints, isReliablePitch, isPitchVisible } from '../src/recording/microphone'
import { pianoPlaybackEvents } from '../src/recording/pianoPlayback'
import { recordingDataFromFixture } from './fixtures/singing/audioFixtures'

describe('pitch math', () => {
  it('maps 440 Hz to A4', () => expect(midiFromFrequency(440)).toBe(69))
  it('calculates equal tempered semitone frequencies', () => expect(frequencyFromMidi(70)).toBeCloseTo(466.1638, 3))
  it('calculates cents around a target', () => {
    expect(centsFromTarget(440, 69)).toBeCloseTo(0)
    expect(centsFromTarget(440 * 2 ** (0.25 / 12), 69)).toBeCloseTo(25)
    expect(centsFromTarget(440 * 2 ** (-0.25 / 12), 69)).toBeCloseTo(-25)
  })
  it('chooses the nearest chromatic semitone', () => expect(midiFromFrequency(frequencyFromMidi(70) * 2 ** (0.49 / 12))).toBe(70))
  it('uses upward correction for flat and downward correction for sharp', () => {
    expect(correctionAngle(-30)).toBeGreaterThan(0)
    expect(correctionAngle(30)).toBeLessThan(0)
    expect(correctionAngle(2)).toBe(0)
    expect(Math.abs(correctionAngle(200))).toBe(28)
  })
})

describe('keys and spelling', () => {
  it('walks the circle of fifths in both directions', () => {
    expect([0, 1, 2, 3].map((i) => keyAt(i, 'sharp').id)).toEqual(['C', 'G', 'D', 'A'])
    expect([0, 1, 2, 3].map((i) => keyAt(i, 'flat').id)).toEqual(['C', 'F', 'Bb', 'Eb'])
    expect(KEY_SIGNATURES.at(-1)?.vexKey).toBe('Cb')
  })
  it('classifies key examples correctly', () => {
    expect(isDiatonicMidi(66, keyAt(0, 'sharp'))).toBe(false)
    expect(isDiatonicMidi(66, keyAt(1, 'sharp'))).toBe(true)
    expect(isDiatonicMidi(70, keyAt(0, 'sharp'))).toBe(false)
    expect(isDiatonicMidi(70, keyAt(1, 'flat'))).toBe(true)
    expect(isDiatonicMidi(65, keyAt(1, 'sharp'))).toBe(false)
  })
  it('changes enharmonic spelling without changing pitch identity', () => {
    expect(notationForMidi(66, keyAt(1, 'sharp')).written).toMatchObject({ letter: 'F', accidental: 'sharp' })
    expect(notationForMidi(66, keyAt(6, 'flat')).written).toMatchObject({ letter: 'G', accidental: 'flat' })
    expect(notationForMidi(61, keyAt(4, 'sharp')).written).toMatchObject({ letter: 'C', accidental: 'sharp' })
    expect(notationForMidi(61, keyAt(5, 'flat')).written).toMatchObject({ letter: 'D', accidental: 'flat' })
    expect(notationForMidi(70, keyAt(3, 'flat')).written).toMatchObject({ letter: 'B', accidental: 'flat' })
  })
})

describe('staff coordinates', () => {
  it('maps treble and bass notes with ledger-friendly coordinates', () => {
    expect(staffPosition({ letter: 'B', accidental: 'natural', octave: 4 }, 'treble')).toBe(0)
    expect(staffPosition({ letter: 'C', accidental: 'natural', octave: 4 }, 'treble')).toBe(-6)
    expect(staffPosition({ letter: 'D', accidental: 'natural', octave: 3 }, 'bass')).toBe(0)
    expect(candidateFromStaff(0, 'treble')).toMatchObject({ letter: 'B', octave: 4 })
    expect(staffY(0, 'treble')).toBe(92.5)
    expect(staffY(0, 'bass')).toBe(216.5)
    expect(staffY(-6, 'treble')).toBe(122.5)
  })
  it('maps modifier keys to chromatic playback offsets', () => {
    expect(semitoneOffsetForModifiers(false, false)).toBe(0)
    expect(semitoneOffsetForModifiers(true, false)).toBe(1)
    expect(semitoneOffsetForModifiers(false, true)).toBe(-1)
    expect(semitoneOffsetForModifiers(true, true)).toBe(0)
  })
  it('uses compact mobile insets and desktop staff margins', () => {
    expect(staffLayout(320)).toEqual({ left: 36, right: 24 })
    expect(staffLayout(599)).toEqual({ left: 36, right: 24 })
    expect(staffLayout(600)).toEqual({ left: 80, right: 40 })
    expect(staffLayout(1110)).toEqual({ left: 80, right: 40 })
  })
})

describe('trace interpretation', () => {
  const samples = (midi: number, duration: number) => [
    { timestampMs: 0, frequencyHz: frequencyFromMidi(midi), confidence: 0.95 },
    { timestampMs: duration * 1000, frequencyHz: frequencyFromMidi(midi), confidence: 0.95 },
  ]
  it('annotates only regions longer than 0.2 seconds', () => {
    expect(traceSegments(samples(66, 0.2), keyAt(0, 'sharp'))[0].marker).toBe(false)
    expect(traceSegments(samples(66, 0.201), keyAt(0, 'sharp'))[0].marker).toBe(true)
  })
  it('changes trace color and annotations when the key changes', () => {
    expect(traceSegments(samples(66, 0.3), keyAt(0, 'sharp'))[0]).toMatchObject({ color: 'red', accidental: 'sharp', marker: true })
    expect(traceSegments(samples(66, 0.3), keyAt(1, 'sharp'))[0]).toMatchObject({ color: 'default', marker: false })
    expect(traceSegments(samples(65, 0.3), keyAt(1, 'sharp'))[0]).toMatchObject({ color: 'neutral', accidental: 'natural', marker: true })
  })
  it('uses the last played note for the demo target', () => {
    expect(demoTargetMidi(64)).toBe(64)
    expect(demoTargetMidi(null)).toBe(60)
  })
  it('creates a full-window demo with continuous movement', () => {
    const demo = makeDemoSamples(8000)
    expect(demo).toHaveLength(81)
    expect(demo[0].timestampMs).toBe(0)
    expect(demo.at(-1)?.timestampMs).toBe(8000)
    expect(new Set(demo.map((sample) => Math.round(12 * Math.log2(sample.frequencyHz / 440) + 69))).size).toBeGreaterThan(3)
  })
})

describe('microphone pitch input', () => {
  it('leaves mobile microphone processing off so piano harmonics are preserved', () => {
    expect(microphoneConstraints).toEqual({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
      },
    })
  })

  it('accepts quieter but still clear piano and vocal frames', () => {
    expect(isReliablePitch({ pitch: 220, clarity: 0.76, loudness: 0.004 })).toBe(true)
    expect(isReliablePitch({ pitch: 220, clarity: 0.74, loudness: 0.02 })).toBe(false)
    expect(isReliablePitch({ pitch: 40, clarity: 0.95, loudness: 0.2 })).toBe(false)
    expect(isReliablePitch({ pitch: 1400, clarity: 0.95, loudness: 0.2 })).toBe(false)
  })

  it('keeps the live arrow visible only while a recent pitch is available', () => {
    expect(isPitchVisible(true, 1000, 2199)).toBe(true)
    expect(isPitchVisible(true, 1000, 2200)).toBe(false)
    expect(isPitchVisible(false, 1000, 1100)).toBe(false)
  })

  it('reconstructs the sung tune as target-note events without changing timing', () => {
    const samples = [
      { timestampMs: 1000, frequencyHz: frequencyFromMidi(60), confidence: 0.9 },
      { timestampMs: 1020, frequencyHz: frequencyFromMidi(60), confidence: 0.9 },
      { timestampMs: 1040, frequencyHz: frequencyFromMidi(61), confidence: 0.9 },
      { timestampMs: 1080, frequencyHz: frequencyFromMidi(61), confidence: 0.9 },
      { timestampMs: 1120, frequencyHz: frequencyFromMidi(62), confidence: 0.9 },
    ]

    expect(pianoPlaybackEvents(samples)).toEqual([
      { midi: 60, startMs: 0, durationMs: 40 },
      { midi: 61, startMs: 40, durationMs: 80 },
      { midi: 62, startMs: 120, durationMs: 50 },
    ])
  })

  it('removes an isolated target-note glitch but keeps the surrounding tune', () => {
    const samples = [
      { timestampMs: 1000, frequencyHz: frequencyFromMidi(60), confidence: 0.9 },
      { timestampMs: 1020, frequencyHz: frequencyFromMidi(60), confidence: 0.9 },
      { timestampMs: 1040, frequencyHz: frequencyFromMidi(61), confidence: 0.9 },
      { timestampMs: 1060, frequencyHz: frequencyFromMidi(60), confidence: 0.9 },
      { timestampMs: 1080, frequencyHz: frequencyFromMidi(60), confidence: 0.9 },
      { timestampMs: 1120, frequencyHz: frequencyFromMidi(62), confidence: 0.9 },
      { timestampMs: 1200, frequencyHz: frequencyFromMidi(62), confidence: 0.9 },
    ]

    expect(pianoPlaybackEvents(samples)).toEqual([
      { midi: 60, startMs: 0, durationMs: 120 },
      { midi: 62, startMs: 120, durationMs: 130 },
    ])
  })

  it('preserves rests by segmenting note offsets across long detection gaps', () => {
    const samples = [
      { timestampMs: 1000, frequencyHz: frequencyFromMidi(60), confidence: 0.9 },
      { timestampMs: 1020, frequencyHz: frequencyFromMidi(60), confidence: 0.9 },
      { timestampMs: 1060, frequencyHz: frequencyFromMidi(61), confidence: 0.9 },
      { timestampMs: 1080, frequencyHz: frequencyFromMidi(61), confidence: 0.9 },
      { timestampMs: 1300, frequencyHz: frequencyFromMidi(62), confidence: 0.9 },
      { timestampMs: 1320, frequencyHz: frequencyFromMidi(62), confidence: 0.9 },
    ]

    expect(pianoPlaybackEvents(samples)).toEqual([
      { midi: 60, startMs: 0, durationMs: 60 },
      { midi: 61, startMs: 60, durationMs: 70 },
      { midi: 62, startMs: 300, durationMs: 70 },
    ])
  })

  it('smooths a sub-frame pitch boundary blip instead of replaying it as a piano attack', () => {
    const samples = [
      { timestampMs: 0, frequencyHz: frequencyFromMidi(60), confidence: 0.9 },
      { timestampMs: 20, frequencyHz: frequencyFromMidi(61), confidence: 0.9 },
      { timestampMs: 40, frequencyHz: frequencyFromMidi(60), confidence: 0.9 },
    ]

    expect(pianoPlaybackEvents(samples)).toEqual([{ midi: 60, startMs: 0, durationMs: 90 }])
  })
})

describe('offline singing fixtures', () => {
  it('converts a real singing WAV through the same frame acceptance path as the microphone', () => {
    const samples = recordingDataFromFixture('buggly-melody.wav')
    expect(samples.length).toBeGreaterThan(100)
    expect(Math.max(...samples.map((sample) => sample.frequencyHz)) - Math.min(...samples.map((sample) => sample.frequencyHz))).toBeGreaterThan(40)
    expect(samples.every((sample) => sample.confidence >= 0.75)).toBe(true)
  })

  it('keeps a noisy sustained crowd vowel usable without claiming an exact note', () => {
    const samples = recordingDataFromFixture('shangusburger-crowd-f.wav')
    expect(samples.length).toBeGreaterThan(40)
    expect(samples.every((sample) => sample.frequencyHz > 65 && sample.frequencyHz < 1100)).toBe(true)
  })

  it('turns a short sung transition into multiple timestamped recording samples', () => {
    const samples = recordingDataFromFixture('buggly-transition.wav')
    expect(samples.length).toBeGreaterThan(20)
    expect(new Set(samples.map((sample) => midiFromFrequency(sample.frequencyHz))).size).toBeGreaterThan(2)
    expect(samples.at(-1)!.timestampMs).toBeGreaterThan(samples[0].timestampMs)
  })
})
