import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox, Text } from '@react-three/drei'
import {
  BoxGeometry,
  FrontSide,
  Group,
  LatheGeometry,
  type Material,
  type Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SpotLight,
  type Texture,
  Vector2,
} from 'three'
import type { RenderClock } from '../clock'
import { FONTS } from '../fonts'
import { TextBlockMesh } from '../TextBlockMesh'
import type { TextureMap } from '../textures'
import type { AlbumStage, Composition, LeafAttach, Slot, TextBlock } from '../types'
import { clamp01, easings } from '@/shared/utils/easing'
import {
  applyLeafBend,
  createInvModel,
  createLeafDepthMaterial,
  createLeafUniforms,
  type LeafUniforms,
} from './pageBend'
import {
  makeLinenNormal,
  makeNoiseTexture,
  makePageEdgeTexture,
  makePaperNormal,
  makeWindowGobo,
} from './textures'

const SIDE_Z = 0.0009
const PAGE_EPS = 0.0015

/**
 * 포토북 무대. 테이블 위 레이플랫 앨범: PBR 재질, 방향광 그림자, 환경광. 모든 움직임은 t의 함수.
 */
export function AlbumView({
  stage,
  composition,
  textures,
  clock,
}: {
  stage: AlbumStage
  composition: Composition
  textures: TextureMap
  clock: RenderClock
}) {
  const noise = useMemo(() => makeNoiseTexture(256, composition.seed + 11, 4), [composition.seed])
  const fabric = useMemo(() => makeLinenNormal(512, composition.seed + 23, 56), [composition.seed])
  const paper = useMemo(() => makePaperNormal(512, composition.seed + 31), [composition.seed])
  const edge = useMemo(() => makePageEdgeTexture(composition.seed + 5), [composition.seed])
  useEffect(
    () => () => {
      noise?.dispose()
      fabric?.dispose()
      paper?.dispose()
      edge?.dispose()
    },
    [noise, fabric, paper, edge],
  )
  const W = stage.page.w
  return (
    <>
      <color attach="background" args={[stage.table.color]} />
      <ambientLight intensity={0.14} color="#f3eee6" />
      {stage.light.gobo ? (
        <WindowLight color={stage.light.key} intensity={stage.light.intensity} />
      ) : (
        <directionalLight
          position={[-2.6, 2.4, 6.5]}
          intensity={stage.light.intensity * 2.2}
          color={stage.light.key}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.00035}
          shadow-normalBias={0.015}
          shadow-camera-near={1}
          shadow-camera-far={20}
          shadow-camera-left={-(W + 2.5)}
          shadow-camera-right={W + 2.5}
          shadow-camera-top={W + 2}
          shadow-camera-bottom={-(W + 2)}
        />
      )}
      <directionalLight position={[-2.6, 2.4, 6.5]} intensity={0.3} color={stage.light.key} />
      <directionalLight position={[5, -3.5, 4]} intensity={0.28} color={stage.light.fill} />
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={1.3}
          color="#fff6ea"
          position={[-4, 3, 7]}
          scale={[6, 4, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.5}
          color="#e9eef7"
          position={[5, -4, 5]}
          scale={[4, 3, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.25}
          color="#ffffff"
          position={[0, 0, -6]}
          scale={[20, 20, 1]}
          target={[0, 0, 0]}
        />
      </Environment>
      <Table color={stage.table.color} bump={noise} />
      <Book
        stage={stage}
        composition={composition}
        textures={textures}
        clock={clock}
        fabric={fabric}
        paper={paper}
        edge={edge}
      />
      <Props stage={stage} textures={textures} />
    </>
  )
}

function Table({ color, bump }: { color: string; bump: Texture | null }) {
  const mat = useMemo(() => {
    const m = new MeshStandardMaterial({ color, roughness: 0.96, metalness: 0 })
    if (bump) {
      m.bumpMap = bump
      m.bumpScale = 0.0025
      bump.repeat.set(24, 24)
    }
    return m
  }, [color, bump])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh receiveShadow position={[0, 0, 0]} material={mat}>
      <planeGeometry args={[60, 60]} />
    </mesh>
  )
}

