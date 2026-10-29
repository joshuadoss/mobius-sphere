/**
 * Entry point: connects the page's controls to the scene.
 *
 * Reading order for the curious:
 *   complex.ts   complex numbers and points at infinity
 *   riemann.ts   the sphere, stereographic projection, and the formula
 *   shaders.ts   how each pixel is colored (the per-pixel inverse trick)
 *   scene.ts     the 3D objects
 *   motion.ts    animations and the camera
 *   main.ts      this file: wiring
 */

import { Vector3 } from "three";
import { format } from "./complex";
import { type Pose, R, REST } from "./riemann";
import { createScene } from "./scene";
import {
  Animator,
  type Orbit,
  PRESETS,
  type PresetName,
  TOUR,
  VIEWS,
  type ViewName,
  clampOrbit,
  ease,
} from "./motion";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("view");
const world = createScene(canvas);

let pose: Pose = { ...REST };
let dirty = true;

// ---------- theme ----------
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
const applyTheme = () => {
  world.applyTheme(css);
  dirty = true;
};
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// ---------- readout ----------
const readout = {
  a: $("co-a"),
  b: $("co-b"),
  c: $("co-c"),
  d: $("co-d"),
  zero: $("w0"),
  infinity: $("winf"),
  kind: $("kind"),
};

function showFormula(m: ReturnType<typeof world.setPose>) {
  readout.a.textContent = format(m.a);
  readout.b.textContent = format(m.b);
  readout.c.textContent = format(m.c);
  readout.d.textContent = format(m.d);
  readout.zero.textContent = format(m.zeroTo);
  readout.infinity.textContent = format(m.infinityTo);
  readout.kind.textContent = m.kind;
  readout.kind.dataset.kind = m.kind;
}

// ---------- sliders ----------
const keys = ["x", "y", "h", "yaw", "pitch"] as const;
const slider = Object.fromEntries(keys.map((k) => [k, $<HTMLInputElement>(`s-${k}`)])) as Record<keyof Pose, HTMLInputElement>;
const value = Object.fromEntries(keys.map((k) => [k, $(`v-${k}`)])) as Record<keyof Pose, HTMLElement>;
const degrees = (r: number) => `${Math.round((r * 180) / Math.PI)}°`;

function showSliders() {
  for (const k of keys) slider[k].value = String(pose[k]);
  value.x.textContent = pose.x.toFixed(2);
  value.y.textContent = pose.y.toFixed(2);
  value.h.textContent = `×${(pose.h + R).toFixed(2)}`; // scale factor of the dilation
  value.yaw.textContent = degrees(pose.yaw);
  value.pitch.textContent = degrees(pose.pitch);
}

for (const k of keys) {
  slider[k].addEventListener("input", () => {
    animator.stop();
    setPressed(null);
    pose = { ...pose, [k]: parseFloat(slider[k].value) };
    showSliders();
    dirty = true;
  });
}

// ---------- preset buttons ----------
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const animator = new Animator(reduceMotion);
const presetButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-preset]"));
let pressed: string | null = null;

function setPressed(name: string | null) {
  pressed = name;
  for (const b of presetButtons) b.setAttribute("aria-pressed", String(b.dataset.preset === name));
}

for (const b of presetButtons) {
  b.addEventListener("click", () => {
    const name = b.dataset.preset!;
    const now = performance.now();
    if (name === "tour") {
      animator.play(pose, [{ to: REST, holdMs: 300 }, ...TOUR], now);
      setPressed("tour");
    } else {
      animator.moveTo(pose, PRESETS[name as PresetName], now);
      setPressed(name === "reset" ? null : name);
    }
  });
}

// ---------- camera ----------
const target = new Vector3(0, 0, 0.35);
let orbit: Orbit = { ...VIEWS.angled };
let orbitMove: { from: Orbit; to: Orbit; start: number } | null = null;

function placeCamera() {
  const { az, el, dist } = orbit;
  world.camera.position.set(
    target.x + dist * Math.cos(el) * Math.cos(az),
    target.y + dist * Math.cos(el) * Math.sin(az),
    target.z + dist * Math.sin(el),
  );
  world.camera.lookAt(target);
}

const viewButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-view]"));
const setView = (name: string | null) => {
  for (const b of viewButtons) b.setAttribute("aria-pressed", String(b.dataset.view === name));
};
for (const b of viewButtons) {
  b.addEventListener("click", () => {
    orbitMove = { from: { ...orbit }, to: VIEWS[b.dataset.view as ViewName], start: performance.now() };
    setView(b.dataset.view!);
  });
}
setView("angled");

// Drag to orbit, pinch or scroll to zoom.
const pointers = new Map<number, { x: number; y: number }>();
let pinch = 0;
const spread = () => {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  orbitMove = null;
  if (pointers.size === 2) pinch = spread();
});
canvas.addEventListener("pointermove", (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    orbit = clampOrbit({ ...orbit, az: orbit.az - (e.clientX - prev.x) * 0.008, el: orbit.el + (e.clientY - prev.y) * 0.006 });
  } else if (pointers.size === 2) {
    const d = spread();
    if (pinch > 0) orbit = clampOrbit({ ...orbit, dist: orbit.dist * (pinch / d) });
    pinch = d;
  }
  setView(null);
  dirty = true;
});
const release = (e: PointerEvent) => {
  pointers.delete(e.pointerId);
  pinch = 0;
};
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    orbit = clampOrbit({ ...orbit, dist: orbit.dist * Math.exp(e.deltaY * 0.001) });
    dirty = true;
  },
  { passive: false },
);

// ---------- render loop ----------
// We only redraw when something changed, which keeps phones cool.
function frame(now: number) {
  if (world.resize()) dirty = true;

  const next = animator.tick(pose, now);
  if (next) {
    pose = next;
    showSliders();
    dirty = true;
  } else if (!animator.busy && pressed === "tour") {
    setPressed(null);
  }

  if (orbitMove) {
    const t = Math.min(1, (now - orbitMove.start) / (reduceMotion ? 1 : 900));
    const k = ease(t);
    const { from, to } = orbitMove;
    orbit = {
      az: from.az + (to.az - from.az) * k,
      el: from.el + (to.el - from.el) * k,
      dist: from.dist + (to.dist - from.dist) * k,
    };
    if (t >= 1) orbitMove = null;
    dirty = true;
  }

  if (dirty) {
    showFormula(world.setPose(pose));
    placeCamera();
    world.renderer.render(world.scene, world.camera);
    dirty = false;
  }
  requestAnimationFrame(frame);
}

applyTheme();
showSliders();
requestAnimationFrame(frame);
