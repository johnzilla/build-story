import { FitText } from '../FitText.js'
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
  return <AbsoluteFill style={{ background: '#111925', color: '#eff4fa', padding: '30px 88px', fontFamily: 'BuildStorySans, sans-serif', opacity }}>
    <div style={{ color: accent, fontSize: 24, letterSpacing: 3, textTransform: 'uppercase' }}>{titles[visual.kind]}</div>
    <FitText text={beat.title} size={48} minSize={30} height={108} style={{ fontWeight: 650, marginTop: 16 }} />
    {beat.displayText && <FitText text={beat.displayText} size={28} minSize={22} height={78} style={{ color: '#b9c7da', marginBottom: 12 }} />}
    <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 28, alignItems: 'stretch' }}>
      {visual.panels.map((panel, index) => <div key={index} style={{ opacity: interpolate(frame, [index * Math.min(18, beat.durationInFrames / 4), index * Math.min(18, beat.durationInFrames / 4) + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), flex: 1, minWidth: 0, border: `1px solid ${accent}66`, borderTop: `4px solid ${accent}`, background: '#1a2637', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ color: accent, fontSize: 22, textTransform: 'uppercase', marginBottom: 24 }}>{panel.label}</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <FitText text={code ? panel.text : `“${panel.text}”`} mono={code} diff={visual.kind === 'diff'} size={code ? 24 : 30} minSize={20} height="100%" />
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
