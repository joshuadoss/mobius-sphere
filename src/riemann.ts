/**
 * The geometry behind the demo: a sphere above the complex plane.
 *
 * THE THEOREM (Arnold & Rogness, 2008)
 * ------------------------------------
 * Every Möbius transformation T(z) = (az + b)/(cz + d) can be built in three steps:
 *
 *   1. Wrap the plane onto a sphere using stereographic projection.
 *   2. Move the sphere rigidly: slide it, raise or lower it, rotate it.
 *   3. Project back down to the plane from the sphere's (new) top point.
 *
 * Stereographic projection works like a lamp at the top of the sphere: every
 * point on the sphere casts a shadow on the plane along the ray from the lamp.
 * The lamp's own point has no shadow, and that is where ∞ lives.
 *
 * CONVENTIONS
 * -----------
 * - World space is z-up. The complex plane is the plane z = 0, with x the real
 *   axis and y the imaginary axis.
 * - The sphere has radius R. At rest it sits on the plane touching the origin,
 *   so its center is at height R.
 * - "Body" coordinates are unit vectors fixed to the sphere itself, like
 *   latitude and longitude painted on a globe. The pattern on the sphere lives
 *   in body coordinates and moves with it.
 *
 * With R = ½ the rest projection is the standard Riemann-sphere map, and tipping
 * the sphere upside down (a 180° turn about the real axis) is exactly z ↦ 1/z.
 */

import { Matrix4, Vector3 } from "three";
import {
  type Complex,
  type Homogeneous,
  abs,
  add,
  complex,
  div,
  fromHomogeneous,
  mul,
  sqrt,
  sub,
} from "./complex";

export const R = 0.5;

/** Where the sphere is and how it is turned. These are the five sliders. */
export interface Pose {
  /** Center position over the plane (real part). */
  x: number;
  /** Center position over the plane (imaginary part). */
  y: number;
  /** Height of the center above the plane. */
  h: number;
  /** Rotation about the vertical axis, in radians. */
  yaw: number;
  /** Rotation about the real (x) axis, in radians. A half turn is "tipping over". */
  pitch: number;
}

/** Resting on the plane at the origin, unrotated. This pose gives T(z) = z. */
export const REST: Pose = { x: 0, y: 0, h: R, yaw: 0, pitch: 0 };

/**
 * The sphere's orientation as a rotation matrix (body → world).
 * Yaw and pitch are enough to reach every orientation the demo needs.
 */
export function rotationOf(p: Pose): Matrix4 {
  return new Matrix4().makeRotationZ(p.yaw).multiply(new Matrix4().makeRotationX(p.pitch));
}

/**
 * Inverse stereographic projection for the resting sphere.
 *
 * Given z in the plane, shine a ray from the lamp at (0, 0, 2R) toward the
 * point (Re z, Im z, 0) and find where it first meets the sphere. Returns that
 * point as a body-frame unit vector. Passing null (∞) returns the north pole.
 *
 * Derivation: let d = (x, y, −2R) be the ray direction. Points on the ray are
 * N + t·d. Requiring them to lie on the sphere |P − C| = R gives
 * t = 4R² / |d|².
 */
export function restBody(z: Complex | null): Vector3 {
  if (z === null) return new Vector3(0, 0, 1);
  const d = new Vector3(z.re, z.im, -2 * R);
  const t = (4 * R * R) / d.lengthSq();
  return new Vector3(t * z.re, t * z.im, R - t * 2 * R).divideScalar(R);
}

/**
 * Stereographic projection for the sphere in pose p.
 *
 * u is a unit vector from the sphere's center (in world orientation). The lamp
 * sits at the sphere's current top, height h + R. Following the ray from the
 * lamp through the sphere point down to the plane gives
 *
 *   w = c + (h + R)·(u_x + i·u_y) / (1 − u_z),      c = x + iy.
 *
 * Near the lamp (u_z → 1) that formula divides by zero, so we also use the
 * equivalent form (u_x + i·u_y)/(1 − u_z) = (1 + u_z)/(u_x − i·u_y) and
 * return whichever homogeneous version is better conditioned.
 */