/**
 * 창가 빛: 창살 무늬(고보)를 투영하는 스포트라이트. 그림자를 드리우는 키 라이트.
 * three의 스포트라이트 map은 castShadow가 켜져 있어야 투영된다.
 */
function WindowLight({ color, intensity }: { color: string; intensity: number }) {
  const gobo = useMemo(() => makeWindowGobo(512), [])
  const light = useMemo(() => new SpotLight(color), [color])
  useEffect(() => () => gobo?.dispose(), [gobo])
  useEffect(() => {
    light.position.set(-4.2, 3.6, 8.2)
    light.target.position.set(0.4, -0.5, 0)
    light.angle = 0.5
    light.penumbra = 0.42
    light.decay = 1.2
    light.distance = 0
    light.intensity = intensity * 36
    light.castShadow = true
    light.shadow.mapSize.set(2048, 2048)
    light.shadow.bias = -0.0003
    light.shadow.normalBias = 0.012
    light.shadow.camera.near = 2
    light.shadow.camera.far = 22
    light.shadow.camera.fov = 55
    light.shadow.radius = 4
    if (gobo) light.map = gobo
  }, [light, gobo, intensity])
  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  )
}

/** 시각 t의 책 상태: 표지 열림, 보이는 스프레드 k(= 왼쪽에 넘어가 있는 잎 수). 넘김 애니메이션은 없다(컷) */
function bookState(stage: AlbumStage, t: number) {
  const open = easings.inOutCubic(clamp01((t - stage.opening.t0) / stage.opening.duration))
  let k = 0
  for (const sh of stage.shots) if (t >= sh.t0) k = sh.spread
  return { open, k, p: 1 }
}

