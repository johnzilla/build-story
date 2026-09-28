import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { BeatWithFrames } from '../types.js'

export const TitleCard: React.FC<{ beat: BeatWithFrames; isClosing: boolean }> = ({ beat, isClosing }) => {
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
    <AbsoluteFill style={{
      backgroundColor: '#1a1a2e',
      opacity,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 80,
    }}>
      <h1 style={{
        color: '#eaeaea',
        fontSize: isClosing ? 48 : 64,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        fontWeight: 700,
        textAlign: 'center',
        margin: 0,
        lineHeight: 1.2,
      }}>
        {beat.title}
      </h1>
      {!isClosing && (
        <p style={{
          color: '#e94560',
          fontSize: 28,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontWeight: 400,
          marginTop: 24,
          textAlign: 'center',
        }}>
          {beat.displayText ?? beat.summary}
        </p>
      )}
      {isClosing && (
        <p style={{
          color: '#eaeaea',
          fontSize: 24,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontWeight: 300,
          marginTop: 24,
          opacity: 0.7,
        }}>
          {beat.displayText ?? beat.summary}
        </p>
      )}
    </AbsoluteFill>
  )
}
