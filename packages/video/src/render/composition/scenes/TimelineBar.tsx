import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { BeatWithFrames } from '../types.js'

const FADE_FRAMES = 9

export const TimelineBar: React.FC<{ beat: BeatWithFrames }> = ({ beat }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const opacity = interpolate(
    frame,
    [0, FADE_FRAMES, durationInFrames - FADE_FRAMES, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  // D-07: Timeline bar fills left-to-right
  const barWidth = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e', opacity, padding: 80 }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
        <p style={{
          color: '#e94560',
          fontSize: 20,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 2,
          margin: 0,
          marginBottom: 16,
        }}>
          {beat.type.replace('_', ' ')}
        </p>
        <h2 style={{
          color: '#eaeaea',
          fontSize: 48,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontWeight: 700,
          margin: 0,
          marginBottom: 24,
          lineHeight: 1.2,
        }}>
          {beat.title}
        </h2>
        <p style={{
          color: '#eaeaea',
          fontSize: 28,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontWeight: 300,
          lineHeight: 1.6,
          margin: 0,
          marginBottom: 40,
          opacity: 0.9,
        }}>
          {beat.summary}
        </p>
        {/* Timeline progress bar */}
        <div style={{ width: '100%', height: 6, backgroundColor: 'rgba(234, 234, 234, 0.15)', borderRadius: 3 }}>
          <div style={{
            width: `${barWidth}%`,
            height: '100%',
            backgroundColor: '#e94560',
            borderRadius: 3,
          }} />
        </div>
      </div>
    </AbsoluteFill>
  )
}
