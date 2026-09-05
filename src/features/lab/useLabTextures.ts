import { useEffect, useState } from 'react'
import { SRGBColorSpace, Texture, TextureLoader } from 'three'
import { getBlob, getMediaByProject } from '@/features/media/db'
import { useProjectStore } from '@/features/project/store'

export type LabPhoto = { texture: Texture; aspect: number; label: string }

/**
 * 실험실용 사진 텍스처. 스튜디오에 올린 사진이 있으면 그걸 쓰고, 없으면 자리표시 텍스처를 만든다.
 */
export function useLabTextures(count: number): LabPhoto[] {
  const [photos, setPhotos] = useState<LabPhoto[]>([])

  useEffect(() => {
    let cancelled = false
    const created: Texture[] = []
    const urls: string[] = []

    ;(async () => {
      const project = await useProjectStore.getState().ensure()
      const media = (await getMediaByProject(project.id)).filter((m) => m.kind === 'image')
      const loader = new TextureLoader()
      const result: LabPhoto[] = []

      for (const item of media.slice(0, count)) {
        const blob = await getBlob(item.blobKey)
        if (!blob) continue
        const url = URL.createObjectURL(blob)
        urls.push(url)
        const texture = await loader.loadAsync(url)
        texture.colorSpace = SRGBColorSpace
        created.push(texture)
        result.push({ texture, aspect: item.width / item.height, label: item.name })
      }
      for (let i = result.length; i < count; i++) {
        const texture = placeholderTexture(i)
        created.push(texture)
        result.push({ texture, aspect: i % 3 === 1 ? 3 / 4 : 4 / 3, label: `placeholder ${i + 1}` })
      }
      if (cancelled) return
      setPhotos(result)
    })()

    return () => {
      cancelled = true
      created.forEach((t) => t.dispose())
      urls.forEach(URL.revokeObjectURL)
    }
  }, [count])

  return photos
}

const PALETTE = [
  ['#f7b267', '#f4845f'],
  ['#8ecae6', '#219ebc'],
  ['#cdb4db', '#ffafcc'],
  ['#a7c957', '#6a994e'],
  ['#ffd6a5', '#fdffb6'],
  ['#bde0fe', '#a2d2ff'],
]

function placeholderTexture(i: number) {
  const w = 1024
  const h = i % 3 === 1 ? 1365 : 768
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const [c1, c2] = PALETTE[i % PALETTE.length]
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, c1)
  g.addColorStop(1, c2)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.font = `bold ${Math.round(w / 6)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(i + 1), w / 2, h / 2)
  const texture = new Texture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
