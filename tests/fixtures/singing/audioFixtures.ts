import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PitchDetector } from 'pitchy'
import { analyzePitchFrame, isReliablePitch } from '../../../src/recording/microphone'
import type { RawSample } from '../../../src/recording/trace'

type WavData = { sampleRate: number; samples: Float32Array }

const fixtureRoot = resolve(import.meta.dirname, '.')

const readPcm16Wav = (fileName: string): WavData => {
  const bytes = readFileSync(resolve(fixtureRoot, 'normalized', fileName))
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`Unsupported WAV: ${fileName}`)
  const sampleRate = bytes.readUInt32LE(24)
  const bitsPerSample = bytes.readUInt16LE(34)
  const dataOffset = bytes.indexOf('data', 36, 'ascii')
  if (bitsPerSample !== 16 || dataOffset < 0) throw new Error(`Expected PCM16 WAV: ${fileName}`)
  const dataStart = dataOffset + 8
  const samples = new Float32Array((bytes.length - dataStart) / 2)
  for (let index = 0; index < samples.length; index += 1) samples[index] = bytes.readInt16LE(dataStart + index * 2) / 32768
  return { sampleRate, samples }
}

export const recordingDataFromFixture = (fileName: string): RawSample[] => {
  const { sampleRate, samples } = readPcm16Wav(fileName)
  const detector = PitchDetector.forFloat32Array(2048)
  const buffer = new Float32Array(detector.inputLength)
  const recording: RawSample[] = []
  for (let offset = 0; offset + buffer.length <= samples.length; offset += 512) {
    buffer.set(samples.subarray(offset, offset + buffer.length))
    const frame = analyzePitchFrame(detector, buffer, sampleRate)
    if (isReliablePitch(frame)) recording.push({ timestampMs: offset / sampleRate * 1000, frequencyHz: frame.pitch, confidence: frame.clarity })
  }
  return recording
}
