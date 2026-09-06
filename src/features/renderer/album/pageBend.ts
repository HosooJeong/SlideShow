import {
  type IUniform,
  type Material,
  Matrix4,
  MeshDepthMaterial,
  RGBADepthPacking,
  type WebGLProgramParametersWithUniforms,
} from 'three'

/**
 * 잎(leaf) 굽힘. 잎에 붙은 모든 메시(종이·사진)의 정점을 잎 공간에서 같은 함수로 변형한다:
 * 책등(x=0)을 축으로 각도 uAlpha만큼 넘어가고, 끝이 뒤처지는 활(bow) 모양이 된다.
 * 각도는 정점의 책등 거리 u에 선형 → 닫힌 형태의 원호 적분으로 위치를 구한다(t의 함수, 결정적).
 */
export type LeafUniforms = {
  /** 넘김 각도 0(오른쪽에 펼쳐짐) ~ π(왼쪽에 펼쳐짐) */
  uAlpha: IUniform<number>
  /** 중간 지점에서 끝이 뒤처지는 각(라디안) */
  uBow: IUniform<number>
  uW: IUniform<number>
  /** 잎이 놓이는 높이(테이블 기준 z) */
  uLift: IUniform<number>
  /** 책등 근처 그늘 세기·폭 */
  uGutter: IUniform<number>
  uGutterW: IUniform<number>
}

export function createLeafUniforms(w: number): LeafUniforms {
  return {
    uAlpha: { value: 0 },
    uBow: { value: 0.55 },
    uW: { value: w },
    uLift: { value: 0 },
    uGutter: { value: 0.22 },
    uGutterW: { value: w * 0.16 },
  }
}

const HEAD = /* glsl */ `
uniform float uAlpha, uBow, uW, uLift;
uniform mat4 uInvModel;
varying float vLeafU;
void leafBend(vec3 lp, out vec3 bent, out float theta, out float u) {
  u = clamp(lp.x, 0.0, uW);
  float th = lp.z;
  float beta = -uBow * sin(uAlpha);
  theta = uAlpha + beta * u / uW;
  float bx, bz;
  if (abs(beta) < 1e-4) { bx = u * cos(uAlpha); bz = u * sin(uAlpha); }
  else { bx = (uW / beta) * (sin(theta) - sin(uAlpha)); bz = -(uW / beta) * (cos(theta) - cos(uAlpha)); }
  vec2 nrm = vec2(-sin(theta), cos(theta));
  bent = vec3(bx + nrm.x * th, lp.y, bz + nrm.y * th + uLift);
}
`

const NORMAL = /* glsl */ `
vec3 objectNormal = vec3(normal);
{
  vec3 b; float th; float u;
  leafBend((modelMatrix * vec4(position, 1.0)).xyz, b, th, u);
  vec3 ln = mat3(modelMatrix) * objectNormal;
  ln = vec3(ln.x * cos(th) - ln.z * sin(th), ln.y, ln.x * sin(th) + ln.z * cos(th));
  objectNormal = normalize(mat3(uInvModel) * ln);
}
`

const POSITION = /* glsl */ `
vec3 transformed = vec3(position);
{
  vec3 b; float th; float u;
  leafBend((modelMatrix * vec4(position, 1.0)).xyz, b, th, u);
  transformed = (uInvModel * vec4(b, 1.0)).xyz;
  vLeafU = u;
}
`

const FRAG_HEAD = /* glsl */ `
uniform float uGutter, uGutterW, uAlpha;
varying float vLeafU;
`
const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
diffuseColor.rgb *= 1.0 - uGutter * exp(-vLeafU / uGutterW) * abs(cos(uAlpha));
`

function inject(
  shader: WebGLProgramParametersWithUniforms,
  leaf: LeafUniforms,
  inv: IUniform<Matrix4>,
  shade: boolean,
) {
  Object.assign(shader.uniforms, leaf, { uInvModel: inv })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${HEAD}`)
    .replace('#include <beginnormal_vertex>', NORMAL)
    .replace('#include <begin_vertex>', POSITION)
  if (shade) {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace('#include <color_fragment>', FRAG_COLOR)
  }
}

/** 재질에 잎 굽힘을 심는다(onBeforeCompile). 같은 잎의 메시들은 uniform 객체를 공유한다 */
export function applyLeafBend(material: Material, leaf: LeafUniforms, inv: IUniform<Matrix4>) {
  material.onBeforeCompile = (shader) => inject(shader, leaf, inv, true)
  material.customProgramCacheKey = () => 'leaf-bend-1'
  material.needsUpdate = true
  return material
}

/** 그림자 깊이 재질(같은 굽힘). 넘어가는 잎이 페이지에 그림자를 드리우게 */
export function createLeafDepthMaterial(leaf: LeafUniforms, inv: IUniform<Matrix4>) {
  const m = new MeshDepthMaterial({ depthPacking: RGBADepthPacking })
  m.onBeforeCompile = (shader) => inject(shader, leaf, inv, false)
  m.customProgramCacheKey = () => 'leaf-bend-depth-1'
  return m
}

export function createInvModel(): IUniform<Matrix4> {
  return { value: new Matrix4() }
}
