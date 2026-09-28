import React from 'react'
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion'
import type { EvidenceVisual } from '@buildstory/core'
import type { BeatWithFrames } from '../types.js'

const titles = { quote: 'From the source', diff: 'Code change', error: 'Recorded error', architecture: 'Architecture change', comparison: 'Alternatives considered', outcome: 'Reported outcome' }
const colors = { quote: '#81c7fa', diff: '#7bdfab', error: '#ffad99', architecture: '#baa6ff', comparison: '#ffcd83', outcome: '#7bdfab' }

export const EvidenceCard: React.FC<{ beat: BeatWithFrames; visual: EvidenceVisual; citations: string[] }> = ({ beat, visual, citations }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, Math.min(9, beat.durationInFrames / 3)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const accent = colors[visual.kind]
  const code = visual.kind === 'diff' || visual.kind === 'error'
  return <AbsoluteFill style={{ background: '#111925', color: '#eff4fa', padding: '70px 88px', fontFamily: 'system-ui, sans-serif', opacity }}>
    <div style={{ color: accent, fontSize: 24, letterSpacing: 3, textTransform: 'uppercase' }}>{titles[visual.kind]}</div>
    <h1 style={{ fontSize: 52, lineHeight: 1.15, margin: '22px 0 14px', overflowWrap: 'anywhere' }}>{Array.from(beat.title).slice(0, 96).join('') + (Array.from(beat.title).length > 96 ? '…' : '')}</h1>
    {beat.displayText && <p style={{ fontSize: 28, lineHeight: 1.4, margin: '0 0 24px', color: '#b9c7da' }}>{beat.displayText}</p>}
    <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 28, alignItems: 'stretch' }}>
      {visual.panels.map((panel, index) => <div key={index} style={{ flex: 1, minWidth: 0, border: `1px solid ${accent}66`, borderTop: `4px solid ${accent}`, background: '#1a2637', borderRadius: 14, padding: 30, display: 'flex', flexDirection: 'column' }}>
        <div style={{ color: accent, fontSize: 22, textTransform: 'uppercase', marginBottom: 24 }}>{panel.label}</div>
        <div style={{ flex: 1, fontFamily: code ? 'ui-monospace, monospace' : 'system-ui, sans-serif', fontSize: code ? 22 : visual.panels.length === 2 ? 28 : 32, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {code ? panel.text.split('\n').map((line, i) => <div key={i} style={{ color: visual.kind === 'diff' && line.startsWith('+') ? '#7bdfab' : visual.kind === 'diff' && line.startsWith('-') ? '#ffad99' : '#eff4fa' }}>{line || ' '}</div>) : `“${panel.text}”`}
        </div>
        <div style={{ color: '#9fadc2', fontSize: 18, lineHeight: 1.4, marginTop: 22, overflowWrap: 'anywhere' }}>{citations[index]?.slice(0, 220)}</div>
      </div>)}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9fadc2', fontSize: 19, marginTop: 22 }}>
      <span>Source excerpt · {beat.claimBasis === 'inference' ? 'Narrative interpretation' : 'Source statements require review'}</span>
      <span>{visual.kind === 'architecture' ? 'Documented descriptions' : 'BuildStory'}</span>
    </div>
  </AbsoluteFill>
}
