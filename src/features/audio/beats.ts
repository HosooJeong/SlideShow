/**
 * F1 비트 분석. 순수 함수: 모노 샘플 → 온셋 엔벌로프 → BPM(자기상관) → 비트 그리드.
 * 브라우저 디코드는 analyzeBeats()가 담당하고, 핵심은 detectBeats()로 테스트한다.
 */
export type BeatInfo = { bpm: number; beats: number[]; confidence: number }

const HOP = 512

/** 프레임별 에너지 증가량(onset strength). 음수는 0 */
export function onsetEnvelope(samples: Float32Array, hop = HOP): Float32Array {
  const frames = Math.floor(samples.length / hop)
  const energy = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let e = 0
    const base = f * hop
    for (let i = 0; i < hop; i++) e += samples[base + i] * samples[base + i]
    energy[f] = Math.sqrt(e / hop)
  }
  const onset = new Float32Array(frames)
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, energy[f] - energy[f - 1])
  // 국소 평균으로 정규화(볼륨 변화에 둔감하게)
  const win = 16
  const out = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let s = 0
    let n = 0
    for (let k = Math.max(0, f - win); k <= Math.min(frames - 1, f + win); k++) {
      s += onset[k]
      n++
    }
    const mean = s / Math.max(1, n)
    out[f] = mean > 1e-6 ? onset[f] / mean : 0
  }
  return out
}

/** 자기상관으로 BPM 추정(60~180). 반환: bpm과 신뢰도(0~1) */
export function estimateBpm(
  onset: Float32Array,
  sampleRate: number,
  hop = HOP,
): { bpm: number; confidence: number } {
  const fps = sampleRate / hop
  const minLag = Math.floor((60 / 180) * fps)
  const maxLag = Math.ceil((60 / 60) * fps)
  const n = onset.length
  let mean = 0
  for (let i = 0; i < n; i++) mean += onset[i]
  mean /= Math.max(1, n)
  let bestLag = minLag
  let best = -Infinity
  let total = 0
  const scores: number[] = []
  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let s = 0
    for (let i = 0; i + lag < n; i++) s += (onset[i] - mean) * (onset[i + lag] - mean)
    s /= n - lag
    scores.push(s)
    total += Math.max(0, s)
    if (s > best) {
      best = s
      bestLag = lag
    }
  }
  if (!(best > 0) || total <= 0) return { bpm: 0, confidence: 0 }
  // 배음 정리: 2배 빠른 템포가 비슷하게 강하면 느린 쪽(더 안정) 유지, 60 미만은 2배
  let bpm = (60 * fps) / bestLag
  while (bpm < 70) bpm *= 2
  while (bpm > 170) bpm /= 2
  const confidence = Math.min(1, best / (total / scores.length) / 8)
  return { bpm: Math.round(bpm * 10) / 10, confidence }
}

/** 비트 그리드: 주기와 위상을 온셋에 맞춘다. 위상은 온셋 에너지가 최대가 되는 오프셋 */
export function beatGrid(
  onset: Float32Array,
  bpm: number,
  duration: number,
  sampleRate: number,
  hop = HOP,
): number[] {
  if (!(bpm > 0) || !(duration > 0)) return []
  const period = 60 / bpm
  const fps = sampleRate / hop
  const periodFrames = period * fps
  let bestPhase = 0
  let bestScore = -1
  const steps = 24
  for (let s = 0; s < steps; s++) {
    const phase = (s / steps) * periodFrames
    let score = 0
    for (let f = phase; f < onset.length; f += periodFrames) score += onset[Math.round(f)] ?? 0
    if (score > bestScore) {
      bestScore = score
      bestPhase = phase
    }
  }
  const beats: number[] = []
  for (let f = bestPhase; f / fps < duration; f += periodFrames)
    beats.push(Math.round((f / fps) * 1000) / 1000)
  return beats
}

export function detectBeats(samples: Float32Array, sampleRate: number): BeatInfo {
  const onset = onsetEnvelope(samples)
  const { bpm, confidence } = estimateBpm(onset, sampleRate)
  const duration = samples.length / sampleRate
  return { bpm, beats: beatGrid(onset, bpm, duration, sampleRate), confidence }
}

/** 타이밍을 비트 주기의 배수에 맞춘다: 이동+머무름이 정수 비트가 되도록 머무름을 조정(최소 1비트) */
export function quantizeTimings(
  timings: { dwell: number; travel: number },
  bpm: number,
  beatsPerStep = 1,
) {
  if (!(bpm > 0)) return timings
  const period = (60 / bpm) * beatsPerStep
  const total = timings.dwell + timings.travel
  const steps = Math.max(1, Math.round(total / period))
  const dwell = Math.max(period * 0.5, steps * period - timings.travel)
  return { dwell, travel: timings.travel }
}

/** 브라우저: 음악 Blob을 디코드해 비트를 분석한다(모노 다운믹스, 22.05k로 재샘플 없이 원 샘플레이트) */
export async function analyzeBeats(blob: Blob): Promise<BeatInfo> {
  const ctx = new OfflineAudioContext(1, 1, 44100)
  const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
  const ch = buffer.numberOfChannels
  const mono = new Float32Array(buffer.length)
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < d.length; i++) mono[i] += d[i] / ch
  }
  return detectBeats(mono, buffer.sampleRate)
}
