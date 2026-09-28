import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import type { BeatWithFrames } from '../types.js'
import { FitText } from '../FitText.js'

export const NarrativeCard: React.FC<{ beat: BeatWithFrames; heading?: string; context?: string; closing?: boolean }> = ({ beat, heading, context, closing }) => {
  const accent = beat.type === 'obstacle' ? '#ffad99' : beat.type === 'pivot' ? '#baa6ff' : beat.type === 'decision' ? '#ffcd83' : beat.type === 'result' ? '#7bdfab' : '#81c7fa'
  const frame = useCurrentFrame()
  const fade = Math.min(9, beat.durationInFrames / 3)
  const opacity = interpolate(frame, [0, fade, beat.durationInFrames - fade, beat.durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ backgroundColor: '#111925', padding: '60px 88px', opacity, color: '#eff4fa', justifyContent: 'center' }}>
    <div style={{ color: accent, textTransform: 'uppercase', letterSpacing: 3, fontSize: 22, marginBottom: 20 }}>{heading ?? beat.type.replace('_', ' ')}</div>
    <FitText text={beat.title} size={56} minSize={32} height={150} style={{ fontWeight: 650 }} />
    <FitText text={beat.displayText ?? beat.summary} size={34} minSize={24} height={290} style={{ color: '#c7d5e7', marginTop: 16 }} />
    {context && <FitText text={context} size={26} minSize={22} height={100} style={{ color: accent, marginTop: 28 }} />}
    <div style={{ marginTop: 24, height: 4, background: '#29394e' }}><div style={{ width: `${Math.min(100, frame / Math.max(1, beat.durationInFrames - 1) * 100)}%`, height: 4, background: closing ? '#7bdfab' : accent }} /></div>
  </AbsoluteFill>
}
