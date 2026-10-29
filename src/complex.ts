/**
 * Complex numbers, just enough of them.
 *
 * A complex number z = re + i·im is stored as a plain object. Every operation
 * returns a new value, so nothing here mutates its inputs.
 */

export type Complex = { re: number; im: number };

export const complex = (re: number, im = 0): Complex => ({ re, im });

export const add = (a: Complex, b: Complex): Complex => complex(a.re + b.re, a.im + b.im);

export const sub = (a: Complex, b: Complex): Complex => complex(a.re - b.re, a.im - b.im);

/** (a + bi)(c + di) = (ac − bd) + (ad + bc)i */
export const mul = (a: Complex, b: Complex): Complex =>
  complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);

/** a / b = a · conj(b) / |b|² */
export const div = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  return complex((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};

export const abs = (a: Complex): number => Math.hypot(a.re, a.im);

/** Principal square root, using the half-angle identities. */
export const sqrt = (a: Complex): Complex => {
  const r = abs(a);
  const re = Math.sqrt(Math.max(0, (r + a.re) / 2));
  const im = (a.im < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (r - a.re) / 2));
  return complex(re, im);
};

/**
 * A point on the Riemann sphere in homogeneous coordinates [z₀ : z₁].
 *
 * The ordinary complex number z is [z : 1], and the point at infinity is
 * [1 : 0]. Any nonzero multiple names the same point, so [2z : 2] is still z.
 * This lets us handle ∞ with the same arithmetic as everything else, and it is
 * exactly why a Möbius transformation can be written as a 2×2 matrix:
 *
 *   ⎡a b⎤ ⎡z⎤   ⎡az + b⎤
 *   ⎣c d⎦ ⎣1⎦ = ⎣cz + d⎦  =  [ (az + b)/(cz + d) : 1 ]
 */
export type Homogeneous = [Complex, Complex];

/** Convert [z₀ : z₁] back to a complex number, or null for ∞. */
export function fromHomogeneous([z0, z1]: Homogeneous): Complex | null {
  if (abs(z1) < 1e-9 * Math.max(1, abs(z0))) return null;
  return div(z0, z1);
}

/** Format for display: two decimals, a real minus sign, and "∞" for infinity. */
export function format(z: Complex | null): string {
  if (z === null) return "∞";
  if (abs(z) > 1e4) return "≈ ∞";
  const num = (v: number) => {
    const s = (Math.round(v * 100) / 100).toFixed(2);
    return (s === "-0.00" ? "0.00" : s).replace("-", "−");
  };
  const re = Math.abs(z.re) < 0.005 ? 0 : z.re;
  const im = Math.abs(z.im) < 0.005 ? 0 : z.im;
  if (im === 0) return num(re);
  if (re === 0) return `${num(im)}i`;
  return `${num(re)} ${im < 0 ? "−" : "+"} ${num(Math.abs(im))}i`;
}