function Book({
  stage,
  composition,
  textures,
  clock,
  fabric,
  paper,
  edge,
}: {
  stage: AlbumStage
  composition: Composition
  textures: TextureMap
  clock: RenderClock
  fabric: Texture | null
  paper: Texture | null
  edge: Texture | null
}) {
  const { w: W, h: H, thickness: th } = stage.page
  const { thickness: ct, overhang: oh } = stage.cover
  const L = stage.leaves
  const sw = 2 * ct + L * th
  const coverRef = useRef<Group>(null)
  const spineRef = useRef<Mesh>(null)
  const leftBlock = useRef<Mesh>(null)
  const rightBlock = useRef<Mesh>(null)
  const leafUniforms = useMemo(() => Array.from({ length: L }, () => createLeafUniforms(W)), [L, W])
  const leafGroups = useRef<(Group | null)[]>([])
  const sideGroups = useRef<Map<string, Group>>(new Map())

  const fabricMat = useMemo(() => {
    const m = new MeshPhysicalMaterial({
      color: stage.cover.color,
      roughness: 0.82,
      metalness: 0,
      sheen: 0.5,
      sheenRoughness: 0.7,
      sheenColor: '#ffffff',
    })
    if (fabric) {
      m.normalMap = fabric
      m.normalScale.set(0.55, 0.55)
      fabric.repeat.set(6, 5)
    }
    return m
  }, [stage.cover.color, fabric])
  const paperMat = useMemo(() => {
    const m = new MeshStandardMaterial({ color: stage.page.color, roughness: 0.92, metalness: 0 })
    return m
  }, [stage.page.color])
  const blockMats = useMemo(() => {
    const side = new MeshStandardMaterial({ color: '#efebe3', roughness: 0.9 })
    if (edge) side.map = edge
    const top = new MeshStandardMaterial({ color: stage.page.color, roughness: 0.92 })
    // BoxGeometry 면 순서: +x, -x, +y, -y, +z, -z
    return [side, side, side, side, top, top]
  }, [edge, stage.page.color])
  useEffect(
    () => () => {
      fabricMat.dispose()
      paperMat.dispose()
      blockMats[0].dispose()
      blockMats[4].dispose()
    },
    [fabricMat, paperMat, blockMats],
  )

  useFrame(() => {
    const t = clock.read()
    const { open, k, p } = bookState(stage, t)
    // 표지: 닫힘(페이지 블록 위) → 열림(테이블 위 왼쪽). 힌지는 책등 폭만큼 왼쪽으로 밀려난다
    const cover = coverRef.current
    if (cover) {
      const zPivot = (ct + L * th + ct / 2) * (1 - open) + (ct / 2) * open
      cover.position.set(-sw * open, 0, zPivot)
      cover.rotation.y = -Math.PI * open
    }
    if (spineRef.current) {
      const hs = sw * (1 - open) + ct * open
      spineRef.current.scale.z = hs
      spineRef.current.position.z = hs / 2
    }
    // 페이지 블록 높이: 오른쪽 = 남은 잎, 왼쪽 = 완전히 넘어간 잎(맨 위 잎 제외)
    const hR = Math.max(0.0005, (L - k) * th)
    const hL = Math.max(0.0005, k >= 1 ? (k - 1) * th : 0)
    if (rightBlock.current) {
      rightBlock.current.scale.z = hR
      rightBlock.current.position.z = ct + hR / 2
    }
    if (leftBlock.current) {
      leftBlock.current.scale.z = hL
      leftBlock.current.position.z = ct + hL / 2
      leftBlock.current.visible = k >= 2 && hL > 0.001
    }
    // 잎: 보이는 것은 k(오른쪽 페이지, α=0)와 k-1(왼쪽 페이지, α=π). 나머지는 블록 안
    void p
    for (let i = 0; i < L; i++) {
      const g = leafGroups.current[i]
      const u = leafUniforms[i]
      if (!g) continue
      let visible = false
      let alpha = 0
      let lift = 0
      if (i === k) {
        visible = true
        alpha = 0
        lift = ct + (L - k) * th + PAGE_EPS
      } else if (i === k - 1) {
        visible = true
        alpha = Math.PI
        lift = ct + k * th + PAGE_EPS
      }
      g.visible = visible
      u.uAlpha.value = alpha
      u.uLift.value = lift
      // 활자는 굽히지 않고 펼쳐진 상태의 월드 좌표에 둔다(앞면: 책등 오른쪽, 뒷면: 왼쪽)
      const front = sideGroups.current.get(`${i}-front-text`)
      const back = sideGroups.current.get(`${i}-back-text`)
      const textZ = lift + SIDE_Z + 0.0008
      if (front) {
        front.visible = visible && alpha < 0.02
        front.position.set(0, 0, textZ)
      }
      if (back) {
        back.visible = visible && alpha > Math.PI - 0.02
        back.position.set(-W, 0, textZ)
      }
    }
  })

  const slotsByLeaf = useMemo(() => {
    const m = new Map<string, Slot[]>()
    for (const s of composition.slots) {
      if (!s.attach) continue
      const key = `${s.attach.leaf}-${s.attach.side}`
      m.set(key, [...(m.get(key) ?? []), s])
    }
    return m
  }, [composition.slots])
  const textsByLeaf = useMemo(() => {
    const m = new Map<string, TextBlock[]>()
    for (const tb of stage.texts) {
      if (!tb.attach) continue
      const key = `${tb.attach.leaf}-${tb.attach.side}`
      m.set(key, [...(m.get(key) ?? []), tb])
    }
    return m
  }, [stage.texts])

  const coverW = W + oh
  const coverH = H + 2 * oh
  return (
    <group>
      {/* 뒤표지 */}
      <RoundedBox
        args={[coverW, coverH, ct]}
        radius={0.006}
        smoothness={3}
        position={[coverW / 2, 0, ct / 2]}
        castShadow
        receiveShadow
        material={fabricMat}
      />
      {/* 책등 */}
      <mesh
        ref={spineRef}
        position={[-sw / 2, 0, sw / 2]}
        castShadow
        receiveShadow
        material={fabricMat}
      >
        <boxGeometry args={[sw, coverH, 1]} />
      </mesh>
      {/* 페이지 블록(단면) */}
      <mesh
        ref={rightBlock}
        position={[W / 2, 0, ct]}
        material={blockMats}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[W - 0.004, H - 0.004, 1]} />
      </mesh>
      <mesh
        ref={leftBlock}
        position={[-W / 2, 0, ct]}
        material={blockMats}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[W - 0.004, H - 0.004, 1]} />
      </mesh>
      {/* 앞표지(힌지 그룹) */}
      <group ref={coverRef} position={[0, 0, ct + L * th + ct / 2]}>
        <RoundedBox
          args={[coverW, coverH, ct]}
          radius={0.006}
          smoothness={3}
          position={[coverW / 2, 0, 0]}
          castShadow
          receiveShadow
          material={fabricMat}
        />
        {/* 표지 제목 */}
        {stage.cover.title && (
          <Text
            font={FONTS.bold}
            fontSize={0.13}
            letterSpacing={0.08}
            color="#b9ae9d"
            anchorX="center"
            anchorY="middle"
            position={[coverW / 2, -H * 0.22, ct / 2 + 0.0008]}
            // eslint-disable-next-line react/no-unknown-property
            depthOffset={-1}
          >
            {stage.cover.title}
          </Text>
        )}
        {/* 표지 안쪽 종이 */}
        <mesh
          position={[coverW / 2, 0, -ct / 2 - 0.0006]}
          rotation={[Math.PI, 0, 0]}
          material={paperMat}
          receiveShadow
        >
          <planeGeometry args={[coverW - 0.02, coverH - 0.02]} />
        </mesh>
      </group>
      {/* 잎들 */}
      {Array.from({ length: L }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            leafGroups.current[i] = el
          }}
        >
          <Leaf
            index={i}
            stage={stage}
            uniforms={leafUniforms[i]}
            paper={paper}
            textures={textures}
            slots={slotsByLeaf}
            texts={textsByLeaf}
            clock={clock}
            registerText={(key, g) => {
              if (g) sideGroups.current.set(key, g)
              else sideGroups.current.delete(key)
            }}
          />
        </group>
      ))}
    </group>
  )
}

