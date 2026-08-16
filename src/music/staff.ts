import type { Letter, WrittenPitch } from './spelling'
const order: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const indexOf = (p: WrittenPitch) => p.octave * 7 + order.indexOf(p.letter)
const anchors = { treble: { letter: 'B' as Letter, accidental: 'natural' as const, octave: 4 }, bass: { letter: 'D' as Letter, accidental: 'natural' as const, octave: 3 } }
export const staffPosition = (pitch: WrittenPitch, clef: 'treble' | 'bass') => indexOf(pitch) - indexOf(anchors[clef])
export const candidateFromStaff = (position: number, clef: 'treble' | 'bass'): WrittenPitch => {
  const anchor = anchors[clef]
  const absolute = indexOf(anchor) + position
  const octave = Math.floor(absolute / 7)
  return { letter: order[(absolute % 7 + 7) % 7], accidental: 'natural', octave }
}
export const staffY = (position: number, clef: 'treble' | 'bass') => (clef === 'treble' ? 92.5 : 216.5) - position * 5
export const semitoneOffsetForModifiers = (shiftKey: boolean, altKey: boolean): -1 | 0 | 1 => shiftKey === altKey ? 0 : shiftKey ? 1 : -1
export const vexKey = (pitch: WrittenPitch) => `${pitch.letter.toLowerCase()}/${pitch.octave}`
