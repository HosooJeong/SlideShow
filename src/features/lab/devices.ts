import type { ComponentType } from 'react'
import { SmokeScene } from './scenes/SmokeScene'
import { CameraDofScene } from './scenes/CameraDofScene'

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
  { id: 'smoke', title: '렌더러 스모크 테스트', doc: '—', Scene: SmokeScene },
]
