'use client'

import { useSyncExternalStore } from 'react'

const KEY = 'kodashboard:page-sound'
const EVENT = 'kodashboard:page-sound'
/** Fast flips play one rustle per this many ms, not one per page. */
const MIN_GAP_MS = 70

let ctx: AudioContext | null = null
let lastPlayed = 0

const enabled = () => localStorage.getItem(KEY) !== 'off'

export function setPageSound(on: boolean) {
  localStorage.setItem(KEY, on ? 'on' : 'off')
  window.dispatchEvent(new Event(EVENT))
}

/** Page sound preference, on by default; follows changes from other tabs. */
export function usePageSound() {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(EVENT, onChange)
      window.addEventListener('storage', onChange)
      return () => {
        window.removeEventListener(EVENT, onChange)
        window.removeEventListener('storage', onChange)
      }
    },
    enabled,
    () => true,
  )
}

/** A short paper rustle: decaying noise through a band-pass filter, no audio file. */
export function playPageTurn() {
  if (!enabled()) return
  const now = performance.now()
  if (now - lastPlayed < MIN_GAP_MS) return
  lastPlayed = now
  ctx ??= new AudioContext()
  const duration = 0.16
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2

  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1800 + Math.random() * 1600
  filter.Q.value = 0.7
  const gain = ctx.createGain()
  const t = ctx.currentTime
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.22, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start()
}
