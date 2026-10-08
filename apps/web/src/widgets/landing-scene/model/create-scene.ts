import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Quaternion,
  RGBAFormat,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";

import {
  ARC_SEGMENTS,
  ARRIVAL,
  CAMERA_Z,
  DPR_SCALE_MIN,
  DPR_STEP,
  HUB_DIR,
  HUB_PULSE,
  IDLE_FRAME_SECONDS,
  IDLE_THROTTLE_FROM,
  INTRO_SECONDS,
  KEYFRAMES,
  LIGHT_DIR,
  MAX_ARCS,
  MAX_PULSES,
  NARROW_BELOW,
  PACKET,
  SCENE_COLORS,
  SCENE_SEED,
  SLOW_FRAME_SECONDS,
  SLOW_FRAMES_BEFORE_DROP,
  TIERS,
  TRAIL,
  type Keyframe,
  type SceneTier,
} from "./scene-config";
import {
  clamp,
  lerp,
  lifecycleWeightsInto,
  mulberry32,
  sampleKeyframes,
  smooth,
  type LifecycleWeights,
} from "./scroll-progress";
import {
  ARC_FRAG,
  ARC_VERT,
  ATMO_FRAG,
  ATMO_VERT,
  CORE_FRAG,
  CORE_VERT,
  DOT_FRAG,
  DOT_VERT,
  SPRITE_FRAG,
  SPRITE_VERT,
} from "./shaders";

/** Resolved `--color-landing-*` token values, read by the React side and handed in. */
export type SceneColors = {
  accent: string;
  info: string;
  warn: string;
  danger: string;
  muted: string;
};

export type SceneStats = {
  tier: SceneTier;
  dpr: number;
  fps: number;
  f: number;
  q: number;
  r: number;
  d: number;
  calls: number;
  triangles: number;
  points: number;
  beacons: number;
  throttled: boolean;
};

export type SceneOptions = {
  tier: SceneTier;
  reduced: boolean;
  colors: SceneColors;
  onFirstFrame?: () => void;
  onContextLost?: () => void;
  /** Called about every 10 frames with a reused object. Used by the dev HUD only. */
  onStats?: (stats: SceneStats) => void;
};

export type LandingScene = {
  start: () => void;
  stop: () => void;
  /** Viewport size in CSS pixels and the device pixel ratio. */
  resize: (width: number, height: number, devicePixelRatio: number) => void;
  setScroll: (f: number) => void;
  setReduced: (reduced: boolean) => void;
  /** Pointer position in the range -1..1 on both axes (parallax, high tier only). */
  setPointer: (x: number, y: number) => void;
  dispose: () => void;
};

const GOLDEN = 2.399963229728653;
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const STATS_EVERY_FRAMES = 10;

type Beacon = {
  hub: boolean;
  kind: "hub" | "ok" | "warn" | "danger";
  dir: Vector3;
  ang: number;
  flash: number;
  touch: number;
  h: number;
  result: Color;
  qY: Quaternion;
  qZ: Quaternion;
};

type PulseSlot = {
  active: boolean;
  k: number;
  dur: number;
  dir: Vector3;
  color: Color;
  maxA: number;
  prevFront: number;
  hub: boolean;
};

type Sprites = {
  pts: Points;
  geo: BufferGeometry;
  pos: Float32Array;
  col: Float32Array;
  size: Float32Array;
  aPos: BufferAttribute;
  aCol: BufferAttribute;
  aSize: BufferAttribute;
};

type Disposable = { dispose: () => void };

