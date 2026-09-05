import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshBasicMaterial, type Texture } from 'three'
import { clipTime } from './clip'
import {
  createLivingPhotoMaterial,
  setLivingPhotoUniforms,
} from './devices/shaders/livingPhotoMaterial'
import { appearProgress, kenburnsUv } from './kenburns'
import type { RenderClock } from './clock'
import type { Devices, Slot } from './types'

const BORDER = 0.06
/** 재생 중 이 이상 어긋나면 시크로 다시 맞춘다 */
const DRIFT = 0.25

export function SlotMesh({
  slot,
  texture,
  video,
  devices,
  clock,
}: {
  slot: Slot
  texture: Texture
  video?: HTMLVideoElement
  devices: Devices
  clock: RenderClock
}) {
  const material = useMemo(
    () =>
      createLivingPhotoMaterial(
        texture,
        slot.w / slot.h,
        devices.halftone.params,
        devices.halftone.strength,
        { ...devices.ink, seed: slot.inkSeed },
      ),
    [texture, slot.w, slot.h, slot.inkSeed, devices.halftone, devices.ink],
  )
  useEffect(() => () => material.dispose(), [material])

  const frameMat = useRef<MeshBasicMaterial>(null)
  const invalidate = useThree((s) => s.invalidate)

  // 영상: 시크가 끝나면 프레임을 다시 그린다(스크럽 모드에서 새 프레임 반영)
  useEffect(() => {
    if (!video) return
    const onSeeked = () => invalidate()
    video.addEventListener('seeked', onSeeked)
    return () => {
      video.removeEventListener('seeked', onSeeked)
      video.pause()
    }
  }, [video, invalidate])

  useFrame(() => {
    const t = clock.read()
    const progress = appearProgress(slot.appear, t)
    const kb = kenburnsUv(slot.kenburns, slot.mediaAspect, slot.w / slot.h, t)
    setLivingPhotoUniforms(material, { ...kb, progress })
    if (frameMat.current) {
      frameMat.current.opacity = Math.max(0, Math.min(1, (progress - 0.15) / 0.6))
    }
    if (video && slot.clip) syncVideo(video, slot, t, clock.isPlaying?.() ?? false)
  })

  return (
    <group position={[slot.x, slot.y, slot.z]} rotation={[0, 0, slot.rotation]}>
      {slot.frame === 'print' && (
        <mesh>
          <planeGeometry args={[slot.w + BORDER * 2, slot.h + BORDER * 2]} />
          <meshBasicMaterial ref={frameMat} color="#fbf7ee" transparent opacity={0} />
        </mesh>
      )}
      <mesh position={[0, 0, 0.003]} material={material}>
        <planeGeometry args={[slot.w, slot.h]} />
      </mesh>
    </group>
  )
}

/**
 * 영상 요소를 t에 맞춘다.
 * - 재생 중 + 창 안: 자연 재생시키고 드리프트가 크면 시크
 * - 그 외(스크럽·창 밖·내보내기): 정지 후 정확한 위치로 시크
 */
function syncVideo(video: HTMLVideoElement, slot: Slot, t: number, playing: boolean) {
  const { videoTime, active } = clipTime(slot, t)
  const clip = slot.clip!
  const wantSound = clip.volume > 0 && active && playing
  if (video.muted === wantSound) video.muted = !wantSound
  if (wantSound) video.volume = clip.volume

  if (playing && active) {
    if (Math.abs(video.currentTime - videoTime) > DRIFT) video.currentTime = videoTime
    if (video.paused) void video.play().catch(() => {})
    return
  }
  if (!video.paused) video.pause()
  if (Math.abs(video.currentTime - videoTime) > 0.04 && !video.seeking)
    video.currentTime = videoTime
}
