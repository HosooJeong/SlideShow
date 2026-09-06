import type { ComponentType } from 'react'
import { SmokeScene } from './scenes/SmokeScene'
import { CameraDofScene } from './scenes/CameraDofScene'
import { PaperHalftoneScene } from './scenes/PaperHalftoneScene'
import { InkRevealScene } from './scenes/InkRevealScene'
import { TextScene } from './scenes/TextScene'
import { SwapScene } from './scenes/SwapScene'

/**
 * 실험실 장치 레지스트리. DEVICES.md의 항목과 1:1로 대응한다.
 * 채택된 장치는 features/renderer/devices 로 옮기고 여기서는 데모 래퍼만 남긴다.
 */
export type LabDevice = {
  id: string
  title: string
  doc: string // DEVICES.md 항목 번호
  Scene: ComponentType
}

export const labDevices: LabDevice[] = [
  { id: 'camera-dof', title: '3D 카메라 + DOF + 필름 룩', doc: 'A1·B2', Scene: CameraDofScene },
  { id: 'paper-halftone', title: '종이 + 하프톤 인쇄', doc: 'B3', Scene: PaperHalftoneScene },
  { id: 'ink-reveal', title: '잉크 번짐 등장', doc: 'C1', Scene: InkRevealScene },
  { id: 'text', title: '한글 SDF 활자', doc: 'E1', Scene: TextScene },
  { id: 'swap', title: '플레이리스트 전환(와이프·푸시·플립·컷)', doc: 'C3', Scene: SwapScene },
  { id: 'smoke', title: '렌더러 스모크 테스트', doc: '—', Scene: SmokeScene },
]
