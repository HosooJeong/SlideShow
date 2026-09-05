/**
 * 음악 볼륨 엔벌로프. 영상 시간 t에서의 게인(0~1). 순수 함수.
 * 시작에서 fadeIn 동안 올라가고, 끝(end) 전 fadeOut 동안 내려간다. 음악이 영상보다 짧으면 음악 끝에서 끊긴다.
 */
export function musicGain(
  t: number,
  opts: { end: number; musicDuration: number; fadeIn: number; fadeOut: number; volume: number },
) {
  const { end, musicDuration, fadeIn, fadeOut, volume } = opts
  const stop = Math.min(end, musicDuration)
  if (t < 0 || t >= stop) return 0
  const inG = fadeIn > 0 ? Math.min(1, t / fadeIn) : 1
  const outG = fadeOut > 0 ? Math.min(1, (stop - t) / fadeOut) : 1
  return Math.max(0, Math.min(1, inG * outG)) * volume
}
