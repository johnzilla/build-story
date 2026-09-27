import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { BeatWithFrames } from '../types.js'

export const StatsCard: React.FC<{ beat: BeatWithFrames }> = ({ beat }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const fadeFrames = Math.min(9, durationInFrames / 3)

  const opacity = interpolate(
    frame,
    [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e', opacity, padding: 80 }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
      }}>
        <p style={{
          color: '#e94560',
          fontSize: 20,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 2,
          margin: 0,
          marginBottom: 24,
        }}>
          {beat.type.replace('_', ' ')}
        </p>
        <h2 style={{
          color: '#eaeaea',
          fontSize: 56,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontWeight: 700,
          textAlign: 'center',
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
          textAlign: 'center',
          margin: 0,
          opacity: 0.9,
          maxWidth: 800,
        }}>
          {beat.summary}
        </p>
      </div>
    </AbsoluteFill>
  )
}
