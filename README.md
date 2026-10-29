# Möbius Sphere

**[Try it live →](https://joshuadoss.github.io/mobius-sphere/)**

An interactive version of *[Möbius Transformations Revealed](https://www-users.cse.umn.edu/~arnold/moebius/)*, the 2007 video by Douglas Arnold and Jonathan Rogness. Move a sphere above the complex plane and watch a Möbius transformation happen, with the formula updating live.

I made this for a complex analysis discussion post. One of the ways I suggested updating the video was to make it interactive, so here it is.

## The idea

A Möbius transformation is a function of the form

$$T(z) = \frac{az + b}{cz + d}, \qquad ad - bc \neq 0.$$

The usual way to learn them is as a combination of four building blocks: translation $z + b$, scaling $kz$, rotation $e^{i\theta}z$, and inversion $1/z$. The video's point is that all four are really the same thing:

1. Wrap the plane onto a sphere using **stereographic projection**. Picture a lamp at the top of the sphere; each point on the sphere casts a shadow on the plane.
2. **Move the sphere** rigidly.
3. Let the lamp at the sphere's new top cast the shadow again.

| Sphere | Plane | Formula | Type |
|---|---|---|---|
| Slides sideways | Picture shifts | $z + b$ | parabolic |
| Rises or sinks | Picture grows or shrinks | $kz$ | hyperbolic |
| Spins in place | Picture turns about 0 | $e^{i\theta}z$ | elliptic |
| Tips upside down | 0 and ∞ trade places | $1/z$ | elliptic |

Any combination of these moves is still a rigid motion of the sphere, and every Möbius transformation can be made this way. The lamp's own point has no shadow, which is why ∞ shows up naturally: it's just the point on the sphere where the lamp is.

## Things to try

- **Tip the sphere over** and watch the red 0 marker climb to the lamp and disappear to ∞, while the dark ∞ marker comes down to 0.
- **Watch the white unit circle.** Whatever you do, it stays a circle, except when it passes through the lamp; then its shadow is a straight line. That's why lines count as "circles through ∞."
- **Move every slider a little** and look at the type label. Mixing a stretch with a turn gives a *loxodromic* map, which spirals.

## How it works

The code is small and commented throughout, meant to be read. Suggested order:

| File | What's in it |
|---|---|
| [`src/complex.ts`](src/complex.ts) | Complex numbers, and homogeneous coordinates for handling ∞ |
| [`src/riemann.ts`](src/riemann.ts) | The sphere, stereographic projection, and recovering $a, b, c, d$ from the picture |
| [`src/shaders.ts`](src/shaders.ts) | How each pixel gets its color |
| [`src/scene.ts`](src/scene.ts) | The 3D objects |
| [`src/motion.ts`](src/motion.ts) | Animations and the camera |
| [`src/main.ts`](src/main.ts) | Wiring the controls to the scene |
| [`test/riemann.test.ts`](test/riemann.test.ts) | Checks that each move gives the textbook formula |

Two details worth knowing:

**Drawing backwards.** Instead of moving grid lines forward through the transformation (which gets jagged near ∞), the plane's shader works backwards for every pixel: trace the lamp's ray up to the sphere, undo the sphere's rotation, and look up which original point lands there. That's $T^{-1}$, computed exactly per pixel, so the picture stays sharp everywhere.

**Reading off the formula.** A Möbius transformation is pinned down by where it sends three points. The code sends 0, 1, and ∞ through the sphere and solves a 2×2 system for the coefficients. The sphere has radius ½ and starts resting on the plane, which makes tipping it over exactly $1/z$ and raising it to height $h$ exactly a scale by $h + \tfrac12$.

## Running it locally

Requires Node 20 or newer.

```sh
npm install
npm run dev        # http://localhost:8000, rebuilds on save
npm test           # checks the math
npm run build      # outputs dist/
```

It's TypeScript and [Three.js](https://threejs.org/), bundled with [esbuild](https://esbuild.github.io/). Every push to `main` deploys to GitHub Pages through [the workflow](.github/workflows/pages.yml).

## Credits

- Douglas N. Arnold and Jonathan Rogness, *[Möbius Transformations Revealed](https://www-users.cse.umn.edu/~arnold/moebius/)* (video, 2007) and the accompanying article in the *Notices of the AMS* (2008).
- Code by Joshua Doss, with help from Claude.

MIT licensed. See [LICENSE](LICENSE).
