/**
 * GPU shaders that paint the picture on the sphere and its shadow on the plane.
 *
 * THE RENDERING TRICK
 * -------------------
 * The obvious approach is to take grid lines, push their points through the
 * transformation, and draw the results. That breaks down near ∞: a short
 * segment can map to a curve thousands of units long, and lines get jagged.
 *
 * Instead we work backwards, one pixel at a time. For each pixel on the plane:
 *
 *   1. Shine a ray from the lamp (the sphere's top point) to the pixel and find
 *      where it crosses the sphere.
 *   2. Undo the sphere's rotation to get the body-frame point, the spot on the
 *      painted pattern that casts this shadow.
 *   3. Project that body point from the resting sphere down to the resting
 *      plane. That gives the original complex number p that lands here.
 *   4. Color the pixel with whatever the pattern looks like at p.
 *
 * Steps 1–3 are T⁻¹, computed exactly. Every pixel is right, even near ∞,
 * and no geometry has to be rebuilt when the sphere moves: only a few
 * uniforms (center, rotation) change.
 *
 * The sphere itself uses steps 3–4 only, because its pattern is painted in
 * body coordinates and the mesh carries it along as the sphere moves.
 */

/** The pattern: a checkered square from −1.5 to 1.5, one hue per quadrant, plus axes and the unit circle. */
const PATTERN = /* glsl */ `
uniform vec3 uOutside;

// Quadrant colors: I amber, II green, III blue, IV plum. k mixes toward white.
vec3 quadrantTone(vec2 p, float k) {
  vec3 q1 = vec3(0.898, 0.635, 0.290);
  vec3 q2 = vec3(0.373, 0.639, 0.549);
  vec3 q3 = vec3(0.310, 0.498, 0.749);
  vec3 q4 = vec3(0.690, 0.384, 0.561);
  vec3 c = p.x >= 0.0 ? (p.y >= 0.0 ? q1 : q4) : (p.y >= 0.0 ? q2 : q3);
  return mix(c, vec3(1.0), k);
}

// p: the original complex number at this pixel.
// w: how much p changes across one pixel (from fwidth). Near ∞ this gets huge,
//    and we use it to fade detail that would otherwise shimmer.
vec3 pattern(vec2 p, vec2 w) {
  const float HALF = 1.5;
  const float CELL = 0.25;

  vec2 g = p / CELL;
  vec2 gw = max(w / CELL, vec2(1e-5));
  float checker = mod(floor(g.x) + floor(g.y), 2.0);
  vec3 col = quadrantTone(p, 0.12 + 0.30 * checker);

  // When whole cells shrink below a pixel, blend to their average color.
  float tiny = clamp(max(gw.x, gw.y) * 1.2 - 0.4, 0.0, 1.0);
  col = mix(col, quadrantTone(p, 0.27), tiny);

  // Grid lines, about one pixel wide wherever they are.
  vec2 f = abs(fract(g - 0.5) - 0.5) / gw;
  float line = 1.0 - clamp(min(f.x, f.y) - 0.3, 0.0, 1.0);
  float fade = clamp(1.0 - max(gw.x, gw.y) * 1.5, 0.0, 1.0);
  col = mix(col, col * 0.42, line * 0.75 * fade);

  // Real and imaginary axes.
  vec2 fa = abs(p) / max(w, vec2(1e-5));
  float axis = 1.0 - clamp(min(fa.x, fa.y) - 0.8, 0.0, 1.0);
  col = mix(col, vec3(0.08, 0.09, 0.14), axis * 0.85);

  // The unit circle |p| = 1, in white. Möbius maps send it to a circle or a line.
  float lw = max(length(w), 1e-5);
  float ring = 1.0 - clamp(abs(length(p) - 1.0) / lw - 0.9, 0.0, 1.0);
  col = mix(col, vec3(1.0), ring * 0.95 * fade);

  // Outside the square, show the background color.
  float edge = max(abs(p.x), abs(p.y));
  float ew = max(max(w.x, w.y), 1e-5);
  float inside = 1.0 - smoothstep(HALF - ew, HALF + ew, edge);
  return mix(uOutside, col, inside);
}
`;

export const planeVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

export const planeFragment = /* glsl */ `
uniform vec3 uCenter;      // sphere center in world space
uniform float uRadius;
uniform mat3 uWorldToBody; // inverse of the sphere's rotation
uniform vec3 uBackground;
varying vec3 vWorld;
${PATTERN}
void main() {
  // 1. Ray from the lamp N to this pixel; second intersection with the sphere.
  //    Points N + t·d lie on the sphere when t = −2R·d_z / |d|².
  vec3 N = uCenter + vec3(0.0, 0.0, uRadius);
  vec3 d = vWorld - N;
  float t = -2.0 * uRadius * d.z / dot(d, d);
  vec3 u = (vec3(0.0, 0.0, uRadius) + t * d) / uRadius;

  // 2. Undo the rotation: world direction to body direction.
  vec3 b = uWorldToBody * u;

  // 3. Stereographic projection of the resting sphere: p = 2R·(b_x, b_y) / (1 − b_z).
  vec2 p = 2.0 * uRadius * b.xy / max(1.0 - b.z, 1e-7);

  // 4. Paint, then fade far-away plane into the background.
  vec3 col = pattern(p, fwidth(p));
  float fog = smoothstep(9.0, 26.0, length(vWorld.xy));
  gl_FragColor = vec4(mix(col, uBackground, fog), 1.0);
}`;

export const sphereVertex = /* glsl */ `
varying vec3 vBody;   // body-frame direction: moves with the sphere
varying vec3 vNormal; // world-frame normal: for lighting
void main() {
  vBody = normalize(position);
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const sphereFragment = /* glsl */ `
uniform float uRadius;
varying vec3 vBody;
varying vec3 vNormal;
${PATTERN}
void main() {
  vec3 b = normalize(vBody);
  vec2 p = 2.0 * uRadius * b.xy / max(1.0 - b.z, 1e-7);
  vec3 col = pattern(p, fwidth(p));
  // Soft light from above so the sphere reads as round.
  vec3 L = normalize(vec3(-0.35, -0.6, 1.0));
  float light = 0.62 + 0.38 * max(dot(normalize(vNormal), L), 0.0);
  gl_FragColor = vec4(col * light, 1.0);
}`;
