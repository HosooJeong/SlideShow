/**
 * 잉크 번짐 등장 GLSL 청크. noiseGlsl 뒤에 붙인다.
 * field(0..1)가 낮은 곳이 먼저 드러난다. progress 0→1.
 */
export const inkRevealGlsl = /* glsl */ `
float inkField(vec2 uv, float scale, float directional, float seed) {
  vec2 s = vec2(seed * 3.1, seed * 1.7);
  float n = fbm(uv * scale + s, 5);
  float radial = length(uv - 0.5) * 1.2;
  float bias = mix(radial, 1.0 - uv.y, directional);   // 위에서 아래로
  return mix(n, bias, 0.45);
}

// 반환: x = alpha(드러남), y = 잉크 테두리 밴드(0..1)
vec2 inkMask(float field, float progress, float feather, float edge) {
  float th = progress * (1.0 + feather + edge) - feather;
  float hidden = smoothstep(th - feather, th + feather, field);
  float alpha = 1.0 - hidden;
  float band = 1.0 - smoothstep(0.0, edge, abs(field - th));
  band *= step(0.001, progress) * step(progress, 0.999);
  return vec2(alpha, band);
}

vec3 sepiaMix(vec3 col, float progress, float enabled) {
  float l = luma(col);
  vec3 sepia = vec3(l) * vec3(1.05, 0.9, 0.7);
  float colorMix = smoothstep(0.55, 1.0, progress);
  return mix(col, mix(sepia, col, colorMix), enabled);
}
`
