import { classifyFile, fitWithin, isHeic } from './fit'
import type { MediaItem, MediaKind } from './types'

export const DISPLAY_MAX = 2048
export const THUMB_MAX = 320

export type IngestResult = {
  item: Omit<MediaItem, 'order' | 'projectId'>
  displayBlob: Blob
  thumbBlob: Blob
}

export class UnsupportedFileError extends Error {
  readonly file: File
  constructor(file: File) {
    super(`지원하지 않는 파일: ${file.name}`)
    this.name = 'UnsupportedFileError'
    this.file = file
  }
}

/**
 * 파일 하나를 읽어 표시용 Blob·썸네일·메타데이터를 만든다.
 * 브라우저 API(createImageBitmap, <video>, canvas)를 쓰므로 브라우저에서만 동작한다.
 */
export async function ingestFile(file: File): Promise<IngestResult> {
  const kind = classifyFile(file)
  if (!kind) throw new UnsupportedFileError(file)
  return kind === 'image' ? ingestImage(file) : ingestVideo(file)
}

async function ingestImage(file: File): Promise<IngestResult> {
  const source: Blob = isHeic(file) ? await convertHeic(file) : file
  const [bitmap, takenAt] = await Promise.all([decodeImage(source), readTakenAt(file)])

  try {
    const display = fitWithin(bitmap.width, bitmap.height, DISPLAY_MAX)
    const thumb = fitWithin(bitmap.width, bitmap.height, THUMB_MAX)
    const [displayBlob, thumbBlob] = await Promise.all([
      drawToBlob(bitmap, display.width, display.height, 0.9),
      drawToBlob(bitmap, thumb.width, thumb.height, 0.8),
    ])
    return {
      item: baseItem(file, 'image', {
        width: display.width,
        height: display.height,
        takenAt,
        mimeType: displayBlob.type,
      }),
      displayBlob,
      thumbBlob,
    }
  } finally {
    bitmap.close()
  }
}

async function ingestVideo(file: File): Promise<IngestResult> {
  const url = URL.createObjectURL(file)
  try {
    const video = await loadVideo(url)
    const thumb = fitWithin(video.videoWidth, video.videoHeight, THUMB_MAX)
    const thumbBlob = await drawToBlob(video, thumb.width, thumb.height, 0.8)
    return {
      item: baseItem(file, 'video', {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Number.isFinite(video.duration) ? video.duration : undefined,
        takenAt: file.lastModified ? new Date(file.lastModified).toISOString() : undefined,
        mimeType: file.type || 'video/mp4',
      }),
      displayBlob: file,
      thumbBlob,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function baseItem(
  file: File,
  kind: MediaKind,
  extra: Pick<MediaItem, 'width' | 'height' | 'mimeType'> &
    Partial<Pick<MediaItem, 'duration' | 'takenAt'>>,
): IngestResult['item'] {
  const id = crypto.randomUUID()
  return {
    id,
    kind,
    name: file.name,
    size: file.size,
    blobKey: `${id}/display`,
    thumbKey: `${id}/thumb`,
    createdAt: Date.now(),
    ...extra,
  }
}

/** EXIF 방향을 적용해 디코드한다. 이후 픽셀은 이미 회전된 상태다. */
async function decodeImage(blob: Blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    // 일부 브라우저/포맷은 옵션을 거부한다. 옵션 없이 재시도.
    return createImageBitmap(blob)
  }
}

async function readTakenAt(file: File): Promise<string | undefined> {
  try {
    const exifr = await import('exifr')
    const data = (await exifr.parse(file, ['DateTimeOriginal', 'CreateDate'])) as
      { DateTimeOriginal?: Date; CreateDate?: Date } | undefined
    const d = data?.DateTimeOriginal ?? data?.CreateDate
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined
  } catch {
    return undefined
  }
}

async function convertHeic(file: File): Promise<Blob> {
  const { default: heic2any } = await import('heic2any')
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  return Array.isArray(out) ? out[0] : out
}

function loadVideo(url: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.src = url
    const fail = () => reject(new Error('영상을 읽을 수 없어요'))
    video.addEventListener('error', fail, { once: true })
    video.addEventListener(
      'loadedmetadata',
      () => {
        // 첫 프레임은 검은 화면인 경우가 많아 0.5초(또는 길이의 10%) 지점을 썸네일로 쓴다.
        const target = Math.min(0.5, (video.duration || 1) * 0.1)
        video.addEventListener('seeked', () => resolve(video), { once: true })
        video.currentTime = target
      },
      { once: true },
    )
  })
}

async function drawToBlob(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 만들 수 없어요')
  ctx.drawImage(source, 0, 0, width, height)
  return canvas.convertToBlob({ type: 'image/webp', quality })
}
