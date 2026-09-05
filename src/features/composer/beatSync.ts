import { quantizeTimings } from '@/features/audio/beats'

export type BeatOpts = { period: number; phase: number }

/** 비트 옵션을 만든다. 신뢰도가 낮거나 꺼져 있으면 undefined */
export function beatOptsFrom(
  music:
    | { beats?: { bpm: number; beats: number[]; confidence: number }; syncBeats?: boolean }
    | undefined,
): BeatOpts | undefined {
  if (!music?.syncBeats || !music.beats || music.beats.bpm <= 0 || music.beats.confidence < 0.15)
    return undefined
  const period = 60 / music.beats.bpm
  const first = music.beats.beats[0] ?? 0
  return { period, phase: ((first % period) + period) % period }
}

/** x를 비트 주기의 정수배로(최소 1비트) */
export function quantizeToBeat(x: number, beat: BeatOpts | undefined) {
  if (!beat) return x
  return Math.max(beat.period, Math.round(x / beat.period) * beat.period)
}

/** 첫 도착 시각 a가 비트 위상에 맞도록 앞에 더할 지연(0 ≤ delta < period) */
export function phaseDelay(a: number, beat: BeatOpts | undefined) {
  if (!beat) return 0
  const r = (((beat.phase - a) % beat.period) + beat.period) % beat.period
  return r < 1e-9 ? 0 : r
}

export { quantizeTimings }