function Leaf({
  index,
  stage,
  uniforms,
  paper,
  textures,
  slots,
  texts,
  clock,
  registerText,
}: {
  index: number
  stage: AlbumStage
  uniforms: LeafUniforms
  paper: Texture | null
  textures: TextureMap
  slots: Map<string, Slot[]>
  texts: Map<string, TextBlock[]>
  clock: RenderClock
  registerText: (key: string, g: Group | null) => void
}) {
  const { w: W, h: H } = stage.page
  const pageMat = useMemo(() => {
    // 앞면·뒷면을 단면 평면 둘로 만든다(양면 재질이면 뒷면의 정점 법선이 아래를 향해 그림자 normalBias가 거꾸로 걸린다)
    const m = new MeshStandardMaterial({
      color: stage.page.color,
      roughness: 0.93,
      metalness: 0,
      side: FrontSide,
    })
    if (paper) {
      m.normalMap = paper
      m.normalScale.set(0.18, 0.18)
      paper.repeat.set(3, 2.4)
    }
    return m
  }, [stage.page.color, paper])
  const pageGeo = useMemo(() => new PlaneGeometry(W, H, 72, 2), [W, H])
  useEffect(
    () => () => {
      pageMat.dispose()
      pageGeo.dispose()
    },
    [pageMat, pageGeo],
  )
  const side = (which: LeafAttach['side']) => {
    const key = `${index}-${which}`
    const ss = slots.get(key) ?? []
    const ts = texts.get(key) ?? []
    if (ss.length === 0 && ts.length === 0) return null
    const transform =
      which === 'front'
        ? {
            position: [0, 0, SIDE_Z] as [number, number, number],
            rotation: [0, 0, 0] as [number, number, number],
          }
        : {
            position: [W, 0, -SIDE_Z] as [number, number, number],
            rotation: [0, Math.PI, 0] as [number, number, number],
          }
    return (
      <>
        <group {...transform}>
          {ss.map((s) => {
            const tex = textures.get(s.mediaId)
            return tex ? (
              <PrintedPhoto key={s.id} slot={s} texture={tex} uniforms={uniforms} />
            ) : null
          })}
        </group>
        {ts.length > 0 && (
          <group ref={(g) => registerText(`${key}-text`, g)} visible={false}>
            {ts.map((tb) => (
              <TextBlockMesh key={tb.id} block={tb} clock={clock} z={0} />
            ))}
          </group>
        )}
      </>
    )
  }
  return (
    <>
      <BentMesh
        geometry={pageGeo}
        material={pageMat}
        uniforms={uniforms}
        position={[W / 2, 0, 0.0001]}
        castShadow
        receiveShadow
      />
      <BentMesh
        geometry={pageGeo}
        material={pageMat}
        uniforms={uniforms}
        position={[W / 2, 0, -0.0001]}
        rotation={[0, Math.PI, 0]}
        castShadow
        receiveShadow
      />
      {side('front')}
      {side('back')}
    </>
  )
}

