import React from 'react'
import type { BeatWithFrames } from '../types.js'
import { NarrativeCard } from './NarrativeCard.js'

export const TitleCard: React.FC<{ beat: BeatWithFrames; isClosing: boolean; context?: string }> = ({ beat, isClosing, context }) =>
  <NarrativeCard beat={beat} heading={isClosing ? (beat.type === 'open_loop' ? 'Still unresolved' : 'Where the story stands') : 'The question behind the build'} closing={isClosing} {...(context ? { context } : {})} />
