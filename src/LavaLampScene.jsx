import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { OrbitControls } from '@react-three/drei'

// ── Blob physics ──────────────────────────────────────────
const MAX_BLOBS = 20
const CYL_R = 0.65
const CYL_H = 1.7 // half-height

const SPEED_MAP = {
  slow:   { buoyancyMul: 0.6, dragCoeff: 4.5 },
  medium: { buoyancyMul: 1.0, dragCoeff: 3.5 },
  fast:   { buoyancyMul: 1.6, dragCoeff: 2.5 },
}
const BG_MAP = { dark: 1.0, darker: 0.4, pitch: 0.0 }

function createBlobs() {
  const blobs = []
  for (let i = 0; i < MAX_BLOBS; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = Math.random() * 0.15
    const yBase = -CYL_H + 0.3 + Math.pow(i / (MAX_BLOBS - 1), 1.5) * CYL_H * 1.8
    const baseRadius = 0.22 + Math.random() * 0.14
    blobs.push({
      pos: new THREE.Vector3(
        Math.cos(angle) * r,
        yBase + (Math.random() - 0.5) * 0.3,
        Math.sin(angle) * r
      ),
      vel: new THREE.Vector3(0, 0, 0),
      radius: baseRadius,
      baseRadius,
      radiusAmp: 0.03 + Math.random() * 0.05,
      radiusSpeed: 0.1 + Math.random() * 0.15,
      radiusPhase: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.15 + Math.random() * 0.3,
      temperature: i < 4 ? 0.7 + Math.random() * 0.3 : 0.1 + Math.random() * 0.3,
      orbitSpeed: (0.08 + Math.random() * 0.12) * (i % 2 === 0 ? 1 : -1),
      driftSeed: Math.random() * 1000,
      // Per-blob thermal personality
      heatRate: 0.35 + Math.random() * 0.5,      // how fast it heats at bottom
      coolRate: 0.5 + Math.random() * 0.6,        // how fast it cools at top
      buoyancyOffset: (Math.random() - 0.5) * 0.15, // shifts neutral buoyancy point
      thermalPhase: Math.random() * Math.PI * 2,  // phase for slow thermal cycle
      thermalCycleSpeed: 0.03 + Math.random() * 0.06, // speed of thermal cycle
    })
  }
  return blobs
}

