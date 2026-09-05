import { useEffect, useState } from 'react'
import { SRGBColorSpace, Texture, TextureLoader } from 'three'
import { getBlob } from '@/features/media/db'
import type { MediaItem } from '@/features/media/types'

export type TextureMap = Map<string, Texture>

/**
 * 컴포지션에 필요한 미디어 텍스처를 IndexedDB에서 읽어 만든다.
 * 이미지는 표시용 Blob, 영상은 (아직) 썸네일을 포스터로 쓴다. 언마운트 시 모두 정리.
 */
export function useMediaTextures(items: MediaItem[]): { textures: TextureMap; loading: boolean } {
  const [state, setState] = useState<{ textures: TextureMap; loading: boolean }>({
    textures: new Map(),
    loading: true,
  })
  const key = items.map((m) => m.id).join('|')

  useEffect(() => {
    let cancelled = false
    const created: Texture[] = []
    const urls: string[] = []
    const loader = new TextureLoader()
    setState((s) => ({ ...s, loading: true }))

    ;(async () => {
      const entries = await Promise.all(
        items.map(async (item) => {
          const blob = await getBlob(item.kind === 'image' ? item.blobKey : item.thumbKey)
          if (!blob) return null
          const url = URL.createObjectURL(blob)
          urls.push(url)
          const texture = await loader.loadAsync(url)
          texture.colorSpace = SRGBColorSpace
          texture.anisotropy = 8
          created.push(texture)
          return [item.id, texture] as const
        }),
      )
      if (cancelled) return
      const textures: TextureMap = new Map()
      for (const e of entries) if (e) textures.set(e[0], e[1])
      setState({ textures, loading: false })
    })()

    return () => {
      cancelled = true
      created.forEach((t) => t.dispose())
      urls.forEach(URL.revokeObjectURL)
    }
    // items 배열 자체가 아니라 id 목록이 바뀔 때만 다시 로드
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}
