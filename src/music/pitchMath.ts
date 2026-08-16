export const A4_MIDI = 69
export const A4_HZ = 440
export const midiFromFrequency = (frequencyHz: number) => Math.round(12 * Math.log2(frequencyHz / A4_HZ) + A4_MIDI)
export const frequencyFromMidi = (midi: number) => A4_HZ * 2 ** ((midi - A4_MIDI) / 12)
export const continuousMidiFromFrequency = (frequencyHz: number) => 12 * Math.log2(frequencyHz / A4_HZ) + A4_MIDI
export const centsFromTarget = (frequencyHz: number, midi: number) => (continuousMidiFromFrequency(frequencyHz) - midi) * 100
export const correctionAngle = (cents: number) => {
  const deadZone = 4
  if (Math.abs(cents) <= deadZone) return 0
  return Math.max(-28, Math.min(28, -cents * 0.22))
}