function updateBlobs(blobs, dt, time, count, speedCfg) {
  const { buoyancyMul, dragCoeff } = speedCfg
  // Scale radii so more blobs = smaller each (normalized to 6 blobs)
  const radiusScale = Math.sqrt(6 / count)

  for (let idx = 0; idx < count; idx++) {
    const b = blobs[idx]
    const heatZone = THREE.MathUtils.smoothstep(-b.pos.y, -0.3, CYL_H)
    const coolZone = THREE.MathUtils.smoothstep(b.pos.y, CYL_H * 0.2, CYL_H)
    b.temperature += heatZone * b.heatRate * dt
    b.temperature -= coolZone * b.coolRate * dt
    // Slow per-blob thermal nudge — creates natural desync
    b.temperature += Math.sin(time * b.thermalCycleSpeed + b.thermalPhase) * 0.08 * dt
    b.temperature = THREE.MathUtils.clamp(b.temperature, 0, 1)

    const buoyancy = (b.temperature - (0.42 + b.buoyancyOffset)) * 1.2 * buoyancyMul
    b.vel.y += buoyancy * dt
    b.vel.y -= 0.15 * dt

    // Anisotropic drag: lateral persists longer than vertical
    const dragY = Math.max(1 - dragCoeff * dt, 0)
    const dragXZ = Math.max(1 - dragCoeff * 0.5 * dt, 0)
    b.vel.x *= dragXZ
    b.vel.y *= dragY
    b.vel.z *= dragXZ

    // Orbital drift — tangential force perpendicular to radial direction
    const distXZPre = Math.sqrt(b.pos.x * b.pos.x + b.pos.z * b.pos.z)
    if (distXZPre > 0.05) {
      const rFactor = Math.min(distXZPre / CYL_R, 1.0)
      const orbStrength = 0.15 * buoyancyMul * rFactor
      const rnx = b.pos.x / distXZPre
      const rnz = b.pos.z / distXZPre
      // tangent = perpendicular to radial in XZ plane
      b.vel.x += -rnz * b.orbitSpeed * orbStrength * dt
      b.vel.z += rnx * b.orbitSpeed * orbStrength * dt
    }

    // Perlin-like layered wobble — equal X and Z strength
    const s = b.driftSeed
    b.vel.x += (Math.sin(time * 0.07 + s) * 0.04 + Math.sin(time * 0.19 + s * 1.7) * 0.03 + Math.sin(time * 0.13 + s * 2.3) * 0.03) * dt
    b.vel.z += (Math.cos(time * 0.09 + s * 0.8) * 0.04 + Math.cos(time * 0.17 + s * 1.4) * 0.03 + Math.cos(time * 0.11 + s * 2.9) * 0.03) * dt

    b.radius = (b.baseRadius + Math.sin(time * b.radiusSpeed + b.radiusPhase) * b.radiusAmp) * radiusScale

    b.pos.addScaledVector(b.vel, dt)

    const distXZ = Math.sqrt(b.pos.x * b.pos.x + b.pos.z * b.pos.z)
    // Use shader cylinder radius (0.62), full blob radius, + smin gooey margin
    const sminMargin = 0.09
    const maxR = 0.63 - b.radius - sminMargin
    if (distXZ > maxR && distXZ > 0.001) {
      const nx = b.pos.x / distXZ
      const nz = b.pos.z / distXZ
      b.pos.x = nx * maxR
      b.pos.z = nz * maxR
      // Wall sliding: remove only outward radial component, preserve tangential
      const radialVel = b.vel.x * nx + b.vel.z * nz
      if (radialVel > 0) {
        b.vel.x -= radialVel * 1.1 * nx
        b.vel.z -= radialVel * 1.1 * nz
      }
    }

    const capMargin = b.radius * 0.3
    if (b.pos.y < -CYL_H + capMargin) {
      b.pos.y = -CYL_H + capMargin
      b.vel.y = Math.abs(b.vel.y) * 0.1
      b.temperature = Math.min(b.temperature + 0.2, 1.0)
    }
    if (b.pos.y > CYL_H - capMargin) {
      b.pos.y = CYL_H - capMargin
      b.vel.y = -Math.abs(b.vel.y) * 0.1
      b.temperature = Math.max(b.temperature - 0.2, 0.0)
    }
  }

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const a = blobs[i], b = blobs[j]
      const dx = a.pos.x - b.pos.x
      const dy = a.pos.y - b.pos.y
      const dz = a.pos.z - b.pos.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const minDist = (a.radius + b.radius) * 0.6
      if (dist < minDist && dist > 0.001) {
        const force = (minDist - dist) * 1.5 * dt
        const nx = dx / dist, ny = dy / dist, nz = dz / dist
        a.vel.x += nx * force; a.vel.y += ny * force; a.vel.z += nz * force
        b.vel.x -= nx * force; b.vel.y -= ny * force; b.vel.z -= nz * force
      }
    }
  }
}

