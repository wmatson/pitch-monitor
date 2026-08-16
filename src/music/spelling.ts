export type Accidental = 'flat' | 'natural' | 'sharp'
export type Letter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export type KeySignature = { id: string; vexKey: string; count: number; direction: 'sharp' | 'flat' | 'natural'; tonicPc: number; altered: Record<Letter, number>; prefer: 'sharp' | 'flat' }
export type WrittenPitch = { letter: Letter; accidental: Accidental; octave: number }
export type NotatedPitch = { written: WrittenPitch; isChromatic: boolean }
const letters: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const naturalPc: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const sharpKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
const flatKeys = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
const sharpOrder: Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const flatOrder: Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']
const parseKey = (id: string, count: number, direction: 'sharp' | 'flat' | 'natural'): KeySignature => {
  const altered = Object.fromEntries(letters.map((l) => [l, 0])) as Record<Letter, number>
  const order = direction === 'sharp' ? sharpOrder : flatOrder
  for (let i = 0; i < count; i++) altered[order[i]] = direction === 'sharp' ? 1 : -1
  const tonicPc = ({ C: 0, G: 7, D: 2, A: 9, E: 4, B: 11, 'F#': 6, 'C#': 1, F: 5, Bb: 10, Eb: 3, Ab: 8, Db: 1, Gb: 6, Cb: 11 } as Record<string, number>)[id]
  return { id, vexKey: id, count, direction, tonicPc, altered, prefer: direction === 'flat' ? 'flat' : 'sharp' }
}
export const KEY_SIGNATURES = [
  ...sharpKeys.map((id, count) => parseKey(id, count, count ? 'sharp' : 'natural')),
  ...flatKeys.slice(1).map((id, i) => parseKey(id, i + 1, 'flat')),
]
export const keyAt = (index: number, direction: 'sharp' | 'flat') => direction === 'sharp' ? KEY_SIGNATURES[index] : index === 0 ? KEY_SIGNATURES[0] : KEY_SIGNATURES[8 + index - 1]
const diatonicPcs = (key: KeySignature) => {
  const scale = [0, 2, 4, 5, 7, 9, 11]
  return new Set(scale.map((offset) => (key.tonicPc + offset) % 12))
}
export const isDiatonicMidi = (midi: number, key: KeySignature) => diatonicPcs(key).has(((midi % 12) + 12) % 12)
const chromaticNames: Record<number, { sharp: Letter; flat: Letter }> = {
  1: { sharp: 'C', flat: 'D' }, 3: { sharp: 'D', flat: 'E' }, 6: { sharp: 'F', flat: 'G' }, 8: { sharp: 'G', flat: 'A' }, 10: { sharp: 'A', flat: 'B' },
}
export const notationForMidi = (midi: number, key: KeySignature): NotatedPitch => {
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  const candidates = letters.map((letter) => ({ letter, delta: ((pc - naturalPc[letter] + 6) % 12) - 6 }))
  const diatonic = candidates.find(({ letter, delta }) => delta === key.altered[letter])
  if (diatonic) return { written: { letter: diatonic.letter, accidental: key.altered[diatonic.letter] > 0 ? 'sharp' : key.altered[diatonic.letter] < 0 ? 'flat' : 'natural', octave }, isChromatic: false }
  const accidental = chromaticNames[pc]
  if (accidental) {
    const letter = key.prefer === 'flat' ? accidental.flat : accidental.sharp
    const alteration = key.altered[letter]
    const needed = pc - naturalPc[letter]
    return { written: { letter, accidental: needed === 0 && alteration !== 0 ? 'natural' : needed < 0 ? 'flat' : 'sharp', octave }, isChromatic: true }
  }
  const natural = letters.find((letter) => naturalPc[letter] === pc)!
  return { written: { letter: natural, accidental: key.altered[natural] ? 'natural' : 'natural', octave }, isChromatic: !isDiatonicMidi(midi, key) }
}
export const accidentalGlyph = (a: Accidental) => a === 'sharp' ? '♯' : a === 'flat' ? '♭' : '♮'