/** 페이지에 인쇄된 사진: 셀에 맞게 잘라(cover) UV를 조정, 반광 인화지 재질 */
function PrintedPhoto({
  slot,
  texture,
  uniforms,
}: {
  slot: Slot
  texture: Texture
  uniforms: LeafUniforms
}) {
  const geo = useMemo(() => {
    const g = new PlaneGeometry(slot.w, slot.h, 24, 2)
    const cell = slot.w / slot.h
    const rx = Math.min(1, cell / slot.mediaAspect)
    const ry = Math.min(1, slot.mediaAspect / cell)
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (1 - rx) / 2 + uv.getX(i) * rx, (1 - ry) / 2 + uv.getY(i) * ry)
    }
    uv.needsUpdate = true
    return g
  }, [slot.w, slot.h, slot.mediaAspect])
  const mat = useMemo(
    () =>
      new MeshPhysicalMaterial({
        map: texture,
        roughness: 0.48,
        metalness: 0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.42,
        side: FrontSide,
      }),
    [texture],
  )
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return (
    <BentMesh
      geometry={geo}
      material={mat}
      uniforms={uniforms}
      position={[slot.x, slot.y, 0]}
      receiveShadow
    />
  )
}

/** 잎 굽힘이 적용된 메시. 재질에 onBeforeCompile을 심고, 그림자용 깊이 재질도 같은 굽힘을 쓴다 */
function BentMesh({
  geometry,
  material,
  uniforms,
  position,
  rotation,
  castShadow,
  receiveShadow,
}: {
  geometry: PlaneGeometry
  material: Material
  uniforms: LeafUniforms
  position: [number, number, number]
  rotation?: [number, number, number]
  castShadow?: boolean
  receiveShadow?: boolean
}) {
  const ref = useRef<Mesh>(null)
  const inv = useMemo(() => createInvModel(), [])
  const depth = useMemo(() => createLeafDepthMaterial(uniforms, inv), [uniforms, inv])
  const bent = useMemo(() => applyLeafBend(material, uniforms, inv), [material, uniforms, inv])
  useEffect(() => () => depth.dispose(), [depth])
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.onBeforeRender = () => {
      inv.value.copy(mesh.matrixWorld).invert()
    }
    mesh.customDepthMaterial = depth
  }, [depth, inv])
  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={bent}
      position={position}
      rotation={rotation ?? [0, 0, 0]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      frustumCulled={false}
    />
  )
}

/** 소품: 커피잔(받침 포함), 낱장 인화지 */
function Props({ stage, textures }: { stage: AlbumStage; textures: TextureMap }) {
  return (
    <>
      {stage.props.cup && (
        <Cup x={stage.props.cup.x} y={stage.props.cup.y} rotation={stage.props.cup.rotation} />
      )}
      {stage.props.prints.map((p, i) => {
        const tex = textures.get(p.mediaId)
        return tex ? <LoosePrint key={i} print={p} texture={tex} /> : null
      })}
    </>
  )
}