// ── Shaders ───────────────────────────────────────────────
const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const fragmentShader = `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uCameraPos;
uniform mat4 uInvProjView;
uniform vec4 uBlobs[20];
uniform int uBlobCount;
uniform float uSminK;
uniform float uBgBrightness;
uniform vec3 uBlobColor;
uniform vec3 uGlowColor;

// ── SDF primitives ────────────────────────────────────
float sdSphere(vec3 p, vec3 c, float r) {
  return length(p - c) - r;
}

float sdCappedCylinder(vec3 p, float r, float h) {
  vec2 d = vec2(length(p.xz) - r, abs(p.y) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdCylinder(vec3 p, float r, float h) {
  float dR = length(p.xz) - r;
  float dH = abs(p.y) - h;
  return max(dR, dH);
}

float sdTorus(vec3 p, float R, float r) {
  vec2 q = vec2(length(p.xz) - R, p.y);
  return length(q) - r;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// ── Scene SDFs ────────────────────────────────────────
float blobsSDF(vec3 p) {
  float d = sdSphere(p, uBlobs[0].xyz, uBlobs[0].w);
  for (int i = 1; i < 20; i++) {
    if (i >= uBlobCount) break;
    float s = sdSphere(p, uBlobs[i].xyz, uBlobs[i].w);
    float k = uSminK + 0.12 * sin(uTime * 0.15 + float(i) * 2.1);
    d = smin(d, s, k);
  }
  float pool = sdSphere(p, vec3(0.0, -1.85, 0.0), 0.50);
  d = smin(d, pool, uSminK + 0.05);
  return d;
}

float clippedBlobs(vec3 p) {
  float blobs = blobsSDF(p);
  float cyl = sdCylinder(p, 0.63, 1.7);
  return max(blobs, cyl);
}

float baseSDF(vec3 p) {
  vec3 pb = p - vec3(0.0, -1.88, 0.0);
  float base = sdCappedCylinder(pb, 0.85, 0.18);
  float ring = sdTorus(p - vec3(0.0, -1.72, 0.0), 0.64, 0.04);
  float d = min(base, ring);
  vec3 pt = p - vec3(0.0, 1.88, 0.0);
  float topCap = sdCappedCylinder(pt, 0.78, 0.14);
  d = min(d, topCap);
  float topRing = sdTorus(p - vec3(0.0, 1.75, 0.0), 0.64, 0.04);
  d = min(d, topRing);
  return d;
}

// Ground plane
float groundSDF(vec3 p) {
  return p.y + 2.10;
}

// ── Ray-cylinder intersection (analytical, for glass) ──
vec2 intersectGlassCylinder(vec3 ro, vec3 rd, float r, float h) {
  float a = rd.x * rd.x + rd.z * rd.z;
  float b = 2.0 * (ro.x * rd.x + ro.z * rd.z);
  float c = ro.x * ro.x + ro.z * ro.z - r * r;
  float disc = b * b - 4.0 * a * c;
  if (disc < 0.0) return vec2(-1.0);

  float sqrtDisc = sqrt(disc);
  float t0 = (-b - sqrtDisc) / (2.0 * a);
  float t1 = (-b + sqrtDisc) / (2.0 * a);

  float y0 = ro.y + rd.y * t0;
  float y1 = ro.y + rd.y * t1;

  if (y0 < -h || y0 > h) t0 = -1.0;
  if (y1 < -h || y1 > h) t1 = -1.0;

  if (t0 < 0.0 && t1 < 0.0) return vec2(-1.0);
  return vec2(t0, t1);
}

// ── Ray marching ──────────────────────────────────────
vec3 calcNormal(vec3 p, int material) {
  const float e = 0.001;
  if (material == 1) {
    return normalize(vec3(
      clippedBlobs(p + vec3(e,0,0)) - clippedBlobs(p - vec3(e,0,0)),
      clippedBlobs(p + vec3(0,e,0)) - clippedBlobs(p - vec3(0,e,0)),
      clippedBlobs(p + vec3(0,0,e)) - clippedBlobs(p - vec3(0,0,e))
    ));
  } else if (material == 4) {
    return vec3(0.0, 1.0, 0.0);
  } else {
    return normalize(vec3(
      baseSDF(p + vec3(e,0,0)) - baseSDF(p - vec3(e,0,0)),
      baseSDF(p + vec3(0,e,0)) - baseSDF(p - vec3(0,e,0)),
      baseSDF(p + vec3(0,0,e)) - baseSDF(p - vec3(0,0,e))
    ));
  }
}

// 1=blob, 3=metal, 4=ground
vec2 sceneSDF(vec3 p) {
  float dBlob = clippedBlobs(p);
  float dBase = baseSDF(p);
  float dGround = groundSDF(p);

  float d = dBlob;
  float mat = 1.0;
  if (dBase < d) { d = dBase; mat = 3.0; }
  if (dGround < d) { d = dGround; mat = 4.0; }
  return vec2(d, mat);
}

vec2 rayMarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 120; i++) {
    vec3 p = ro + rd * t;
    vec2 hit = sceneSDF(p);
    if (hit.x < 0.002) return vec2(t, hit.y);
    t += hit.x * 0.75;
    if (t > 20.0) break;
  }
  return vec2(-1.0, 0.0);
}

// ── Shading ───────────────────────────────────────────
vec3 shadeBlob(vec3 p, vec3 rd, vec3 n) {
  // Primary light from below (bottom of lamp)
  vec3 lightPos = vec3(0.0, -2.8, 0.0);
  vec3 L = normalize(lightPos - p);
  vec3 V = -rd;
  vec3 H = normalize(L + V);

  // Stronger bottom light attenuation — closer to bottom = brighter
  float distToLight = length(lightPos - p);
  float atten = 1.0 / (1.0 + distToLight * 0.3);

  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, H), 0.0), 40.0);
  float fresnel = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  float sss = max(0.0, dot(V, -L)) * 0.5;

  float hFactor = smoothstep(-1.8, 1.8, p.y);
  vec3 baseCol = mix(uBlobColor, uGlowColor, hFactor * 0.4 + 0.15);

  // Very faint top fill — mostly just prevents total blackness on top surfaces
  vec3 L2 = normalize(vec3(0.0, 2.0, 0.5) - p);
  float diff2 = max(dot(n, L2), 0.0) * 0.08;

  vec3 col = baseCol * (diff * atten * 1.1 + diff2 + 0.08);
  col += uGlowColor * sss * 0.5 * atten;
  col += vec3(1.0) * spec * 0.3 * atten;
  col += baseCol * fresnel * 0.2;

  float glow = exp(-blobsSDF(p) * 5.0);
  col += uGlowColor * glow * 0.3 * atten;

  return col;
}

vec3 shadeMetal(vec3 p, vec3 rd, vec3 n) {
  vec3 V = -rd;

  // Bottom uplight — primary light for metal base
  vec3 L1 = normalize(vec3(0.0, -1.0, 0.5));
  vec3 H1 = normalize(L1 + V);
  float diff1 = max(dot(n, L1), 0.0);
  float spec1 = pow(max(dot(n, H1), 0.0), 60.0);

  // Very faint secondary fill
  vec3 L2 = normalize(vec3(1.0, -0.3, 1.0));
  vec3 H2 = normalize(L2 + V);
  float diff2 = max(dot(n, L2), 0.0);
  float spec2 = pow(max(dot(n, H2), 0.0), 80.0);

  vec3 refl = reflect(rd, n);
  float envUp = max(refl.y, 0.0);
  vec3 envCol = mix(vec3(0.02, 0.02, 0.03), vec3(0.05, 0.05, 0.08), envUp);

  vec3 metalCol = vec3(0.12, 0.12, 0.14);
  vec3 col = metalCol * (diff1 * 0.4 + diff2 * 0.15 + 0.15);
  col += envCol * 0.2;
  col += vec3(0.3) * spec1 + vec3(0.15) * spec2;

  // Subtle warm white glow on bottom face — no colored light bleed
  float bottomFace = 1.0 - smoothstep(-2.1, -1.5, p.y);
  col += vec3(0.06, 0.05, 0.04) * bottomFace;

  float topFace = smoothstep(1.5, 2.1, p.y);
  col += vec3(0.02) * topFace;

  return col;
}

vec3 shadeGround(vec3 p, vec3 rd, vec3 n) {
  vec3 groundCol = vec3(0.02, 0.02, 0.025);

  // Minimal ambient — ground is mostly dark
  vec3 col = groundCol * 0.08;

  // Colored light pool from lava lamp bottom — this is the main ground illumination
  float distFromCenter = length(p.xz);
  float lampLight = exp(-distFromCenter * distFromCenter * 1.5);
  col += uGlowColor * lampLight * 0.15;

  // Fade to black at edges
  float fade = smoothstep(2.0, 5.0, distFromCenter);
  col *= 1.0 - fade;

  return col;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  vec3 ro = uCameraPos;
  vec3 forward = normalize(-ro);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);

  float fov = tan(radians(30.0));
  vec3 rd = normalize(forward + uv.x * right * fov + uv.y * up * fov);

  // ── Glass intersection ──────────────────────────────
  float glassR = 0.64;
  float glassH = 1.73;
  vec2 glassTimes = intersectGlassCylinder(ro, rd, glassR, glassH);
  float glassNear = glassTimes.x;
  float glassFar = glassTimes.y;

  // ── Ray march scene ─────────────────────────────────
  vec2 hit = rayMarch(ro, rd);

  // ── Background ──────────────────────────────────────
  vec3 bgCol;
  {
    float vignette = 1.0 - length(vUv - 0.5) * 1.0;
    bgCol = vec3(0.015, 0.015, 0.03) * uBgBrightness * vignette;
    float lampGlow = exp(-length(uv) * 1.8) * 0.05;
    bgCol += uGlowColor * lampGlow * uBgBrightness;
  }

  vec3 col = bgCol;
  float hitDist = hit.x;
  int mat = int(hit.y + 0.5);

  if (hitDist > 0.0) {
    vec3 p = ro + rd * hitDist;
    vec3 n = calcNormal(p, mat);

    if (mat == 1) {
      col = shadeBlob(p, rd, n);
    } else if (mat == 4) {
      col = shadeGround(p, rd, n);
    } else {
      col = shadeMetal(p, rd, n);
    }
  }

  // ── Glass post-pass ─────────────────────────────────
  if (glassNear > 0.0) {
    vec3 pGlass = ro + rd * glassNear;
    vec3 nGlass = normalize(vec3(pGlass.x, 0.0, pGlass.z));
    vec3 V = -rd;
    float fresnel = pow(1.0 - abs(dot(nGlass, V)), 5.0);

    // Glass specular — subtle, from below-ish angles
    vec3 L1 = normalize(vec3(-1.0, -1.5, 2.5));
    vec3 H1 = normalize(L1 + V);
    float spec1 = pow(max(dot(nGlass, H1), 0.0), 200.0);

    vec3 L2 = normalize(vec3(1.5, -0.5, 2.0));
    vec3 H2 = normalize(L2 + V);
    float spec2 = pow(max(dot(nGlass, H2), 0.0), 180.0);

    vec3 glassEffect = vec3(0.0);
    glassEffect += vec3(0.08, 0.08, 0.10) * fresnel * 0.4;
    glassEffect += vec3(1.0) * (spec1 * 0.12 + spec2 * 0.08);

    if (hitDist < 0.0 || glassNear < hitDist) {
      col += glassEffect;
    } else {
      col += glassEffect * 0.4;
    }
  }

  if (glassFar > 0.0 && (hitDist < 0.0 || glassFar > hitDist)) {
    vec3 pGlassFar = ro + rd * glassFar;
    vec3 nGlassFar = -normalize(vec3(pGlassFar.x, 0.0, pGlassFar.z));
    float fresnelFar = pow(1.0 - abs(dot(nGlassFar, -rd)), 5.0);
    col += vec3(0.06, 0.06, 0.08) * fresnelFar * 0.3;
  }

  // ── Liquid medium ───────────────────────────────────
  if (glassNear > 0.0 || glassFar > 0.0) {
    float tStart = max(glassNear, 0.001);
    float tEnd = glassFar > 0.0 ? glassFar : tStart + 4.0;
    if (hitDist > 0.0 && hitDist < tEnd) tEnd = hitDist;
    float thickness = max(tEnd - tStart, 0.0);

    vec3 midP = ro + rd * ((tStart + tEnd) * 0.5);
    float heightFactor = smoothstep(-1.8, 1.8, midP.y);

    vec3 liquidTint = mix(uGlowColor * 0.08, vec3(0.02, 0.02, 0.03), heightFactor);
    float fogAmount = 1.0 - exp(-thickness * 0.3);
    col = mix(col, col + liquidTint, fogAmount);
  }

  col = col / (col + vec3(1.0));
  col = pow(col, vec3(0.85));

  gl_FragColor = vec4(col, 1.0);
}
`

