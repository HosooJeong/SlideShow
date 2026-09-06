import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, MeshBasicMaterial, Vector3, type Texture } from 'three'
import { clipTime } from './clip'
import {
  createLivingPhotoMaterial,
  setLivingPhotoFog,
  setLivingPhotoSwap,
  setLivingPhotoUniforms,
} from './devices/shaders/livingPhotoMaterial'
import { itemWindow, playlistAt } from './playlist'
import type { TextureMap } from './textures'
import { appearProgress, kenburnsUv, vanishProgress } from './kenburns'
import type { RenderClock } from './clock'
import type { Devices, Slot } from './types'

const BORDER = 0.06
/** 폴라로이드: 두꺼운 흰 테두리 + 아래쪽 여백 */
const POLAROID = 0.12
const POLAROID_BOTTOM = 0.36
const tmpPos = new Vector3()
const smoothstep = (a: number, b: number, x: number) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}
/** 재생 중 이 이상 어긋나면 시크로 다시 맞춘다 */
const DRIFT = 0.25

export function SlotMesh({
  slot,
  texture,
  video,
  devices,
  clock,
  fog,
  textures,
}: {
  slot: Slot
  texture: Texture
  video?: HTMLVideoElement
  devices: Devices
  clock: RenderClock
  /** 거리 안개(스트림 무대). 카메라 거리로 사진을 배경색에 묻힌다 */
  fog?: { near: number; far: number; color: string }
  /** 플레이리스트가 있는 슬롯은 여기서 항목별 텍스처를 찾는다 */
  textures?: TextureMap
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
  const groupRef = useRef<Group>(null)
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

  useFrame((state) => {
    const t = clock.read()
    const gone = vanishProgress(slot.vanish, t)
    const progress = appearProgress(slot.appear, t) * (1 - gone)
    // 완전히 보이지 않는 슬롯은 그리지 않는다(드로우콜·정렬 문제 방지)
    if (groupRef.current) groupRef.current.visible = progress > 0.001
    if (progress <= 0.001) return
    const slotAspect = slot.w / slot.h
    if (slot.playlist && slot.playlist.length > 0 && textures) {
      // 플레이리스트: 현재 항목(B)과 나가는 항목(A). 항목별 켄번즈 창
      const st = playlistAt(slot.playlist, t)
      const cur = slot.playlist[st.index]
      const prev = st.prev >= 0 ? slot.playlist[st.prev] : cur
      const texB = textures.get(cur.mediaId) ?? texture
      const texA = textures.get(prev.mediaId) ?? texB
      const wB = itemWindow(slot, st.index, slot.kenburns.end)
      const kbB = kenburnsUv(
        { ...slot.kenburns, start: wB.start, end: wB.end },
        cur.mediaAspect,
        slotAspect,
        t,
      )
      const wA = st.prev >= 0 ? itemWindow(slot, st.prev, slot.kenburns.end) : wB
      const kbA = kenburnsUv(
        { ...slot.kenburns, start: wA.start, end: wA.end },
        prev.mediaAspect,
        slotAspect,
        t,
      )
      setLivingPhotoUniforms(material, { ...kbA, progress })
      setLivingPhotoSwap(material, {
        mapA: texA,
        mapB: texB,
        uvB: kbB,
        mix: st.prev >= 0 ? st.mix : 1,
        kind: st.kind,
        dir: st.dir,
      })
    } else {
      const kb = kenburnsUv(slot.kenburns, slot.mediaAspect, slotAspect, t)
      setLivingPhotoUniforms(material, { ...kb, progress })
    }
    let fogAmount = 0
    if (fog) {
      const d = state.camera.position.distanceTo(tmpPos.set(slot.x, slot.y, slot.z))
      fogAmount = smoothstep(fog.near, fog.far, d)
      setLivingPhotoFog(material, fogAmount, fog.color)
    }
    if (frameMat.current) {
      frameMat.current.opacity = Math.max(0, Math.min(1, (progress - 0.15) / 0.6)) * (1 - fogAmount)
    }
    if (video && slot.clip) syncVideo(video, slot, t, clock.isPlaying?.() ?? false)
  })

  return (
    <group
      ref={groupRef}
      position={[slot.x, slot.y, slot.z]}
      rotation={slot.orient ?? [0, 0, slot.rotation]}
    >
      {slot.frame === 'print' && (
        <mesh>
          <planeGeometry args={[slot.w + BORDER * 2, slot.h + BORDER * 2]} />
          <meshBasicMaterial
            ref={frameMat}
            color="#fbf7ee"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      )}
      {slot.frame === 'polaroid' && (
        <mesh position={[0, -(POLAROID_BOTTOM - POLAROID) / 2, 0]}>
          <planeGeometry args={[slot.w + POLAROID * 2, slot.h + POLAROID + POLAROID_BOTTOM]} />
          <meshBasicMaterial
            ref={frameMat}
            color="#ffffff"
            transparent
            opacity={0}
            depthWrite={false}
          />
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
