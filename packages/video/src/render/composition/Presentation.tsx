import React from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import type { CaptionCue } from '../../captions.js'
import { FitText } from './FitText.js'
import './fonts.css'

export const Presentation: React.FC<{ chapter: string; captions: CaptionCue[]; startFrame: number; children: React.ReactNode }> = ({ chapter, captions, startFrame, children }) => {
  const frame = useCurrentFrame() + startFrame
  const caption = captions.find(cue => frame >= cue.startFrame && frame < cue.endFrame)
  return <AbsoluteFill className="buildstory-presentation" style={{ background: '#111925' }}>
    <div style={{ position: 'absolute', top: 16, left: 88, right: 88, color: '#9fadc2' }}><FitText text={chapter} size={22} minSize={18} height={32} /></div>
    <AbsoluteFill style={{ top: 56, bottom: 150, height: 'auto' }}>{children}</AbsoluteFill>
    {caption && <div style={{ position: 'absolute', bottom: 28, left: 160, right: 160, padding: '12px 28px', background: '#050910', color: '#fff', borderRadius: 12 }}><FitText key={caption.startFrame} text={caption.text} size={34} minSize={26} height={96} style={{ textAlign: 'center' }} /></div>}
  </AbsoluteFill>
}
