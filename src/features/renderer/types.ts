import type { CameraKey } from './camera/cameraPath'
import type { HalftoneParams } from './devices/shaders/halftoneMaterial'
import type { InkRevealParams } from './devices/shaders/inkRevealMaterial'
import type { PaperParams } from './devices/shaders/paperMaterial'

/** 켄번즈: 슬롯 안에서 사진이 천천히 줌/팬. 값은 [start, end] 구간에서 보간 */
export type KenBurns = {
  start: number
  end: number
  zoomFrom: number
  zoomTo: number
  /** 팬 오프셋(uv 단위, 줌 여유 안에서) */
  panFrom: [number, number]
  panTo: [number, number]
}

export type Appear = {
  kind: 'ink' | 'none'
  t0: number
  duration: number
}

export type Slot = {
  id: string
  mediaId: string
  /** 사진 원본 가로/세로 */
  mediaAspect: number
  /** 무대 좌표(중심), 크기, 회전(라디안), 쌓임 높이 */
  x: number
  y: number
  z: number
  w: number
  h: number
  rotation: number
  frame: 'print' | 'none'
  kenburns: KenBurns
  appear: Appear
  /** 잉크 번짐 시드(슬롯마다 다르게) */
  inkSeed: number
}

export type PaperStage = {
  kind: 'paper'
  width: number
  height: number
  paper: PaperParams
}

export type Devices = {
  film: { grain: number; vignette: number; vignetteOffset: number }
  dof: { enabled: boolean; focusRange: number; bokehScale: number } | null
  halftone: { params: HalftoneParams; strength: number }
  ink: InkRevealParams
}

/** 렌더러 입력. 순수 데이터(JSON 직렬화 가능). render(composition, t)의 첫 인자 */
export type Composition = {
  version: 1
  seed: number
  stage: PaperStage
  slots: Slot[]
  camera: CameraKey[]
  fov: number
  duration: number
  devices: Devices
}
