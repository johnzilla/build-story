import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { BeatWithFrames } from '../types.js'

const FADE_FRAMES = 9

export const DecisionCallout: React.FC<{ beat: BeatWithFrames }> = ({ beat }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const opacity = interpolate(
    frame,
    [0, FADE_FRAMES, durationInFrames - FADE_FRAMES, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  // Icon glyph for beat type
  const icon = beat.type === 'obstacle' ? '\u26A0' : beat.type === 'pivot' ? '\u21BB' : '\u2714'

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e', opacity, padding: 80 }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: '100%',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 24,
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#e94560',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: 28,
            marginRight: 20,
          }}>
            {icon}
          </div>
          <p style={{
            color: '#e94560',
            fontSize: 20,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 2,
            margin: 0,
          }}>
            {beat.type.replace('_', ' ')}
          </p>
        </div>
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
          opacity: 0.9,
        }}>
          {beat.summary}
        </p>
        {/* Left accent bar */}
        <div style={{
          position: 'absolute',
          left: 40,
          top: '20%',
          width: 4,
          height: '60%',
          backgroundColor: '#e94560',
          borderRadius: 2,
        }} />
      </div>
    </AbsoluteFill>
  )
}
