import { MAX_ARCS, MAX_PULSES } from "./scene-config";

/*
 * GLSL for the signal orb. Rule: `#include <colorspace_fragment>` must stay on its own line, or the
 * shader fails to compile and that object silently does not draw.
 */

/**
 * Dot-matrix sphere with GPU scan ripples.
 * Uniforms:
 *  uIntro    0..1 intro fly-in of the dots
 *  uSize     world-space dot size (tier dependent)
 *  uScalePx  pixels per world unit at depth 1 (drawingBufferHeight / (2 * tan(fov / 2)))
 *  uBright   overall brightness (dims while QUEUED)
 *  uAccent, uBase, uLight   accent color, base dot color, key light direction
 *  uPulseA[i]  xyz = origin direction, w = progress k in 0..1 (-1 = off)
 *  uPulseB[i]  rgb = ripple color, w = max angle (> 2.0 marks a hub pulse)
 */
export const DOT_VERT = /* glsl */ `
  uniform float uIntro, uSize, uScalePx, uBright;
  uniform vec3 uAccent, uBase, uLight;
  uniform vec4 uPulseA[${MAX_PULSES}];
  uniform vec4 uPulseB[${MAX_PULSES}];
  attribute float aRand;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec3 n = normalize(position);
    float intensity = 0.0; vec3 tint = vec3(0.0);
    for (int i = 0; i < ${MAX_PULSES}; i++) {
      vec4 A = uPulseA[i]; vec4 B = uPulseB[i];
      if (A.w < 0.0) continue;
      float k = A.w;
      float front = (1.0 - pow(1.0 - k, 2.0)) * B.w;
      float width = B.w > 2.0 ? 0.10 : 0.07;
      float th = acos(clamp(dot(n, A.xyz), -1.0, 1.0));
      float d = (th - front) / width;
      float it = exp(-d * d) * pow(1.0 - k, 1.3);
      intensity += it; tint += B.rgb * it;
    }
    intensity = min(intensity, 1.6);
    vec3 p = n * (1.0 + 0.035 * intensity);
    p *= 1.0 + (1.0 - uIntro) * (aRand * 1.6 - 0.2);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 vV = normalize(-mv.xyz);
    vec3 vN = normalize(normalMatrix * n);
    float facing = dot(vN, vV);
    float rim = pow(1.0 - clamp(facing, 0.0, 1.0), 2.5);
    float light = max(dot(normalize(mat3(modelMatrix) * n), uLight), 0.0);

    vec3 col = uBase * (0.40 + 0.85 * light) + uAccent * 0.40 * rim * (0.4 + light);
    col += tint * 1.9 + vec3(0.22) * intensity;
    vColor = col * uBright;
    vAlpha = uIntro * (0.6 + 0.4 * light + 0.5 * rim);

    float s = length(modelMatrix[0].xyz);
    float size = uSize * (1.0 + 2.4 * intensity) * (0.7 + 0.3 * aRand);
    gl_PointSize = facing < -0.04 ? 0.0 : size * s * uScalePx / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

export const DOT_FRAG = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.18, d);
    gl_FragColor = vec4(vColor, a * vAlpha);
    #include <colorspace_fragment>
  }`;

/** Soft round sprites (beacon glow, request packets, ring ticks). uScalePx as above; uAlpha global alpha. */
export const SPRITE_VERT = /* glsl */ `
  attribute float aSize; attribute vec3 aColor;
  uniform float uScalePx; varying vec3 vC;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * length(modelMatrix[0].xyz) * uScalePx / -mv.z;
    vC = aColor;
  }`;

export const SPRITE_FRAG = /* glsl */ `
  uniform float uAlpha; varying vec3 vC;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = exp(-d * d * 3.5) * (1.0 - smoothstep(0.85, 1.0, d));
    gl_FragColor = vec4(vC, a * uAlpha);
    #include <colorspace_fragment>
  }`;

/**
 * Hub -> beacon arcs with a travelling packet glow.
 * Uniforms: uProg[i] packet progress on arc i (-1 = idle), uArcCol[i] packet color, uVis overall
 * visibility, uLineCol resting line color. aT = position along the arc 0..1, aIdx = arc index.
 */
export const ARC_VERT = /* glsl */ `
  attribute float aT; attribute float aIdx;
  uniform float uProg[${MAX_ARCS}]; uniform vec3 uArcCol[${MAX_ARCS}];
  uniform float uVis; uniform vec3 uLineCol;
  varying vec3 vC; varying float vA;
  void main() {
    int i = int(aIdx + 0.5);
    float p = uProg[i];
    float d = p - aT;
    float on = p >= 0.0 ? 1.0 : 0.0;
    float trail = (d > 0.0 ? exp(-d * 7.0) : 0.0) * on;
    float head = exp(-(d * d) / 0.0008) * on;
    float glow = clamp(trail * 0.6 + head, 0.0, 1.0);
    vA = (0.15 + glow * 0.9) * uVis;
    vC = mix(uLineCol, uArcCol[i], glow);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

export const ARC_FRAG = /* glsl */ `
  varying vec3 vC; varying float vA;
  void main() {
    gl_FragColor = vec4(vC, vA);
    #include <colorspace_fragment>
  }`;

/** Opaque core sphere: hides the far side of the dots. Uniforms: uBase core tone, uAccent rim, uLight. */
export const CORE_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    vW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * mv;
  }`;

export const CORE_FRAG = /* glsl */ `
  uniform vec3 uBase, uAccent, uLight; varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() {
    float facing = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
    float rim = pow(1.0 - facing, 3.0);
    float light = max(dot(normalize(vW), uLight), 0.0);
    gl_FragColor = vec4(uBase * (0.7 + 1.4 * light) + uAccent * rim * 0.13, 1.0);
    #include <colorspace_fragment>
  }`;

/** Inner-glow halo (back faces, additive). Uniforms: uColor, uStrength (dims while QUEUED). */
export const ATMO_VERT = /* glsl */ `
  varying vec3 vN;
  void main() {
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

export const ATMO_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uStrength; varying vec3 vN;
  void main() {
    float i = pow(max(0.62 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), 2.6) * uStrength;
    gl_FragColor = vec4(uColor, clamp(i, 0.0, 1.0));
    #include <colorspace_fragment>
  }`;
