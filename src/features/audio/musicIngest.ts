import { putBlob } from '@/features/media/db'
import type { ProjectMusic } from '@/features/media/types'
import { analyzeBeats } from './beats'

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|flac)$/i

export function isAudioFile(file: { type: string; name: string }) {
  return file.type.startsWith('audio/') || AUDIO_EXT.test(file.name)
}

/** 음악 파일을 저장하고 길이를 읽어 ProjectMusic을 만든다 */
export async function ingestMusic(file: File): Promise<ProjectMusic> {
  const duration = await readDuration(file)
  const blobKey = `music/${crypto.randomUUID()}`
  await putBlob(blobKey, file)
  let beats: ProjectMusic['beats']
  try {
    beats = await analyzeBeats(file)
  } catch {
    beats = undefined
  }
  const usable = !!beats && beats.bpm > 0 && beats.confidence >= 0.15
  return {
    blobKey,
    name: file.name,
    duration,
    volume: 0.8,
    fadeIn: 1.5,
    fadeOut: 3,
    fitDuration: true,
    beats,
    syncBeats: usable,
  }
}

function readDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.src = url
    const done = (v: number) => {
      URL.revokeObjectURL(url)
      resolve(v)
    }
    audio.addEventListener(
      'loadedmetadata',
      () => done(Number.isFinite(audio.duration) ? audio.duration : 0),
      {
        once: true,
      },
    )
    audio.addEventListener(
      'error',
      () => {
        URL.revokeObjectURL(url)
        reject(new Error('음악 파일을 읽을 수 없어요'))
      },
      { once: true },
    )
  })
}
