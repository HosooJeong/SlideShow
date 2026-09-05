/**
 * 하프톤 인쇄 GLSL 청크. noiseGlsl(luma, fbm) 뒤에 붙인다.
 * 밝기 기반 K 스크린 하나 + 사진 색을 잉크 색으로 얹는 듀오톤 인쇄.
 * CMY 3중 스크린은 화면 크기에서 무지개 모아레가 생겨 쓰지 않는다.
 */
export const halftoneGlsl = /* glsl */ `
struct HalftoneParams {
  float cells;      // 짧은 변 기준 도트 개수
  float angle;      // 스크린 각도(라디안)
  float misregister;// 색 잉크 어긋남(uv 단위)
  float bleed;      // 도트 가장자리 번짐
  float colorInk;   // 0 흑백 ~ 1 컬러 잉크
  float desaturate; // 채도 감소
  float contrast;   // 인쇄 대비(감마)
  vec3  paper;      // 종이색
};

// uv: 사진 좌표(이미 켄번즈 등 변환이 적용된 값). aspect: 사진 평면 가로/세로.
vec3 halftonePrint(sampler2D map, vec2 uv, float aspect, HalftoneParams hp) {
  vec3 src = texture2D(map, uv).rgb;
  float l = luma(src);

  // 정방 셀 격자(짧은 변 기준 cells개), 회전
  vec2 p = vec2(uv.x * aspect, uv.y) * hp.cells / min(aspect, 1.0);
  float c = cos(hp.angle), s = sin(hp.angle);
  vec2 r = mat2(c, -s, s, c) * p;
  vec2 cell = fract(r) - 0.5;
  float d = length(cell) * 2.0;

  // 셀 중심의 잉크량으로 도트 반지름 결정(셀 안 균일 → 둥근 도트)
  vec2 rc = floor(r) + 0.5;
  vec2 pc = mat2(c, s, -s, c) * rc;
  vec2 centerUv = vec2(pc.x / aspect, pc.y) * min(aspect, 1.0) / hp.cells;
  vec3 cSrc = texture2D(map, clamp(centerUv, 0.0, 1.0)).rgb;
  float cInk = pow(clamp(1.0 - luma(cSrc), 0.0, 1.0), hp.contrast);
  float radius = sqrt(cInk) * 1.15;
  float aa = fwidth(d) * 1.2;
  float edge = aa + hp.bleed * 0.25;
  float dot_ = 1.0 - smoothstep(radius - edge, radius + edge, d);

  // 잉크 색: 검정과 (어긋난) 사진 색의 혼합
  vec3 shifted = texture2D(map, uv + vec2(hp.misregister, -hp.misregister * 0.5)).rgb;
  shifted = mix(shifted, vec3(luma(shifted)), hp.desaturate);
  vec3 inkColor = mix(vec3(0.08, 0.07, 0.09), shifted * 0.55, hp.colorInk);
  vec3 printed = mix(hp.paper, inkColor, dot_);

  // 밝은 영역은 종이 그대로 → 원본을 살짝 비쳐 사진처럼 읽히게
  vec3 tinted = mix(src, vec3(l), hp.desaturate) * hp.paper / max(luma(hp.paper), 0.001);
  printed = mix(tinted, printed, 0.85);

  // 종이 섬유가 잉크 위로 살짝
  float fiber = fbm(uv * vec2(60.0, 90.0) * aspect, 2) - 0.5;
  return printed + fiber * 0.05;
}
`
