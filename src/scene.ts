/**
 * The Three.js scene: plane, sphere, the lamp, and markers for 0 and ∞.
 *
 * Nothing here knows about Möbius formulas. It takes a Pose, places the
 * sphere, and hands the shaders what they need. The math lives in riemann.ts.
 */

import * as THREE from "three";
import { type Complex, abs } from "./complex";
import { type Pose, R, mobiusOf, rotationOf } from "./riemann";
import { planeFragment, planeVertex, sphereFragment, sphereVertex } from "./shaders";

// The shaders output colors exactly as written, the way most math visualizations
// expect. Turning off color management keeps Three.js from converting them.
THREE.ColorManagement.enabled = false;

const ZERO_COLOR = 0xd9342b;
const LAMP_COLOR = 0xffc93c;

export interface SceneParts {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Move the sphere and markers to a pose. Returns the matching Möbius formula. */
  setPose(p: Pose): ReturnType<typeof mobiusOf>;
  /** Re-read colors from the page's CSS variables (light/dark theme). */
  applyTheme(css: (name: string) => string): void;
  /** Resize to the canvas's CSS size. Returns true if it changed. */
  resize(): boolean;
}

export function createScene(canvas: HTMLCanvasElement): SceneParts {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  camera.up.set(0, 0, 1); // z-up, to match the math

  // --- the plane: a big quad at z = 0, painted entirely by its shader ---
  const planeUniforms = {
    uCenter: { value: new THREE.Vector3() },
    uRadius: { value: R },
    uWorldToBody: { value: new THREE.Matrix3() },
    uBackground: { value: new THREE.Color() },
    uOutside: { value: new THREE.Color() },
  };
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.ShaderMaterial({ uniforms: planeUniforms, vertexShader: planeVertex, fragmentShader: planeFragment }),
  );
  scene.add(plane);

  // --- the sphere: its pattern lives in body coordinates, so the mesh just moves ---
  const sphereUniforms = { uRadius: { value: R }, uOutside: { value: new THREE.Color() } };
  const sphereGeometry = new THREE.SphereGeometry(R, 128, 96);
  sphereGeometry.rotateX(Math.PI / 2); // Three's spheres have poles on y; ours are on z
  const sphere = new THREE.Mesh(
    sphereGeometry,
    new THREE.ShaderMaterial({ uniforms: sphereUniforms, vertexShader: sphereVertex, fragmentShader: sphereFragment }),
  );
  scene.add(sphere);

  // --- markers ---
  const dot = (color: number, size: number) =>
    new THREE.Mesh(new THREE.SphereGeometry(size, 20, 14), new THREE.MeshBasicMaterial({ color }));

  // Painted on the sphere: its "0" (south pole at rest) and its "∞" (north pole at rest).
  const bodyZero = dot(ZERO_COLOR, 0.03);
  bodyZero.position.set(0, 0, -R * 1.01);
  const bodyInfinity = dot(0x000000, 0.03);
  bodyInfinity.position.set(0, 0, R * 1.01);
  sphere.add(bodyZero, bodyInfinity);

  // The lamp is always the sphere's current top point, whichever way it's turned.
  const lamp = dot(LAMP_COLOR, 0.04);
  scene.add(lamp);

  // Where 0 and ∞ land on the plane, i.e. T(0) and T(∞).
  const planeZero = dot(ZERO_COLOR, 0.035);
  const planeInfinity = dot(0x000000, 0.035);
  scene.add(planeZero, planeInfinity);

  // Light rays from the lamp through each marker to its shadow.
  const ray = (color: number) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
    scene.add(line);
    return line;
  };
  const rayZero = ray(ZERO_COLOR);
  const rayInfinity = ray(0x000000);

  const placeOnPlane = (marker: THREE.Mesh, w: Complex | null): THREE.Vector3 | null => {
    const visible = w !== null && abs(w) < 40;
    marker.visible = visible;
    if (!visible) return null;
    marker.position.set(w.re, w.im, 0.004);
    return marker.position.clone();
  };

  const setRay = (line: THREE.Line, from: THREE.Vector3, to: THREE.Vector3 | null) => {
    line.visible = to !== null;
    if (!to) return;
    const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  };

  function setPose(p: Pose) {
    const rotation = rotationOf(p);
    sphere.position.set(p.x, p.y, p.h);
    sphere.quaternion.setFromRotationMatrix(rotation);
    sphere.updateMatrixWorld();

    planeUniforms.uCenter.value.set(p.x, p.y, p.h);
    // A rotation's inverse is its transpose.
    planeUniforms.uWorldToBody.value.setFromMatrix4(rotation).transpose();

    const top = new THREE.Vector3(p.x, p.y, p.h + R);
    lamp.position.copy(top);

    const m = mobiusOf(p);
    setRay(rayZero, top, placeOnPlane(planeZero, m.zeroTo));
    setRay(rayInfinity, top, placeOnPlane(planeInfinity, m.infinityTo));
    // When the sphere's ∞ sits right at the lamp there's no ray to draw.
    if (bodyInfinity.getWorldPosition(new THREE.Vector3()).distanceTo(top) < 0.02) rayInfinity.visible = false;
    return m;
  }

  function applyTheme(css: (name: string) => string) {
    const background = new THREE.Color(css("--scene-bg"));
    renderer.setClearColor(background);
    planeUniforms.uBackground.value.copy(background);
    planeUniforms.uOutside.value.set(css("--paper"));
    sphereUniforms.uOutside.value.set(css("--shell"));
    // ∞ is drawn in the page's ink color so it stays visible in dark mode.
    const ink = new THREE.Color(css("--ray"));
    for (const m of [bodyInfinity, planeInfinity]) (m.material as THREE.MeshBasicMaterial).color.copy(ink);
    (rayInfinity.material as THREE.LineBasicMaterial).color.copy(ink);
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(box.width));
    const h = Math.max(1, Math.round(box.height));
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x === w && size.y === h) return false;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return true;
  }

  return { renderer, scene, camera, setPose, applyTheme, resize };
}
