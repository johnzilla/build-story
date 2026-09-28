import React from 'react'
import type { BeatWithFrames } from '../types.js'
import { NarrativeCard } from './NarrativeCard.js'

export const TimelineBar: React.FC<{ beat: BeatWithFrames }> = ({ beat }) => <NarrativeCard beat={beat} />
