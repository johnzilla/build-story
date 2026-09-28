import React, { useEffect, useRef, useState } from 'react'
import { cancelRender, continueRender, delayRender } from 'remotion'

/** Measure after fonts load. Fail rather than silently clip text below the readable floor. */
export const FitText: React.FC<{ text: string; size?: number; minSize?: number; height: number | string; mono?: boolean; diff?: boolean; style?: React.CSSProperties }> = ({ text, size = 32, minSize = 22, height, mono = false, diff = false, style }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [handle] = useState(() => typeof document === 'undefined' ? null : delayRender('Load font and fit text'))
  useEffect(() => {
    let stopped = false
    let settled = false
    const finish = () => { if (handle !== null && !settled) { settled = true; continueRender(handle) } }
    const fit = async () => {
      await document.fonts.load(`${size}px ${mono ? 'BuildStoryMono' : 'BuildStorySans'}`)
      if (stopped) return
      const element = ref.current!
      let pixels = size
      element.style.fontSize = `${pixels}px`
      while ((element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1) && pixels > minSize) element.style.fontSize = `${--pixels}px`
      if (element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1) {
        cancelRender(new Error('Presentation overflow: shorten displayText, title, or evidence text before rendering.'))
      } else finish()
    }
    void fit().catch(cancelRender)
    return () => { stopped = true; finish() }
  }, [text, size, minSize, mono, handle])
  return <div ref={ref} data-fit-text style={{ fontFamily: mono ? 'BuildStoryMono, monospace' : 'BuildStorySans, sans-serif', fontSize: size, height, minHeight: 0, lineHeight: 1.35, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflow: 'hidden', ...style }}>{diff ? text.split('\n').map((line, index) => <div key={index} style={{ color: line.startsWith('+') ? '#7bdfab' : line.startsWith('-') ? '#ffad99' : 'inherit' }}>{line || ' '}</div>) : text}</div>
}
