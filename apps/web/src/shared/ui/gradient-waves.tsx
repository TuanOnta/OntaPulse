import { Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef } from "react";

export type GradientWavesDetail = "low" | "medium" | "high";

export type GradientWavesProps = {
  amplitude?: number;
  brightness?: number;
  className?: string;
  crestColor?: string;
  detail?: GradientWavesDetail;
  fogDepth?: number;
  grain?: boolean;
  grainIntensity?: number;
  height?: number;
  horizonColor?: string;
  mouseInteraction?: boolean;
  opacity?: number;
  parallaxStrength?: number;
  speed?: number;
  swell?: number;
  tilt?: number;
  turbulence?: number;
  waveColor?: string;
  waveRatio?: number;
  waveScale?: number;
  zoom?: number;
};

type WavesContext = { mesh: Mesh; program: Program; renderer: Renderer };
const contexts = new WeakMap<HTMLDivElement, WavesContext>();

const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime, uSpeed, uAmplitude, uWaveScale, uWaveRatio, uSwell, uTurbulence, uTilt, uZoom, uHeight, uFogDepth, uSteps, uBrightness, uOpacity, uGrain, uGrainIntensity, uParallax;
uniform vec2 uMouse;
uniform bool uEnableMouse;
uniform vec3 uHorizonColor, uWaveColor, uCrestColor;
out vec4 fragColor;
const float MAX_DIST = 20000.0;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float plasma(vec3 r, vec2 freq, vec4 tc) {
  float mx = r.x + tc.x;
  mx += uSwell * sin((r.y + mx) / 20.0 + tc.y);
  float my = r.y - tc.z;
  my += uTurbulence * cos(r.x / 23.0 + tc.w);
  return r.z - (sin(mx * freq.x) * uAmplitude + sin(my * freq.y) * uAmplitude + uHeight);
}
float raymarch(vec3 pos, vec3 dir, vec2 freq, vec4 tc) {
  float dist = 0.0;
  for (int i = 0; i < 128; i++) {
    if (float(i) >= uSteps) break;
    float dscene = plasma(pos + dist * dir, freq, tc);
    if (abs(dscene) < 0.1) break;
    dist += 0.9 * dscene;
    if (!(abs(dist) < MAX_DIST)) return MAX_DIST;
  }
  return dist;
}
void main() {
  float T = iTime * uSpeed;
  vec2 freq = vec2(uWaveScale / 7.0, (uWaveScale * uWaveRatio) / 3.0);
  vec4 tc = vec4(T / 0.130, T / 0.810, T / 0.200, T / 0.710);
  float c, s;
  float vfov = (3.14159 / 2.3) / max(uZoom, 0.05);
  vec3 cam = vec3(0.0, 0.0, 30.0);
  vec2 uv = (gl_FragCoord.xy / iResolution.xy) - 0.5;
  uv.x *= iResolution.x / iResolution.y;
  uv.y *= -1.0;
  vec3 dir = vec3(0.0, 0.0, -1.0);
  float ulen = length(uv);
  float xrot = vfov * ulen;
  c = cos(xrot); s = sin(xrot);
  dir = mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c) * dir;
  vec2 nuv = ulen > 1e-5 ? uv / ulen : vec2(1.0, 0.0);
  c = nuv.x; s = nuv.y;
  dir = mat3(c,-s,0.0, s,c,0.0, 0.0,0.0,1.0) * dir;
  c = cos(uTilt); s = sin(uTilt);
  dir = mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c) * dir;
  if (uEnableMouse) {
    float yaw = (uMouse.x - 0.5) * uParallax * 0.4;
    float pitch = (uMouse.y - 0.5) * uParallax * 0.4;
    c = cos(yaw); s = sin(yaw);
    dir = mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c) * dir;
    c = cos(pitch); s = sin(pitch);
    dir = mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c) * dir;
  }
  float dist = raymarch(cam, dir, freq, tc);
  vec3 pos = cam + dist * dir;
  float fog = clamp(uFogDepth / max(dist, 0.001), 0.0, 1.0);
  vec3 body = mix(uWaveColor, uCrestColor, clamp(pos.z * 0.08 + 0.5, 0.0, 1.0));
  vec3 col = clamp(mix(uHorizonColor, body, fog) * uBrightness, 0.0, 1.0);
  float alpha = fog * uOpacity;
  if (uGrain > 0.5) alpha += (hash21(gl_FragCoord.xy + mod(iTime, 64.0) * 11.0) - 0.5) * uGrainIntensity;
  alpha = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(col * alpha, alpha);
}
`;

function colorFromHex(hex: string): [number, number, number] {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return [1, 1, 1];
  return [
    Number.parseInt(match[1], 16) / 255,
    Number.parseInt(match[2], 16) / 255,
    Number.parseInt(match[3], 16) / 255,
  ];
}

function detailToSteps(detail: GradientWavesDetail) {
  return detail === "low" ? 40 : detail === "high" ? 110 : 70;
}

export function GradientWaves({
  amplitude = 2.5,
  brightness = 1,
  className = "",
  crestColor = "#d8f5e5",
  detail = "medium",
  fogDepth = 15,
  grain = true,
  grainIntensity = 0.05,
  height = 5.5,
  horizonColor = "#143c34",
  mouseInteraction = true,
  opacity = 1,
  parallaxStrength = 0.5,
  speed = 0.4,
  swell = 35,
  tilt = 1.11,
  turbulence = 20,
  waveColor = "#4dd5a2",
  waveRatio = 0.9,
  waveScale = 0.6,
  zoom = 1,
}: GradientWavesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseEnabled = useRef(mouseInteraction);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.background =
      "radial-gradient(circle at 50% 35%, #1b5144 0%, #163d34 48%, #102a25 100%)";

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        webgl: 2,
      });
    } catch {
      return;
    }
    const gl = renderer.gl;
    const canvas = gl.canvas;
    canvas.style.cssText = "display:block;height:100%;width:100%;pointer-events:none";
    gl.clearColor(0, 0, 0, 0);
    container.appendChild(canvas);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uSpeed: { value: speed },
        uAmplitude: { value: amplitude },
        uWaveScale: { value: waveScale },
        uWaveRatio: { value: waveRatio },
        uSwell: { value: swell },
        uTurbulence: { value: turbulence },
        uTilt: { value: tilt },
        uZoom: { value: zoom },
        uHeight: { value: height },
        uFogDepth: { value: fogDepth },
        uSteps: { value: detailToSteps(detail) },
        uBrightness: { value: brightness },
        uOpacity: { value: opacity },
        uGrain: { value: grain ? 1 : 0 },
        uGrainIntensity: { value: grainIntensity },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uParallax: { value: parallaxStrength },
        uEnableMouse: { value: mouseInteraction },
        uHorizonColor: { value: new Float32Array(colorFromHex(horizonColor)) },
        uWaveColor: { value: new Float32Array(colorFromHex(waveColor)) },
        uCrestColor: { value: new Float32Array(colorFromHex(crestColor)) },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    contexts.set(container, { mesh, program, renderer });

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
      const resolution = program.uniforms.iResolution.value as Float32Array;
      resolution[0] = gl.drawingBufferWidth;
      resolution[1] = gl.drawingBufferHeight;
      renderer.render({ scene: mesh });
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const currentMouse: [number, number] = [0.5, 0.5];
    const targetMouse: [number, number] = [0.5, 0.5];
    const pointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      targetMouse[0] = inside ? (event.clientX - rect.left) / rect.width : 0.5;
      targetMouse[1] = inside ? 1 - (event.clientY - rect.top) / rect.height : 0.5;
    };
    window.addEventListener("pointermove", pointerMove, { passive: true });

    let frame = 0;
    let pageVisible = !document.hidden;
    let inViewport = true;
    const startedAt = performance.now();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const render = (time: number) => {
      const uniforms = program.uniforms;
      uniforms.iTime.value = (time - startedAt) * 0.001;
      const targetX = mouseEnabled.current ? targetMouse[0] : 0.5;
      const targetY = mouseEnabled.current ? targetMouse[1] : 0.5;
      currentMouse[0] += (targetX - currentMouse[0]) * 0.05;
      currentMouse[1] += (targetY - currentMouse[1]) * 0.05;
      const mouse = uniforms.uMouse.value as Float32Array;
      mouse[0] = currentMouse[0];
      mouse[1] = currentMouse[1];
      renderer.render({ scene: mesh });
      frame = requestAnimationFrame(render);
    };
    const start = () => {
      if (frame === 0 && pageVisible && inViewport && !reduceMotion.matches)
        frame = requestAnimationFrame(render);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      inViewport ? start() : stop();
    });
    const pageVisibility = () => {
      pageVisible = !document.hidden;
      pageVisible ? start() : stop();
    };
    const motionChange = () => {
      stop();
      renderer.render({ scene: mesh });
      start();
    };
    observer.observe(container);
    document.addEventListener("visibilitychange", pageVisibility);
    reduceMotion.addEventListener("change", motionChange);
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      observer.disconnect();
      window.removeEventListener("pointermove", pointerMove);
      document.removeEventListener("visibilitychange", pageVisibility);
      reduceMotion.removeEventListener("change", motionChange);
      contexts.delete(container);
      canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const context = container ? contexts.get(container) : undefined;
    if (!context) return;
    const uniforms = context.program.uniforms;
    mouseEnabled.current = mouseInteraction;
    uniforms.uSpeed.value = speed;
    uniforms.uAmplitude.value = amplitude;
    uniforms.uWaveScale.value = waveScale;
    uniforms.uWaveRatio.value = waveRatio;
    uniforms.uSwell.value = swell;
    uniforms.uTurbulence.value = turbulence;
    uniforms.uTilt.value = tilt;
    uniforms.uZoom.value = zoom;
    uniforms.uHeight.value = height;
    uniforms.uFogDepth.value = fogDepth;
    uniforms.uSteps.value = detailToSteps(detail);
    uniforms.uBrightness.value = brightness;
    uniforms.uOpacity.value = opacity;
    uniforms.uGrain.value = grain ? 1 : 0;
    uniforms.uGrainIntensity.value = grainIntensity;
    uniforms.uParallax.value = parallaxStrength;
    uniforms.uEnableMouse.value = mouseInteraction;
    (uniforms.uHorizonColor.value as Float32Array).set(colorFromHex(horizonColor));
    (uniforms.uWaveColor.value as Float32Array).set(colorFromHex(waveColor));
    (uniforms.uCrestColor.value as Float32Array).set(colorFromHex(crestColor));
  }, [
    amplitude,
    brightness,
    crestColor,
    detail,
    fogDepth,
    grain,
    grainIntensity,
    height,
    horizonColor,
    mouseInteraction,
    opacity,
    parallaxStrength,
    speed,
    swell,
    tilt,
    turbulence,
    waveColor,
    waveRatio,
    waveScale,
    zoom,
  ]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`relative size-full overflow-hidden ${className}`}
    />
  );
}
