import { CatmullRomCurve3, Vector3 } from 'three'
import type { CameraKey } from '@/features/renderer/camera/cameraPath'
import { planClip } from '@/features/renderer/clip'
import { halftoneDefaults } from '@/features/renderer/devices/shaders/halftoneMaterial'
import { inkRevealDefaults } from '@/features/renderer/devices/shaders/inkRevealMaterial'
import type { Composition, Slot, StreamStage } from '@/features/renderer/types'
import { clamp01, easings } from '@/shared/utils/easing'
import { createRng } from '@/shared/utils/seededRandom'
import { distanceForHeight, FOV } from './composePaper'
import { phaseDelay, quantizeTimings, type BeatOpts } from './beatSync'
import { PACE_SCALE, paletteFor } from '@/features/themes/palette'
import type { Project } from '@/features/media/types'
import type { ComposeMedia } from './composePaper'

export type StreamOptions = {
  seed: number
  aspect: '16:9' | '9:16' | '1:1'
  dwell?: number
  travel?: number
  clips?: { maxSeconds: number; volume: number }
  beat?: BeatOpts
  theme?: Project['theme']
  pace?: Project['pace']
}

const SPACING = 5.2 // 사진 사이 경로 거리
const SAMPLE_DT = 1 / 24 // 카메라 키 샘플 간격

/**
 * 연속 스트림 컴포저(마블 인트로 느낌). 사진마다 "정면 뷰 포즈"를 만들고, 그 포즈들을 잇는 스플라인을 카메라가 탄다.
 * 사진 앞에서 dwell초 머물고 travel초에 다음으로 넘어간다(중간이 빠른 inOutQuint). 컷마다 화이트 플래시.
 */
