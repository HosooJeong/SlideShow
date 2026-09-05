/**
 * Web Audio 기반 음악 재생기. 플레이어 시간 t를 따라간다(시간의 주인은 플레이어).
 * - start(t): t 위치에서 재생 시작
 * - stop(): 정지
 * - setGain(g): 매 프레임 엔벌로프 게인 반영
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  private startedAt = 0
  private startOffset = 0

  async load(blob: Blob) {
    this.ctx ??= new AudioContext()
    this.stop()
    this.buffer = await this.ctx.decodeAudioData(await blob.arrayBuffer())
  }

  get ready() {
    return this.buffer !== null
  }

  get playing() {
    return this.source !== null
  }

  /** 현재 재생 위치(초). 재생 중이 아니면 마지막 시작 오프셋 */
  position() {
    if (!this.ctx || !this.source) return this.startOffset
    return this.startOffset + (this.ctx.currentTime - this.startedAt)
  }

  async start(offset: number) {
    if (!this.ctx || !this.buffer) return
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    this.stop()
    if (offset >= this.buffer.duration) return
    const source = this.ctx.createBufferSource()
    source.buffer = this.buffer
    const gain = this.ctx.createGain()
    gain.gain.value = 0
    source.connect(gain).connect(this.ctx.destination)
    source.start(0, Math.max(0, offset))
    source.onended = () => {
      if (this.source === source) {
        this.source = null
        this.gain = null
      }
    }
    this.source = source
    this.gain = gain
    this.startedAt = this.ctx.currentTime
    this.startOffset = offset
  }

  stop() {
    if (this.source) {
      try {
        this.source.stop()
      } catch {
        /* 이미 멈춤 */
      }
      this.source.disconnect()
      this.source = null
    }
    this.gain?.disconnect()
    this.gain = null
  }

  setGain(g: number) {
    if (this.gain && this.ctx) this.gain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.03)
  }

  dispose() {
    this.stop()
    this.buffer = null
    void this.ctx?.close()
    this.ctx = null
  }
}