export function project(u: Vector3, p: Pose): Homogeneous {
  const k = p.h + R;
  const c = complex(p.x, p.y);
  const nearSouth: Homogeneous = [add(mul(c, complex(1 - u.z)), complex(k * u.x, k * u.y)), complex(1 - u.z)];
  const nearNorth: Homogeneous = [add(mul(c, complex(u.x, -u.y)), complex(k * (1 + u.z))), complex(u.x, -u.y)];
  const size = ([a, b]: Homogeneous) => abs(a) + abs(b);
  return size(nearSouth) >= size(nearNorth) ? nearSouth : nearNorth;
}

/** The full geometric map: rest plane → rest sphere → moved sphere → plane. */
export function apply(p: Pose, z: Complex | null): Homogeneous {
  return project(restBody(z).applyMatrix4(rotationOf(p)), p);
}

export type Kind = "identity" | "elliptic" | "parabolic" | "hyperbolic" | "loxodromic";

export interface Mobius {
  /** Coefficients of T(z) = (az + b)/(cz + d), scaled so d = 1 (or c = 1 when d = 0). */
  a: Complex;
  b: Complex;
  c: Complex;
  d: Complex;
  /** Where 0 and ∞ land. null means ∞. */
  zeroTo: Complex | null;
  infinityTo: Complex | null;
  kind: Kind;
}

/**
 * Recover the formula from the picture.
 *
 * A Möbius transformation is pinned down by where it sends any three points.
 * We push 0, 1, and ∞ through the sphere and solve for the matrix.
 *
 * In homogeneous terms, the columns of the matrix are the images of ∞ = [1:0]
 * and 0 = [0:1], each up to an unknown scale:
 *
 *   M = [ λ·T(∞)  |  μ·T(0) ]
 *
 * The third point fixes the scales: M·[1:1] = λ·T(∞) + μ·T(0) must equal T(1).
 * That is a 2×2 linear system for λ and μ, solved here with Cramer's rule.
 */
export function mobiusOf(p: Pose): Mobius {
  const t0 = apply(p, complex(0));
  const t1 = apply(p, complex(1));
  const tInf = apply(p, null);

  const det = sub(mul(tInf[0], t0[1]), mul(t0[0], tInf[1]));
  const lambda = div(sub(mul(t1[0], t0[1]), mul(t0[0], t1[1])), det);
  const mu = div(sub(mul(tInf[0], t1[1]), mul(t1[0], tInf[1])), det);

  let a = mul(lambda, tInf[0]);
  let c = mul(lambda, tInf[1]);
  let b = mul(mu, t0[0]);
  let d = mul(mu, t0[1]);

  // Classification needs the normalized form with ad − bc = 1.
  const s = sqrt(sub(mul(a, d), mul(b, c)));
  [a, b, c, d] = [a, b, c, d].map((v) => div(v, s));
  const kind = classify(a, b, c, d);

  // For display, rescale so the formula reads like the textbook: z + b, 2z, iz, 1/z.
  const n = abs(d) > 1e-6 ? d : c;
  [a, b, c, d] = [a, b, c, d].map((v) => div(v, n));

  return { a, b, c, d, zeroTo: fromHomogeneous(t0), infinityTo: fromHomogeneous(tInf), kind };
}

/**
 * Classify by the trace of the normalized matrix (ad − bc = 1).
 *
 *   trace real, |tr| < 2   elliptic     rotation around two fixed points
 *   trace real, |tr| = 2   parabolic    one fixed point (translations)
 *   trace real, |tr| > 2   hyperbolic   stretch away from one fixed point toward the other
 *   trace not real         loxodromic   spiral: stretch and rotate together
 *
 * The sign of the square root we took doesn't matter, since only tr² counts.
 */
export function classify(a: Complex, b: Complex, c: Complex, d: Complex): Kind {
  const tol = 0.01;
  if (abs(b) < 1e-3 && abs(c) < 1e-3 && abs(sub(a, d)) < 1e-3) return "identity";
  const tr = add(a, d);
  if (Math.abs(tr.im) > tol) return "loxodromic";
  const t = Math.abs(tr.re);
  if (Math.abs(t - 2) <= tol) return "parabolic";
  return t < 2 ? "elliptic" : "hyperbolic";
}
