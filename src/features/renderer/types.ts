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
  kind: 'ink' | 'fade' | 'none'
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
  /** 영상 클립. 켄번즈 창(start~end) 동안 재생되고, 그 밖에서는 첫 프레임에 멈춘다 */
  clip?: Clip
}

export type Clip = {
  /** 원본 영상에서의 시작 위치(초) */
  start: number
  /** 재생 길이(초). loop면 이 길이로 반복 */
  duration: number
  loop: boolean
  /** 0 = 음소거 */
  volume: number
}

export type TextBlock = {
  id: string
  text: string
  /** 박스 좌상단(무대 좌표), 크기 */
  x: number
  y: number
  w: number
  h: number
  fontSize: number
  weight: 'regular' | 'bold'
  align: 'left' | 'center' | 'right' | 'justify'
  color: string
  lineHeight: number
  letterSpacing?: number
  appear: Appear
}

/** 구분선·박스 테두리. 얇은 잉크 사각형 */
export type Rule = {
  id: string
  x: number
  y: number
  w: number
  h: number
  color: string
  appear: Appear
}

export type Page = {
  id: string
  /** 페이지 중심(무대 좌표), 크기 */
  x: number
  y: number
  w: number
  h: number
  slots: Slot[]
  texts: TextBlock[]
  rules: Rule[]
}

export type NewspaperStage = {
  kind: 'newspaper'
  pages: Page[]
  paper: PaperParams
  /** 신문이 회전하며 날아와 착지하는 오프닝 길이(초). 0이면 없음 */
  opening: { duration: number }
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
  stage: PaperStage | NewspaperStage
  /** 모든 슬롯(신문 무대는 페이지 슬롯을 평탄화한 것) */
  slots: Slot[]
  camera: CameraKey[]
  fov: number
  duration: number
  devices: Devices
}
