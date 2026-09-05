import { useEffect, useState } from 'react'
import { SRGBColorSpace, Texture, TextureLoader, VideoTexture } from 'three'
import { getBlob } from '@/features/media/db'
import type { MediaItem } from '@/features/media/types'

export type TextureMap = Map<string, Texture>
export type VideoMap = Map<string, HTMLVideoElement>

/**
 * 컴포지션에 필요한 미디어 텍스처를 IndexedDB에서 읽어 만든다.
 * 이미지는 표시용 Blob → Texture, 영상은 <video> → VideoTexture. 언마운트 시 모두 정리.
 */
export function useMediaTextures(items: MediaItem[]): {
  textures: TextureMap
  videos: VideoMap
  loading: boolean
} {
  const [state, setState] = useState<{ textures: TextureMap; videos: VideoMap; loading: boolean }>({
    textures: new Map(),
    videos: new Map(),
    loading: true,
  })
  const key = items.map((m) => m.id).join('|')

  useEffect(() => {
    let cancelled = false
    const created: Texture[] = []
    const urls: string[] = []
    const videoEls: HTMLVideoElement[] = []
    const loader = new TextureLoader()
    setState((s) => ({ ...s, loading: true }))

    ;(async () => {
      const entries = await Promise.all(
        items.map(async (item) => {
          const blob = await getBlob(item.blobKey)
          if (!blob) return null
          const url = URL.createObjectURL(blob)
          urls.push(url)
          if (item.kind === 'video') {
            const video = await loadVideo(url)
            videoEls.push(video)
            const texture = new VideoTexture(video)
            texture.colorSpace = SRGBColorSpace
            created.push(texture)
            return [item.id, texture, video] as const
          }
          const texture = await loader.loadAsync(url)
          texture.colorSpace = SRGBColorSpace
          texture.anisotropy = 8
          created.push(texture)
          return [item.id, texture, null] as const
        }),
      )
      if (cancelled) return
      const textures: TextureMap = new Map()
      const videos: VideoMap = new Map()
      for (const e of entries) {
        if (!e) continue
        textures.set(e[0], e[1])
        if (e[2]) videos.set(e[0], e[2])
      }
      setState({ textures, videos, loading: false })
      // 디버그·e2e용: DOM에 붙지 않는 video 요소를 밖에서 확인할 수 있게 한다
      ;(globalThis as { __slideshowVideos?: VideoMap }).__slideshowVideos = videos
    })()

    return () => {
      cancelled = true
      created.forEach((t) => t.dispose())
      videoEls.forEach((v) => {
        v.pause()
        v.removeAttribute('src')
        v.load()
      })
      urls.forEach(URL.revokeObjectURL)
    }
    // items 배열 자체가 아니라 id 목록이 바뀔 때만 다시 로드
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}

function loadVideo(url: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    video.src = url
    video.addEventListener('loadeddata', () => resolve(video), { once: true })
    video.addEventListener('error', () => reject(new Error('영상을 읽을 수 없어요')), {
      once: true,
    })
  })
}
