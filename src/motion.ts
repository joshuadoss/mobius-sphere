/**
 * Animation: smooth moves between poses, the guided tour, and the camera orbit.
 */

import { type Pose, REST } from "./riemann";

/** Ease in and out (cubic), so moves start and stop gently. */
export const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Blend two poses. Moving every slider at once is still a rigid motion of the
 * sphere, so every in-between frame is itself a Möbius transformation.
 */
export const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  h: lerp(a.h, b.h, t),
  yaw: lerp(a.yaw, b.yaw, t),
  pitch: lerp(a.pitch, b.pitch, t),
});

/** The four basic moves from the video, plus one that mixes them. */
export const PRESETS = {
  translate: { ...REST, x: 0.9, y: 0.45 }, // slide:   z + b
  dilate: { ...REST, h: 1.4 }, //                 raise:   k·z with k = h + ½
  rotate: { ...REST, yaw: Math.PI / 2 }, //       spin:    i·z
  invert: { ...REST, pitch: Math.PI }, //         tip:     1/z
  combo: { x: 0.45, y: -0.35, h: 0.95, yaw: 0.9, pitch: 2.1 },
  reset: { ...REST },
} satisfies Record<string, Pose>;

export type PresetName = keyof typeof PRESETS;

/** Each move, then back to rest, like the original video. */
export const TOUR: { to: Pose; holdMs: number }[] = [
  { to: PRESETS.translate, holdMs: 900 },
  { to: REST, holdMs: 500 },
  { to: PRESETS.dilate, holdMs: 900 },
  { to: REST, holdMs: 500 },
  { to: PRESETS.rotate, holdMs: 900 },
  { to: REST, holdMs: 500 },
  { to: PRESETS.invert, holdMs: 1200 },
  { to: REST, holdMs: 500 },
  { to: PRESETS.combo, holdMs: 1200 },
  { to: REST, holdMs: 0 },
];

/**
 * Plays moves one after another. Call tick() every frame; it returns the pose
 * to show, or null when nothing is animating.
 */
export class Animator {
  private from: Pose = REST;
  private to: Pose = REST;
  private start = 0;
  private duration = 0;
  private queue: { to: Pose; holdMs: number }[] = [];
  private holdMs = 0;
  private waitUntil = 0;
  private moving = false;

  constructor(private readonly reduceMotion: boolean) {}

  get busy(): boolean {
    return this.moving || this.queue.length > 0;
  }

  /** Animate from the current pose to one target. */
  moveTo(current: Pose, to: Pose, now: number, ms = 1600): void {
    this.queue = [];
    this.begin(current, to, now, ms);
    this.holdMs = 0;
  }

  /** Play a sequence of moves. */
  play(current: Pose, steps: { to: Pose; holdMs: number }[], now: number): void {
    this.queue = [...steps];
    const first = this.queue.shift()!;
    this.begin(current, first.to, now, 1400);
    this.holdMs = first.holdMs;
  }

  stop(): void {
    this.queue = [];
    this.moving = false;
  }

  tick(current: Pose, now: number): Pose | null {
    if (this.moving) {
      const t = Math.min(1, (now - this.start) / this.duration);
      if (t >= 1) {
        this.moving = false;
        this.waitUntil = now + this.holdMs;
      }
      return lerpPose(this.from, this.to, ease(t));
    }
    if (this.queue.length && now >= this.waitUntil) {
      const next = this.queue.shift()!;
      this.begin(current, next.to, now, 1400);
      this.holdMs = next.holdMs;
      return current;
    }
    return null;
  }

  private begin(current: Pose, to: Pose, now: number, ms: number) {
    this.from = { ...current };
    this.to = { ...to };
    this.start = now;
    this.duration = this.reduceMotion ? 1 : ms;
    this.moving = true;
  }
}

/** Camera position on a sphere around a target: azimuth, elevation, distance. */
export interface Orbit {
  az: number;
  el: number;
  dist: number;
}

export const VIEWS = {
  angled: { az: -1.95, el: 0.52, dist: 6.2 },
  top: { az: -Math.PI / 2, el: 1.5, dist: 7.5 },
  side: { az: -Math.PI / 2, el: 0.1, dist: 6.5 },
} satisfies Record<string, Orbit>;

export type ViewName = keyof typeof VIEWS;

export const clampOrbit = (o: Orbit): Orbit => ({
  az: o.az,
  el: Math.min(1.5, Math.max(0.08, o.el)),
  dist: Math.min(16, Math.max(2.2, o.dist)),
});
