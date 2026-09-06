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
  /** 3D 방향(오일러, 라디안). 있으면 rotation 대신 쓴다(스트림 무대) */
  orient?: [number, number, number]
  /** 사라짐(파티클 분해의 출발 사진). t0부터 duration 동안 알파가 0으로 */
  vanish?: { t0: number; duration: number }
  /** 사진 여러 장을 순서대로 갈아끼우는 플레이리스트. 있으면 mediaId는 첫 항목과 같다 */
  playlist?: PlaylistItem[]
}

export type SwapKind = 'wipe' | 'push' | 'flip' | 'cut'

export type PlaylistItem = {
  mediaId: string
  mediaAspect: number
  /** 이 사진으로 바뀌기 시작하는 시각. 첫 항목은 슬롯 등장 시각 */
  t0: number
  /** 전환 길이(초). 첫 항목은 0 */
  duration: number
  kind: SwapKind
  /** 와이프·푸시 방향(슬롯 uv 기준) */
  dir: [number, number]
}

/** C2 파티클 분해·재조합: fromSlot의 사진이 입자로 흩어져 toSlot 자리에 모인다 */
export type ParticleTransition = {
  id: string
  fromSlotId: string
  toSlotId: string
  t0: number
  duration: number
  count: number
  /** 중간 경로가 흩어지는 폭(무대 단위) */
  spread: number
  seed: number
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
  transitions?: ParticleTransition[]
  /** B1 유리 돋보기가 지면 위를 미끄러지는 구간들 */
  lenses?: LensPass[]
  /** C4 페이지 컬: 다음 면을 덮은 백지가 모서리부터 말리며 벗겨진다 */
  sheets?: CurlSheet[]
}

export type CurlSheet = {
  id: string
  pageId: string
  t0: number
  duration: number
  /** 벗겨지기 시작하는 모서리 */
  corner: 'tl' | 'tr' | 'bl' | 'br'
  /** 말림 반지름(무대 단위) */
  radius: number
}

export type LensPass = {
  id: string
  t0: number
  duration: number
  /** 무대 좌표. 시작→끝을 inOutSine으로 이동하며 살짝 흔들린다 */
  from: [number, number]
  to: [number, number]
  radius: number
  /** 지면 위 높이 */
  height: number
}

/** 면 없는 연속 스트림: 사진들이 3D 경로 옆에 떠 있고 카메라가 사이를 날아간다 */
export type StreamStage = {
  kind: 'stream'
  background: string
  /** 안개 시작·끝 거리(카메라 기준) */
  fog: { near: number; far: number }
  /** 화이트 플래시 컷 */
  flashes: { t: number; duration: number; strength: number }[]
  /** 먼지 입자 */
  dust: {
    count: number
    seed: number
    radius: number
    length: number
    center: [number, number, number]
  }
}

/** 콜라주 보드: 카메라가 보드에 고정되고 레이아웃이 바뀌며 슬롯 사진이 순차로 갈아끼워진다 */
export type CollageStage = {
  kind: 'collage'
  width: number
  height: number
  paper: PaperParams
  layouts: { t0: number; t1: number; preset: string }[]
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
  stage: PaperStage | NewspaperStage | StreamStage | CollageStage
  /** 모든 슬롯(신문 무대는 페이지 슬롯을 평탄화한 것) */
  slots: Slot[]
  camera: CameraKey[]
  fov: number
  duration: number
  devices: Devices
  /** 카메라가 관심 지점에 도착하는 시각들(비트 동기 검증·시크바 표시용) */
  markers?: number[]
}
