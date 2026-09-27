export function wav(seconds = 2): Buffer {
  const samples = Math.round(seconds * 24000)
  const data = Buffer.alloc(44 + samples * 2)
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVE', 8)
  data.write('fmt ', 12); data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22)
  data.writeUInt32LE(24000, 24); data.writeUInt32LE(48000, 28)
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34)
  data.write('data', 36); data.writeUInt32LE(samples * 2, 40)
  return data
}
