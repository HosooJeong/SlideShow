import { clamp01, easings } from '@/shared/utils/easing'
import type { PlaylistItem, Slot, SwapKind } from './types'

export type PlaylistState = {
  /** 현재(들어오는) 항목 인덱스 */
  index: number
  /** 전환 중이면 나가는 항목 인덱스, 아니면 -1 */
  prev: number
  /** 전환 진행도 0..1 (전환 중이 아니면 1) */
  mix: number
  kind: SwapKind
  dir: [number, number]
}

/** 시간 t에서 플레이리스트 상태. 순수 함수 */
export function playlistAt(items: readonly PlaylistItem[], t: number): PlaylistState {
  if (items.length === 0) return { index: -1, prev: -1, mix: 1, kind: 'cut', dir: [1, 0] }
  let i = 0
  for (let k = 1; k < items.length; k++) if (t >= items[k].t0) i = k
  const cur = items[i]
  if (i === 0 || cur.duration <= 0)
    return { index: i, prev: -1, mix: 1, kind: cur.kind, dir: cur.dir }
  const raw = clamp01((t - cur.t0) / cur.duration)
  if (raw >= 1) return { index: i, prev: -1, mix: 1, kind: cur.kind, dir: cur.dir }
  // 확확 바뀌는 느낌: 빠르게 시작해 끝에서 딱 멈춘다
  const mix = cur.kind === 'cut' ? raw : easings.inOutQuint(raw)
  return { index: i, prev: i - 1, mix, kind: cur.kind, dir: cur.dir }
}

/** 항목 i가 화면에 머무는 창(켄번즈용): 전환 시작 ~ 다음 항목 전환 시작(마지막은 슬롯 끝) */
export function itemWindow(
  slot: Slot,
  i: number,
  fallbackEnd: number,
): { start: number; end: number } {
  const items = slot.playlist!
  const start = items[i].t0
  const end = i + 1 < items.length ? items[i + 1].t0 : Math.max(start + 0.5, fallbackEnd)
  return { start, end }
}

/**
 * 컴포저용: 슬롯들에 사진을 순차로 배정한다.
 * 처음엔 슬롯마다 한 장(stagger 간격으로 등장), 이후 interval마다 슬롯을 돌아가며 한 장씩 갈아끼운다.
 * 반환: 소비한 미디어 수
 */
export function scheduleSwaps(opts: {
  slots: Slot[]
  media: { id: string; width: number; height: number }[]
  from: number
  start: number
  end: number
  interval: number
  stagger: number
  swapDuration: number
  pick: (n: number) => { kind: SwapKind; dir: [number, number] }
}): number {
  const { slots, media, from, start, end, interval, stagger, swapDuration, pick } = opts
  if (media.length === 0) return 0
  let used = 0
  const take = () => {
    const m = media[(from + used) % Math.max(1, media.length)]
    used++
    return m
  }
  slots.forEach((s, i) => {
    const m = take()
    s.mediaId = m.id
    s.mediaAspect = m.width / m.height || 1
    s.playlist = [
      {
        mediaId: m.id,
        mediaAspect: s.mediaAspect,
        t0: start + i * stagger,
        duration: 0,
        kind: 'cut',
        dir: [1, 0],
      },
    ]
  })
  // 순차 교체: 첫 교체는 시작 + interval(비트 위에 놓이도록 stagger는 더하지 않음), 마지막 교체는 끝 0.6초 전에 끝나도록
  let t = start + interval
  let k = 0
  while (t + swapDuration < end - 0.6 && used < media.length) {
    const s = slots[k % slots.length]
    const m = take()
    const { kind, dir } = pick(k)
    s.playlist!.push({
      mediaId: m.id,
      mediaAspect: m.width / m.height || 1,
      t0: t,
      duration: swapDuration,
      kind,
      dir,
    })
    t += interval
    k++
  }
  return used
}
