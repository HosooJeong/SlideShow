/**
 * 렌더러가 시간을 읽는 인터페이스. 플레이어·내보내기·실험실이 각자 구현한다.
 * 렌더러는 스스로 시간을 진행시키지 않는다(frameloop="demand").
 */
export type RenderClock = {
  read: () => number
  /** t가 바뀌었을 때 알림. 렌더러는 이때 한 프레임을 그린다 */
  subscribe: (cb: () => void) => () => void
}