function Cup({ x, y, rotation }: { x: number; y: number; rotation: number }) {
  const cupGeo = useMemo(() => {
    const pts = [
      new Vector2(0, 0),
      new Vector2(0.27, 0),
      new Vector2(0.3, 0.015),
      new Vector2(0.33, 0.25),
      new Vector2(0.36, 0.52),
      new Vector2(0.365, 0.56),
      new Vector2(0.345, 0.565),
      new Vector2(0.325, 0.5),
      new Vector2(0.295, 0.42),
      new Vector2(0, 0.42),
    ]
    return new LatheGeometry(pts, 48)
  }, [])
  const saucerGeo = useMemo(() => {
    const pts = [
      new Vector2(0, 0),
      new Vector2(0.3, 0),
      new Vector2(0.34, 0.012),
      new Vector2(0.55, 0.06),
      new Vector2(0.56, 0.075),
      new Vector2(0.53, 0.075),
      new Vector2(0.33, 0.03),
      new Vector2(0, 0.03),
    ]
    return new LatheGeometry(pts, 48)
  }, [])
  const ceramic = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#f4f0ea',
        roughness: 0.28,
        metalness: 0,
        clearcoat: 0.7,
        clearcoatRoughness: 0.2,
      }),
    [],
  )
  const coffee = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#3a2417',
        roughness: 0.12,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      }),
    [],
  )
  useEffect(
    () => () => {
      cupGeo.dispose()
      saucerGeo.dispose()
      ceramic.dispose()
      coffee.dispose()
    },
    [cupGeo, saucerGeo, ceramic, coffee],
  )
  return (
    <group position={[x, y, 0]} rotation={[0, 0, rotation]}>
      <mesh
        geometry={saucerGeo}
        material={ceramic}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      />
      <group position={[0, 0, 0.03]}>
        <mesh
          geometry={cupGeo}
          material={ceramic}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        />
        <mesh position={[0, 0, 0.415]} material={coffee}>
          <circleGeometry args={[0.293, 48]} />
        </mesh>
        {/* 손잡이 */}
        <mesh
          position={[0.38, 0, 0.3]}
          rotation={[0, 0, Math.PI / 2]}
          material={ceramic}
          castShadow
        >
          <torusGeometry args={[0.13, 0.03, 12, 32, Math.PI]} />
        </mesh>
      </group>
    </group>
  )
}

function LoosePrint({
  print,
  texture,
}: {
  print: AlbumStage['props']['prints'][number]
  texture: Texture
}) {
  const border = 0.1
  const paperMat = useMemo(
    () => new MeshStandardMaterial({ color: '#fbfaf7', roughness: 0.75 }),
    [],
  )
  const photoMat = useMemo(
    () =>
      new MeshPhysicalMaterial({
        map: texture,
        roughness: 0.4,
        metalness: 0,
        clearcoat: 0.4,
        clearcoatRoughness: 0.3,
      }),
    [texture],
  )
  const geo = useMemo(() => {
    const g = new PlaneGeometry(print.w, print.h)
    const cell = print.w / print.h
    const rx = Math.min(1, cell / print.mediaAspect)
    const ry = Math.min(1, print.mediaAspect / cell)
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (1 - rx) / 2 + uv.getX(i) * rx, (1 - ry) / 2 + uv.getY(i) * ry)
    uv.needsUpdate = true
    return g
  }, [print.w, print.h, print.mediaAspect])
  const box = useMemo(
    () => new BoxGeometry(print.w + border * 2, print.h + border * 2, 0.003),
    [print.w, print.h],
  )
  useEffect(
    () => () => {
      paperMat.dispose()
      photoMat.dispose()
      geo.dispose()
      box.dispose()
    },
    [paperMat, photoMat, geo, box],
  )
  return (
    <group position={[print.x, print.y, 0.0015]} rotation={[0, 0, print.rotation]}>
      <mesh geometry={box} material={paperMat} castShadow receiveShadow />
      <mesh geometry={geo} material={photoMat} position={[0, 0, 0.0016]} receiveShadow />
    </group>
  )
}