export function composeStream(media: ComposeMedia[], opts: StreamOptions): Composition {
  const rng = createRng(opts.seed)
  const pace = PACE_SCALE[opts.pace ?? 'normal']
  const palette = paletteFor(opts.theme)
  const travel = (opts.travel ?? 1.3) * Math.sqrt(pace)
  const baseDwell = (opts.dwell ?? 2.3) * pace
  const dwell = opts.beat
    ? quantizeTimings({ dwell: baseDwell, travel }, 60 / opts.beat.period).dwell
    : baseDwell
  const n = media.length

  // 경로: z 방향으로 나아가며 완만하게 굽이치는 3D 곡선
  const pathPoint = (i: number) =>
    new Vector3(
      Math.sin(i * 0.9) * 2.6 + Math.sin(i * 0.37) * 1.2,
      Math.cos(i * 0.7) * 1.5,
      -i * SPACING,
    )

  // 사진 배치: 경로 옆(좌/우/위 번갈아)으로 밀어내고 카메라 쪽을 향하게
  const slots: Slot[] = media.map((m, i) => {
    const p = pathPoint(i)
    const side = i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : 0
    const lateral = side === 0 ? 0 : side * rng.range(1.6, 2.4)
    const vertical = side === 0 ? rng.range(1.2, 1.8) * (i % 2 ? 1 : -1) : rng.range(-0.5, 0.5)
    const mediaAspect = m.width / m.height || 1
    const slotAspect = Math.min(1.7, Math.max(0.6, mediaAspect))
    const longest = rng.range(2.4, 3.1)
    const w = slotAspect >= 1 ? longest : longest * slotAspect
    const h = slotAspect >= 1 ? longest / slotAspect : longest
    const zoomIn = rng.next() < 0.5
    const a = rng.range(1.0, 1.05)
    const b = rng.range(1.12, 1.2)
    const pan = () => [rng.range(-0.05, 0.05), rng.range(-0.03, 0.03)] as [number, number]
    return {
      id: `stream-${i}`,
      mediaId: m.id,
      mediaAspect,
      x: p.x + lateral,
      y: p.y + vertical,
      z: p.z,
      w,
      h,
      rotation: 0,
      // 카메라(더 큰 z, +z 쪽)를 향하도록 살짝 안쪽으로 돌리고, 기울임
      orient: [
        (rng.range(-6, 6) * Math.PI) / 180,
        (-side * rng.range(12, 22) * Math.PI) / 180,
        (rng.range(-7, 7) * Math.PI) / 180,
      ],
      frame: 'print',
      kenburns: {
        start: 0,
        end: 0,
        zoomFrom: zoomIn ? a : b,
        zoomTo: zoomIn ? b : a,
        panFrom: pan(),
        panTo: pan(),
      },
      appear: { kind: 'none', t0: 0, duration: 0 },
      inkSeed: rng.int(1, 999),
    }
  })

  // 각 사진의 정면 뷰 포즈: 사진 법선 방향으로 approach만큼 떨어진 곳
  const viewPoses = slots.map((s) => {
    const approach = distanceForHeight(s.h, 0.66)
    const yaw = s.orient![1]
    const pitch = s.orient![0]
    // 법선 = Rz Ry Rx * (0,0,1) 근사: yaw/pitch만 반영
    const nx = Math.sin(yaw) * Math.cos(pitch)
    const ny = -Math.sin(pitch)
    const nz = Math.cos(yaw) * Math.cos(pitch)
    return {
      pos: new Vector3(s.x + nx * approach, s.y + ny * approach, s.z + nz * approach),
      look: new Vector3(s.x, s.y, s.z),
      roll: s.orient![2] * 0.4,
    }
  })

  // 오프닝: 첫 사진 훨씬 뒤(카메라 쪽)에서 시작. 엔딩: 마지막 사진을 지나 어둠 속으로
  const startPos =
    n > 0 ? viewPoses[0].pos.clone().add(new Vector3(0, 0.6, 9)) : new Vector3(0, 0, 10)
  const endPos =
    n > 0 ? viewPoses[n - 1].pos.clone().add(new Vector3(0, -0.4, -5)) : new Vector3(0, 0, -10)
  const curvePts = [startPos, ...viewPoses.map((v) => v.pos), endPos]
  const curve = new CatmullRomCurve3(curvePts, false, 'centripetal', 0.6)

  // 시간 → 곡선 파라미터. 구간 i: 정점 i에서 i+1로 travel초, 정점 도착 후 dwell초 머무름
  const opening = 1.6 + phaseDelay(1.6, opts.beat)
  const markers: number[] = []
  const keys: CameraKey[] = []
  const flashes: StreamStage['flashes'] = []
  const segments = curvePts.length - 1
  const segTimes: { t0: number; t1: number }[] = [] // 구간별 이동 시간 창
  let t = 0
  for (let i = 0; i < segments; i++) {
    const dur = i === 0 ? opening : i === segments - 1 ? travel * 1.6 : travel
    segTimes.push({ t0: t, t1: t + dur })
    t += dur
    if (i < segments - 1) {
      // 정점 i+1(사진 i) 도착 → dwell
      const arrive = t
      markers.push(arrive)
      slots[i].kenburns.start = arrive - dur
      slots[i].kenburns.end = arrive + dwell + travel
      const m = media[i]
      if (m.kind === 'video') {
        slots[i].clip = planClip({
          sourceDuration: m.duration ?? 0,
          windowDuration: slots[i].kenburns.end - slots[i].kenburns.start,
          maxSeconds: opts.clips?.maxSeconds ?? 4,
          volume: opts.clips?.volume ?? 0,
        })
      }
      if (i % 2 === 1) flashes.push({ t: arrive - 0.08, duration: 0.32, strength: 0.55 })
      t += dwell
    }
  }
  const duration = t + 0.6
  flashes.push({ t: 0, duration: 0.5, strength: 0.9 })

  // 카메라 키 샘플링(선형 이징, 촘촘하게)
  const tmp = new Vector3()
  const lookTmp = new Vector3()
  for (let tk = 0; tk <= duration + 1e-6; tk += SAMPLE_DT) {
    const tt = Math.min(tk, duration)
    // 곡선 파라미터
    let u: number
    let lookAt: Vector3
    let roll = 0
    let seg = segments - 1
    let inTravel = false
    for (let i = 0; i < segments; i++) {
      const st = segTimes[i]
      const dwellEnd = i < segments - 1 ? st.t1 + dwell : st.t1
      if (tt <= dwellEnd) {
        seg = i
        inTravel = tt < st.t1
        break
      }
    }
    const st = segTimes[seg]
    const frac = inTravel ? easings.inOutQuint(clamp01((tt - st.t0) / (st.t1 - st.t0))) : 1
    u = (seg + frac) / segments
    // 마지막 구간 이후는 끝점 고정
    if (tt >= segTimes[segments - 1].t1) u = 1
    curve.getPoint(clamp01(u), tmp)

    // 바라보는 곳: 이동 중엔 이전 사진 → 다음 사진으로 넘어가고, 머무는 동안 사진을 응시
    const prevLook = seg - 1 >= 0 && seg - 1 < n ? viewPoses[seg - 1].look : null
    const nextLook = seg < n ? viewPoses[seg].look : null
    if (nextLook && prevLook) {
      const k = easings.inOutCubic(frac)
      lookTmp.copy(prevLook).lerp(nextLook, k)
      roll = viewPoses[seg - 1].roll * (1 - k) + viewPoses[seg].roll * k
    } else if (nextLook) {
      lookTmp.copy(nextLook)
      roll = viewPoses[seg].roll * frac
    } else if (prevLook) {
      // 엔딩: 마지막 사진에서 시선을 앞(어둠)으로
      const ahead = curve.getPoint(1).add(new Vector3(0, 0, -6))
      lookTmp.copy(prevLook).lerp(ahead, frac)
      roll = viewPoses[seg - 1].roll * (1 - frac)
    } else {
      lookTmp.set(0, 0, -10)
    }
    lookAt = lookTmp
    keys.push({
      t: tt,
      x: tmp.x,
      y: tmp.y,
      z: tmp.z,
      lookX: lookAt.x,
      lookY: lookAt.y,
      lookZ: lookAt.z,
      roll,
      ease: 'linear',
    })
  }
  if (keys.length === 0 || keys[keys.length - 1].t < duration) {
    const last = keys[keys.length - 1]
    keys.push({ ...last, t: duration })
  }

  const center: [number, number, number] = [0, 0, (-(n - 1) * SPACING) / 2]
  return {
    version: 1,
    seed: opts.seed,
    stage: {
      kind: 'stream',
      background: palette.stream.background,
      fog: { near: 6, far: 26 },
      flashes,
      dust: {
        count: 900,
        seed: opts.seed % 1000,
        radius: 7,
        length: n * SPACING + 30,
        center,
        colors: palette.stream.dust,
      },
    },
    slots,
    camera: keys,
    fov: FOV,
    duration,
    markers,
    devices: {
      film: { grain: 0.22, vignette: 0.6, vignetteOffset: 0.2 },
      dof: { enabled: true, focusRange: 2.2, bokehScale: 3 },
      halftone: { params: halftoneDefaults, strength: 0 },
      ink: inkRevealDefaults,
    },
  }
}