/** Creates the scene on `canvas`, or returns null when WebGL is unavailable. */
export function createLandingScene(
  canvas: HTMLCanvasElement,
  { tier, reduced, colors, onFirstFrame, onContextLost, onStats }: SceneOptions,
): LandingScene | null {
  const cfg = TIERS[tier];
  const C = {
    accent: new Color(colors.accent),
    info: new Color(colors.info),
    warn: new Color(colors.warn),
    danger: new Color(colors.danger),
    muted: new Color(colors.muted),
    dot: new Color(SCENE_COLORS.dot),
    core: new Color(SCENE_COLORS.core),
    neutral: new Color(SCENE_COLORS.neutral),
    white: new Color(1, 1, 1),
  };

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: cfg.antialias,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(cfg.fov, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_Z);
  const orb = new Group();
  scene.add(orb);

  const state = {
    running: false,
    reduced,
    time: 0,
    f: 0.5,
    fTarget: 0.5,
    narrow: false,
    width: 1,
    height: 1,
    devicePixelRatio: 1,
    dprScale: 1,
    ema: 1 / 60,
    slow: 0,
    introT: reduced ? 1 : 0,
    firstFrame: false,
    disposed: false,
    hubClock: HUB_PULSE.interval[0] - 0.5,
    mouse: new Vector2(),
    mouseS: new Vector2(),
    opacity: -1,
  };
  const disposables: Disposable[] = [];
  const track = <T extends Disposable>(o: T): T => {
    disposables.push(o);
    return o;
  };
  const rand = mulberry32(SCENE_SEED);
  const uScalePx = { value: 1 };
  const lightDir = new Vector3(...LIGHT_DIR).normalize();

  /* ---------- core (occludes the far side) ---------- */
  const core = new Mesh(
    track(new SphereGeometry(0.985, 48, 32)),
    track(
      new ShaderMaterial({
        uniforms: {
          uBase: { value: C.core },
          uAccent: { value: C.accent },
          uLight: { value: lightDir },
        },
        vertexShader: CORE_VERT,
        fragmentShader: CORE_FRAG,
      }),
    ),
  );
  orb.add(core);

  /* ---------- atmosphere (inner glow halo) ---------- */
  const atmoMat = track(
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: BackSide,
      blending: AdditiveBlending,
      uniforms: { uColor: { value: C.accent }, uStrength: { value: 0.2 } },
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
    }),
  );
  orb.add(new Mesh(track(new SphereGeometry(1.2, 48, 32)), atmoMat));

  /* ---------- dots (GPU ripples live in DOT_VERT) ---------- */
  const dotPos = new Float32Array(cfg.dots * 3);
  const dotRand = new Float32Array(cfg.dots);
  for (let i = 0; i < cfg.dots; i++) {
    const y = 1 - (2 * (i + 0.5)) / cfg.dots;
    const r = Math.sqrt(1 - y * y);
    const th = i * GOLDEN;
    dotPos[i * 3] = Math.cos(th) * r;
    dotPos[i * 3 + 1] = y;
    dotPos[i * 3 + 2] = Math.sin(th) * r;
    dotRand[i] = rand();
  }
  const dotGeo = track(new BufferGeometry());
  dotGeo.setAttribute("position", new BufferAttribute(dotPos, 3));
  dotGeo.setAttribute("aRand", new BufferAttribute(dotRand, 1));
  const pulseA = Array.from({ length: MAX_PULSES }, () => new Vector4(0, 0, 1, -1));
  const pulseB = Array.from({ length: MAX_PULSES }, () => new Vector4(0, 0, 0, 0));
  const dotMat = track(
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uIntro: { value: reduced ? 1 : 0 },
        uSize: { value: cfg.dotSize },
        uScalePx,
        uBright: { value: 1 },
        uAccent: { value: C.accent },
        uBase: { value: C.dot },
        uLight: { value: lightDir },
        uPulseA: { value: pulseA },
        uPulseB: { value: pulseB },
      },
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
    }),
  );
  const dots = new Points(dotGeo, dotMat);
  dots.frustumCulled = false;
  orb.add(dots);

  /* ---------- beacons: hub + status targets ---------- */
  const hubDir = new Vector3(...HUB_DIR).normalize();
  const resultOf = (kind: Beacon["kind"]): Color =>
    kind === "warn" ? C.warn : kind === "danger" ? C.danger : C.accent;
  const beacons: Beacon[] = [
    {
      hub: true,
      kind: "hub",
      dir: hubDir.clone(),
      ang: 0,
      flash: 0,
      touch: 0,
      h: 0.2,
      result: C.accent.clone(),
      qY: new Quaternion(),
      qZ: new Quaternion(),
    },
  ];
  for (let guard = 0; beacons.length < cfg.targets + 1 && guard < 5000; guard++) {
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const d = new Vector3(s * Math.cos(a), u, s * Math.sin(a));
    const ang = Math.acos(clamp(d.dot(hubDir), -1, 1));
    if (ang < 0.5 || ang > 1.7) continue;
    if (beacons.some((b) => Math.acos(clamp(b.dir.dot(d), -1, 1)) < 0.34)) continue;
    const idx = beacons.length - 1;
    const kind: Beacon["kind"] = idx % 6 === 2 ? "warn" : idx % 7 === 5 ? "danger" : "ok";
    beacons.push({
      hub: false,
      kind,
      dir: d,
      ang,
      flash: 0,
      touch: 0,
      h: 0.07 + rand() * 0.07,
      result: resultOf(kind).clone(),
      qY: new Quaternion(),
      qZ: new Quaternion(),
    });
    // The prototype also drew a per-beacon phase here; it is unused, but the draw order is kept
    // so the seeded layout stays identical.
    rand();
  }
  const B = beacons.length;
  const T = B - 1;
  for (const b of beacons) {
    b.qY.setFromUnitVectors(Y_AXIS, b.dir);
    b.qZ.setFromUnitVectors(Z_AXIS, b.dir);
  }

  const pillars = new InstancedMesh(
    track(new CylinderGeometry(0.008, 0.008, 1, 6, 1, true)),
    track(
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    ),
    B,
  );
  const rings = new InstancedMesh(
    track(new RingGeometry(0.02, 0.027, 40)),
    track(
      new MeshBasicMaterial({
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    ),
    B,
  );
  for (const m of [pillars, rings]) {
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false;
    for (let i = 0; i < B; i++) m.setColorAt(i, C.accent);
    orb.add(m);
  }
  const pillarColors = pillars.instanceColor as BufferAttribute;
  const ringColors = rings.instanceColor as BufferAttribute;

  const spriteMat = (alpha: number): ShaderMaterial =>
    track(
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uScalePx, uAlpha: { value: alpha } },
        vertexShader: SPRITE_VERT,
        fragmentShader: SPRITE_FRAG,
      }),
    );
  function makeSprites(count: number, alpha: number): Sprites {
    const geo = track(new BufferGeometry());
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const aPos = new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage);
    const aCol = new BufferAttribute(col, 3).setUsage(DynamicDrawUsage);
    const aSize = new BufferAttribute(size, 1).setUsage(DynamicDrawUsage);
    geo.setAttribute("position", aPos);
    geo.setAttribute("aColor", aCol);
    geo.setAttribute("aSize", aSize);
    const pts = new Points(geo, spriteMat(alpha));
    pts.frustumCulled = false;
    orb.add(pts);
    return { pts, geo, pos, col, size, aPos, aCol, aSize };
  }
  const glow = makeSprites(B, 0.9); // beacon glow
  const packets = makeSprites(MAX_ARCS * TRAIL, 1); // request packets in flight (head + trail)

  /* ---------- arcs: hub -> target, lifted off the surface ---------- */
  function arcPoint(b: Beacon, u: number, out: Vector3): Vector3 {
    const omega = Math.acos(clamp(hubDir.dot(b.dir), -1, 1));
    const so = Math.sin(omega);
    const a = Math.sin((1 - u) * omega) / so;
    const c = Math.sin(u * omega) / so;
    const lift = 0.05 + 0.12 * omega;
    return out
      .set(hubDir.x * a + b.dir.x * c, hubDir.y * a + b.dir.y * c, hubDir.z * a + b.dir.z * c)
      .multiplyScalar(1 + lift * Math.sin(Math.PI * u));
  }
  const arcPos: number[] = [];
  const arcT: number[] = [];
  const arcIdx: number[] = [];
  const pt = new Vector3();
  for (let i = 1; i < B; i++) {
    for (let s = 0; s < ARC_SEGMENTS; s++) {
      const u0 = s / ARC_SEGMENTS;
      const u1 = (s + 1) / ARC_SEGMENTS;
      arcPoint(beacons[i], u0, pt);
      arcPos.push(pt.x, pt.y, pt.z);
      arcPoint(beacons[i], u1, pt);
      arcPos.push(pt.x, pt.y, pt.z);
      arcT.push(u0, u1);
      arcIdx.push(i - 1, i - 1);
    }
  }
  const arcGeo = track(new BufferGeometry());
  arcGeo.setAttribute("position", new Float32BufferAttribute(arcPos, 3));
  arcGeo.setAttribute("aT", new Float32BufferAttribute(arcT, 1));
  arcGeo.setAttribute("aIdx", new Float32BufferAttribute(arcIdx, 1));
  const uProg = { value: new Array<number>(MAX_ARCS).fill(-1) };
  const uArcCol = { value: Array.from({ length: MAX_ARCS }, () => new Vector3(1, 1, 1)) };
  const uVis = { value: 1 };
  const arcs = new LineSegments(
    arcGeo,
    track(
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uProg,
          uArcCol,
          uVis,
          uLineCol: { value: C.muted.clone().lerp(C.accent, 0.5) },
        },
        vertexShader: ARC_VERT,
        fragmentShader: ARC_FRAG,
      }),
    ),
  );
  arcs.frustumCulled = false;
  orb.add(arcs);
  const packetState: { period: number; offset: number; lastCyc: number }[] = [];
  for (let i = 0; i < T; i++) {
    const period = lerp(PACKET.period[0], PACKET.period[1], rand());
    packetState.push({ period, offset: rand() * period, lastCyc: 0 });
  }

  /* ---------- orbit rings + ticks (HUD feel) ---------- */
  const ringsGroup = new Group();
  ringsGroup.rotation.set(1.15, 0, 0.35);
  orb.add(ringsGroup);
  function ringLine(radius: number, dashed: boolean, opacity: number): Line {
    const points: Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      points.push(new Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
    }
    const geo = track(new BufferGeometry().setFromPoints(points));
    const mat = track(
      dashed
        ? new LineDashedMaterial({
            color: C.accent,
            transparent: true,
            opacity,
            dashSize: 0.05,
            gapSize: 0.05,
            depthWrite: false,
          })
        : new LineBasicMaterial({
            color: C.accent,
            transparent: true,
            opacity,
            depthWrite: false,
          }),
    );
    const line = new Line(geo, mat);
    if (dashed) line.computeLineDistances();
    line.frustumCulled = false;
    ringsGroup.add(line);
    return line;
  }
  ringLine(1.42, true, 0.22);
  ringLine(1.66, false, 0.1);
  const ticks = makeSprites(3, 1);
  orb.remove(ticks.pts);
  ringsGroup.add(ticks.pts);

  /* ---------- dust ---------- */
  const dustPos = new Float32Array(cfg.dust * 3);
  for (let i = 0; i < cfg.dust; i++) {
    const r = 9 + rand() * 9;
    const u = rand() * 2 - 1;
    const a = rand() * 6.283;
    const s = Math.sqrt(1 - u * u);
    dustPos[i * 3] = r * s * Math.cos(a);
    dustPos[i * 3 + 1] = r * u * 0.6;
    dustPos[i * 3 + 2] = r * s * Math.sin(a) - 4;
  }
  const dustGeo = track(new BufferGeometry());
  dustGeo.setAttribute("position", new BufferAttribute(dustPos, 3));
  // Radial white-to-transparent sprite, built as raw pixels so the scene needs no DOM canvas.
  const DUST_TEX = 32;
  const dustPixels = new Uint8Array(DUST_TEX * DUST_TEX * 4);
  for (let y = 0; y < DUST_TEX; y++) {
    for (let x = 0; x < DUST_TEX; x++) {
      const d = Math.hypot(x + 0.5 - DUST_TEX / 2, y + 0.5 - DUST_TEX / 2) / (DUST_TEX / 2);
      const o = (y * DUST_TEX + x) * 4;
      dustPixels[o] = dustPixels[o + 1] = dustPixels[o + 2] = 255;
      dustPixels[o + 3] = Math.round(255 * clamp(1 - d, 0, 1));
    }
  }
  const dustTex = track(
    new DataTexture(dustPixels, DUST_TEX, DUST_TEX, RGBAFormat, UnsignedByteType),
  );
  dustTex.needsUpdate = true;
  const dust = new Points(
    dustGeo,
    track(
      new PointsMaterial({
        map: dustTex,
        color: C.muted,
        size: 0.09,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        alphaTest: 0.02,
      }),
    ),
  );
  dust.frustumCulled = false;
  scene.add(dust);

  /* ---------- pulse slots (0-1 hub, 2-5 arrival ripples) ---------- */
  const slots: PulseSlot[] = Array.from({ length: MAX_PULSES }, (_, i) => ({
    active: false,
    k: 0,
    dur: 1,
    dir: new Vector3(0, 0, 1),
    color: new Color(),
    maxA: 1,
    prevFront: 0,
    hub: i < 2,
  }));
  function spawn(slot: PulseSlot, dir: Vector3, color: Color, dur: number, maxA: number): void {
    slot.active = true;
    slot.k = 0;
    slot.dur = dur;
    slot.dir.copy(dir);
    slot.color.copy(color);
    slot.maxA = maxA;
    slot.prevFront = 0;
  }
  function freeSlot(from: number, to: number): PulseSlot | null {
    for (let i = from; i <= to; i++) if (!slots[i].active) return slots[i];
    return null;
  }

  /* ---------- per-frame simulation (no allocations below this line) ---------- */
  const dummy = new Object3D();
  const tmpA = new Color();
  const tmpB = new Color();
  const travelColor = new Color();
  const weights: LifecycleWeights = { q: 0, r: 0, d: 1 };
  const kf: Keyframe = { ...KEYFRAMES[0] };

  function simulate(dt: number, w: LifecycleWeights): void {
    const t = state.time;
    // hub pulses
    if (!state.reduced && w.q < 0.5) {
      state.hubClock += dt;
      const interval = lerp(HUB_PULSE.interval[0], HUB_PULSE.interval[1], w.r);
      if (state.hubClock >= interval) {
        state.hubClock = 0;
        const s = freeSlot(0, 1);
        if (s) {
          tmpA.copy(C.accent).lerp(C.info, w.r);
          spawn(s, hubDir, tmpA, HUB_PULSE.duration, HUB_PULSE.maxAngle);
          beacons[0].flash = 1;
        }
      }
    }
    for (let i = 0; i < MAX_PULSES; i++) {
      const s = slots[i];
      if (!s.active) continue;
      if (!state.reduced) s.k += dt / s.dur;
      if (s.k >= 1) {
        s.active = false;
        continue;
      }
      const front = (1 - Math.pow(1 - s.k, 2)) * s.maxA;
      if (s.hub && !state.reduced) {
        for (let j = 1; j < B; j++) {
          const b = beacons[j];
          if (s.prevFront < b.ang && b.ang <= front) b.touch = 1;
        }
      }
      s.prevFront = front;
    }

    // request packets
    travelColor.copy(C.info).lerp(C.accent, w.d);
    const travel = PACKET.travel;
    for (let i = 0; i < T; i++) {
      const ps = packetState[i];
      const b = beacons[i + 1];
      let prog = -1;
      if (!state.reduced && w.q < 0.7) {
        const cyc = (t + ps.offset) % ps.period;
        if (cyc < travel) prog = smooth(cyc / travel);
        if (ps.lastCyc < travel && cyc >= travel) {
          b.flash = 1;
          if (w.d > 0.5) {
            const s = freeSlot(2, MAX_PULSES - 1);
            if (s) spawn(s, b.dir, resultOf(b.kind), ARRIVAL.duration, ARRIVAL.maxAngle);
          }
        }
        ps.lastCyc = cyc;
      }
      uProg.value[i] = prog;
      uArcCol.value[i].set(travelColor.r, travelColor.g, travelColor.b);
      for (let j = 0; j < TRAIL; j++) {
        const idx = i * TRAIL + j;
        const u = prog - j * 0.035;
        if (prog < 0 || u < 0) {
          packets.size[idx] = 0;
          continue;
        }
        arcPoint(b, u, pt);
        const fade = 1 - j / TRAIL;
        const o = idx * 3;
        packets.pos[o] = pt.x;
        packets.pos[o + 1] = pt.y;
        packets.pos[o + 2] = pt.z;
        packets.col[o] = travelColor.r * 1.5 * fade;
        packets.col[o + 1] = travelColor.g * 1.5 * fade;
        packets.col[o + 2] = travelColor.b * 1.5 * fade;
        packets.size[idx] = 0.085 * (1 - j * 0.09);
      }
    }
    packets.aPos.needsUpdate = packets.aCol.needsUpdate = packets.aSize.needsUpdate = true;

    // beacons
    for (let j = 0; j < B; j++) {
      const b = beacons[j];
      b.flash = Math.max(0, b.flash - dt * 1.4);
      b.touch = Math.max(0, b.touch - dt * 2.2);
      if (b.hub) tmpA.copy(C.accent).lerp(C.white, 0.35);
      else {
        tmpA.copy(C.neutral).multiplyScalar(w.q);
        tmpB.copy(C.info).multiplyScalar(w.r);
        tmpA.add(tmpB);
        tmpB.copy(b.result).multiplyScalar(w.d);
        tmpA.add(tmpB);
        tmpA.lerp(C.white, b.flash * 0.6 * w.d);
      }
      const height = b.h * (b.hub ? 1 : 0.6 + 0.4 * (1 - w.q)) * (1 + b.flash * 0.7);
      pillars.setColorAt(j, tmpA);
      dummy.position.copy(b.dir).multiplyScalar(1 + height / 2);
      dummy.quaternion.copy(b.qY);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      pillars.setMatrixAt(j, dummy.matrix);

      const pulse = b.hub ? 0.5 + 0.5 * Math.sin(t * 2) : 0;
      const rs = 1 + b.touch * 2.2 + b.flash * 3 + (b.hub ? 1 + 0.6 * pulse : 0);
      const br = 0.3 + 0.7 * Math.max(b.touch, b.flash) + (b.hub ? 0.4 : 0);
      tmpB.copy(tmpA).multiplyScalar(br);
      rings.setColorAt(j, tmpB);
      dummy.position.copy(b.dir).multiplyScalar(1.004);
      dummy.quaternion.copy(b.qZ);
      dummy.scale.setScalar(rs);
      dummy.updateMatrix();
      rings.setMatrixAt(j, dummy.matrix);

      pt.copy(b.dir).multiplyScalar(1 + height);
      const o = j * 3;
      glow.pos[o] = pt.x;
      glow.pos[o + 1] = pt.y;
      glow.pos[o + 2] = pt.z;
      const gi = 0.9 + b.flash * 0.9;
      glow.col[o] = tmpA.r * gi;
      glow.col[o + 1] = tmpA.g * gi;
      glow.col[o + 2] = tmpA.b * gi;
      glow.size[j] = (b.hub ? 0.2 + 0.05 * pulse : 0.1) + b.flash * 0.24 + b.touch * 0.05;
    }
    pillars.instanceMatrix.needsUpdate = rings.instanceMatrix.needsUpdate = true;
    pillarColors.needsUpdate = ringColors.needsUpdate = true;
    glow.aPos.needsUpdate = glow.aCol.needsUpdate = glow.aSize.needsUpdate = true;

    // ticks orbiting ring A
    for (let k = 0; k < 3; k++) {
      const a = t * 0.35 + k * 2.094;
      const o = k * 3;
      ticks.pos[o] = Math.cos(a) * 1.42;
      ticks.pos[o + 1] = Math.sin(a) * 1.42;
      ticks.pos[o + 2] = 0;
      ticks.col[o] = C.accent.r;
      ticks.col[o + 1] = C.accent.g;
      ticks.col[o + 2] = C.accent.b;
      ticks.size[k] = 0.07;
    }
    ticks.aPos.needsUpdate = ticks.aCol.needsUpdate = ticks.aSize.needsUpdate = true;
    ringsGroup.rotation.z = 0.35 + t * 0.03;

    // upload pulse uniforms
    for (let i = 0; i < MAX_PULSES; i++) {
      const s = slots[i];
      pulseA[i].set(s.dir.x, s.dir.y, s.dir.z, s.active ? s.k : -1);
      pulseB[i].set(s.color.r, s.color.g, s.color.b, s.maxA);
    }
    uVis.value = 0.35 + 0.65 * (1 - w.q);
    dotMat.uniforms.uBright.value = 0.6 + 0.4 * (1 - w.q);
    atmoMat.uniforms.uStrength.value = 0.12 + 0.13 * (1 - w.q);
  }

  function placeOrb(dt: number): void {
    state.mouseS.lerp(state.mouse, 1 - Math.exp(-dt * 3));
    orb.position.set(state.narrow ? kf.xN : kf.x, state.narrow ? kf.yN : kf.y, 0);
    orb.scale.setScalar(state.narrow ? kf.sN : kf.s);
    orb.rotation.set(
      kf.rotX + state.mouseS.y * 0.12,
      0.35 * Math.sin(state.time * 0.12) + Math.min(state.f, 2.5) * 0.3 + state.mouseS.x * 0.25,
      0,
    );
    dust.rotation.y = state.time * 0.01;
  }

  function tick(dt: number): void {
    if (state.reduced) state.f = state.fTarget = 0.5;
    else state.f += (state.fTarget - state.f) * (1 - Math.exp(-dt * 5));
    sampleKeyframes(KEYFRAMES, state.f, kf);
    if (state.reduced) {
      weights.q = 0;
      weights.r = 0;
      weights.d = 1;
    } else lifecycleWeightsInto(state.f, weights);

    state.introT = Math.min(1, state.introT + dt / INTRO_SECONDS);
    const e = 1 - Math.pow(1 - state.introT, 3);
    dotMat.uniforms.uIntro.value = e;

    simulate(dt, weights);
    placeOrb(dt);
    const opacity = (state.narrow ? kf.opacityN : kf.opacity) * smooth(state.introT * 2.5);
    if (Math.abs(opacity - state.opacity) > 0.002 || opacity === 1) {
      state.opacity = opacity;
      canvas.style.opacity = String(opacity);
    }
    renderer.render(scene, camera);

    if (!state.firstFrame) {
      state.firstFrame = true;
      onFirstFrame?.();
    }
  }

  /* ---------- sizing, DPR cap, adaptive resolution ---------- */
  function currentDpr(): number {
    return Math.max(1, Math.min(state.devicePixelRatio, cfg.dprMax) * state.dprScale);
  }
  function applySize(): void {
    state.narrow = state.width < NARROW_BELOW;
    renderer.setPixelRatio(currentDpr());
    renderer.setSize(state.width, state.height, false);
    camera.aspect = state.width / state.height;
    camera.updateProjectionMatrix();
    uScalePx.value = renderer.domElement.height / (2 * Math.tan(MathUtils.degToRad(cfg.fov / 2)));
    if (!state.running) renderOnce();
  }
  function resize(width: number, height: number, devicePixelRatio: number): void {
    if (state.disposed) return;
    state.width = Math.max(1, width);
    state.height = Math.max(1, height);
    state.devicePixelRatio = devicePixelRatio || 1;
    applySize();
  }

  /* ---------- loop ---------- */
  let raf = 0;
  let lastNow = 0;
  let acc = 0;
  let statsTick = 0;
  const stats: SceneStats | null = onStats
    ? {
        tier,
        dpr: 1,
        fps: 60,
        f: 0,
        q: 0,
        r: 0,
        d: 1,
        calls: 0,
        triangles: 0,
        points: 0,
        beacons: B,
        throttled: false,
      }
    : null;

  function loop(now: number): void {
    raf = requestAnimationFrame(loop);
    acc += Math.min((now - lastNow) / 1000, 0.1);
    lastNow = now;
    const throttled = state.f > IDLE_THROTTLE_FROM;
    if (throttled && acc < IDLE_FRAME_SECONDS) return;
    const dt = acc;
    acc = 0;
    state.time += dt;
    tick(dt);

    if (!throttled) {
      state.ema = lerp(state.ema, dt, 0.05);
      state.slow = state.ema > SLOW_FRAME_SECONDS ? state.slow + 1 : Math.max(0, state.slow - 1);
      if (state.slow > SLOW_FRAMES_BEFORE_DROP && state.dprScale > DPR_SCALE_MIN) {
        state.dprScale -= DPR_STEP;
        state.slow = 0;
        applySize();
      }
    }
    if (stats && onStats && ++statsTick % STATS_EVERY_FRAMES === 0) {
      stats.dpr = renderer.getPixelRatio();
      stats.fps = 1 / state.ema;
      stats.f = state.f;
      stats.q = weights.q;
      stats.r = weights.r;
      stats.d = weights.d;
      stats.calls = renderer.info.render.calls;
      stats.triangles = renderer.info.render.triangles;
      stats.points = renderer.info.render.points;
      stats.throttled = throttled;
      onStats(stats);
    }
  }

  function renderOnce(): void {
    if (state.disposed) return;
    if (state.reduced) {
      for (let i = 0; i < MAX_PULSES; i++) slots[i].active = i === 0;
      spawn(slots[0], hubDir, C.accent, HUB_PULSE.duration, HUB_PULSE.maxAngle);
      slots[0].k = 0.38;
    }
    tick(0.0001);
  }

  function lostHandler(event: Event): void {
    event.preventDefault();
    stop();
    onContextLost?.();
  }
  canvas.addEventListener("webglcontextlost", lostHandler);

  function start(): void {
    if (state.disposed || state.running || state.reduced) return;
    state.running = true;
    lastNow = performance.now();
    acc = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop(): void {
    state.running = false;
    cancelAnimationFrame(raf);
  }

  function setReduced(value: boolean): void {
    if (state.disposed) return;
    state.reduced = value;
    if (value) {
      stop();
      renderOnce();
    } else {
      state.introT = 1;
      start();
    }
  }

  let disposed = false;
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    state.disposed = true;
    stop();
    canvas.removeEventListener("webglcontextlost", lostHandler);
    pillars.dispose();
    rings.dispose();
    for (const o of disposables) o.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  const handle: LandingScene = {
    start,
    stop,
    resize,
    dispose,
    setReduced,
    setScroll(f: number) {
      state.fTarget = f;
      if (!state.running) renderOnce();
    },
    setPointer(x: number, y: number) {
      if (cfg.parallax && !state.reduced) state.mouse.set(x, y);
    },
  };
  return handle;
}