// ── React Component ───────────────────────────────────────
export default function LavaLampScene({ palette, settings }) {
  const meshRef = useRef()
  const blobsRef = useRef(createBlobs())
  const targetColorRef = useRef({ blob: [...palette.blob], glow: [...palette.glow] })
  const currentColorRef = useRef({ blob: [...palette.blob], glow: [...palette.glow] })
  const { size, camera } = useThree()

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(size.width, size.height) },
    uCameraPos: { value: new THREE.Vector3(0, 0, 8.0) },
    uInvProjView: { value: new THREE.Matrix4() },
    uBlobs: {
      value: Array.from({ length: MAX_BLOBS }, () => new THREE.Vector4(0, -100, 0, 0.15))
    },
    uBlobCount: { value: 10 },
    uSminK: { value: 0.26 },
    uBgBrightness: { value: 1.0 },
    uBlobColor: { value: new THREE.Vector3(...palette.blob) },
    uGlowColor: { value: new THREE.Vector3(...palette.glow) },
  }), [])

  useEffect(() => {
    targetColorRef.current = { blob: [...palette.blob], glow: [...palette.glow] }
  }, [palette])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const time = state.clock.elapsedTime
    const count = settings.blobCount
    const speedCfg = SPEED_MAP[settings.speed]

    const blobs = blobsRef.current
    updateBlobs(blobs, dt, time, count, speedCfg)

    const u = meshRef.current.material.uniforms

    // Upload active blobs; park inactive ones far away
    for (let i = 0; i < MAX_BLOBS; i++) {
      if (i < count) {
        u.uBlobs.value[i].set(blobs[i].pos.x, blobs[i].pos.y, blobs[i].pos.z, blobs[i].radius)
      } else {
        u.uBlobs.value[i].set(0, -100, 0, 0.01)
      }
    }

    u.uBlobCount.value = count
    u.uSminK.value = settings.gooeyness
    u.uBgBrightness.value = BG_MAP[settings.bgBrightness]
    u.uTime.value = time
    u.uResolution.value.set(state.size.width, state.size.height)
    u.uCameraPos.value.copy(camera.position)

    const cur = currentColorRef.current
    const tgt = targetColorRef.current
    const lerpSpeed = 3.0 * dt
    for (let i = 0; i < 3; i++) {
      cur.blob[i] += (tgt.blob[i] - cur.blob[i]) * lerpSpeed
      cur.glow[i] += (tgt.glow[i] - cur.glow[i]) * lerpSpeed
    }
    u.uBlobColor.value.set(cur.blob[0], cur.blob[1], cur.blob[2])
    u.uGlowColor.value.set(cur.glow[0], cur.glow[1], cur.glow[2])
  })

  return (
    <>
      <mesh ref={meshRef} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={16}
        minPolarAngle={Math.PI * 0.15}  // don't go too far above
        maxPolarAngle={Math.PI * 0.65}  // don't go below the ground
        rotateSpeed={0.5}
        zoomSpeed={0.8}
      />
      <EffectComposer>
        <Bloom
          intensity={settings.bloomIntensity}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.9}
          radius={0.6}
        />
      </EffectComposer>
    </>
  )
}
