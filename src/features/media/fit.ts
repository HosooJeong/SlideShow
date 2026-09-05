/** 가로세로를 유지하며 긴 변이 max를 넘지 않게 맞춘 크기. 확대는 하지 않는다. */
export function fitWithin(width: number, height: number, max: number) {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** order 값을 0부터 연속으로 다시 매긴다. 원본 배열은 바꾸지 않는다. */
export function normalizeOrder<T extends { order: number }>(items: readonly T[]): T[] {
  return items.map((item, i) => (item.order === i ? item : { ...item, order: i }))
}

/** 배열에서 from 위치 항목을 to 위치로 옮긴다. 원본 배열은 바꾸지 않는다. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items.slice()
  }
  const out = items.slice()
  const [moved] = out.splice(from, 1)
  out.splice(to, 0, moved)
  return out
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp)$/i
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv)$/i

/** 파일이 이미지/영상인지 판별. 확장자 기반 폴백 포함(HEIC는 type이 비어 오는 경우가 많다). */
export function classifyFile(file: { type: string; name: string }): 'image' | 'video' | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (IMAGE_EXT.test(file.name)) return 'image'
  if (VIDEO_EXT.test(file.name)) return 'video'
  return null
}

export function isHeic(file: { type: string; name: string }) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

export function formatDuration(seconds: number) {
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
