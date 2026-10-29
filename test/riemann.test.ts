// Checks that each sphere move produces the textbook formula.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Complex, abs, sub } from "../src/complex";
import { type Pose, REST, mobiusOf } from "../src/riemann";

const near = (a: Complex | null, b: Complex | null, msg: string) => {
  if (a === null || b === null) return assert.equal(a, b, msg);
  assert.ok(abs(sub(a, b)) < 1e-6, `${msg}: got ${a.re}+${a.im}i, want ${b.re}+${b.im}i`);
};
const z = (re: number, im = 0): Complex => ({ re, im });
const check = (p: Pose, a: Complex, b: Complex, c: Complex, d: Complex) => {
  const m = mobiusOf(p);
  near(m.a, a, "a");
  near(m.b, b, "b");
  near(m.c, c, "c");
  near(m.d, d, "d");
  return m;
};

test("resting sphere is the identity", () => {
  assert.equal(check(REST, z(1), z(0), z(0), z(1)).kind, "identity");
});

test("sliding the sphere translates: z + b", () => {
  const m = check({ ...REST, x: 0.9, y: 0.45 }, z(1), z(0.9, 0.45), z(0), z(1));
  assert.equal(m.kind, "parabolic");
});

test("raising the sphere to height h scales by h + 1/2", () => {
  const m = check({ ...REST, h: 1.4 }, z(1.9), z(0), z(0), z(1));
  assert.equal(m.kind, "hyperbolic");
});

test("spinning the sphere rotates: e^(iθ) z", () => {
  const m = check({ ...REST, yaw: Math.PI / 2 }, z(0, 1), z(0), z(0), z(1));
  assert.equal(m.kind, "elliptic");
});

test("tipping the sphere over is exactly 1/z", () => {
  const m = check({ ...REST, pitch: Math.PI }, z(0), z(1), z(1), z(0));
  near(m.zeroTo, null, "0 goes to ∞");
  near(m.infinityTo, z(0), "∞ goes to 0");
});

test("a general move combines everything into a loxodromic map", () => {
  const m = mobiusOf({ x: 0.45, y: -0.35, h: 0.95, yaw: 0.9, pitch: 2.1 });
  assert.equal(m.kind, "loxodromic");
});
