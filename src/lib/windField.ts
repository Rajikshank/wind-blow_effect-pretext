export type PointerFieldState = {
  x: number
  y: number
  vx: number
  vy: number
  inside: boolean
  intensity: number
  dwell: number
}

export type WindFieldSample = {
  flowX: number
  flowY: number
  turbulenceX: number
  turbulenceY: number
  lift: number
  vorticity: number
  burstX: number
  burstY: number
}

export type SimulationParams = {
  drag: number
  spring: number
  damping: number
  lift: number
  vortexRadius: number
  vortexStrength: number
  gustStrength: number
  turbulenceStrength: number
  maxDisplacement: number
  burstStrength: number
  burstRadius: number
  recoverySpring: number
}

function hashNoise(x: number, y: number, t: number, seed: number): number {
  const raw = Math.sin(x * 12.9898 + y * 78.233 + t * 0.0013 + seed * 437.5453) * 43758.5453
  return raw - Math.floor(raw)
}

function smoothNoise(x: number, y: number, t: number, seed: number): number {
  const n1 = hashNoise(x, y, t, seed)
  const n2 = hashNoise(x * 0.47 + 19.2, y * 0.53 - 11.1, t * 1.4, seed + 0.17)
  const n3 = hashNoise(x * 1.91 - 4.2, y * 1.37 + 8.5, t * 0.7, seed + 0.43)
  return (n1 + n2 + n3) / 3
}

export function sampleWindField(
  x: number,
  y: number,
  timeMs: number,
  seed: number,
  pointer: PointerFieldState,
  params: SimulationParams,
): WindFieldSample {
  // The cursor drives a layered wind field:
  // 1. a swirl near the cursor
  // 2. a wake in the direction of travel
  // 3. noisy turbulence so letters do not move in lockstep
  // 4. a dwell burst when the cursor lingers in one place
  const dx = x - pointer.x
  const dy = y - pointer.y
  const distance = Math.hypot(dx, dy)
  const radius = params.vortexRadius
  const insideFactor = pointer.inside ? 1 : 0
  const radial = Math.max(0, 1 - distance / radius)
  const ring = Math.max(0, 1 - Math.abs(distance - radius * 0.55) / (radius * 0.55))
  const speed = Math.hypot(pointer.vx, pointer.vy)
  const headingX = speed > 0.001 ? pointer.vx / speed : 1
  const headingY = speed > 0.001 ? pointer.vy / speed : 0

  const tangentialX = distance > 0.001 ? -dy / distance : 0
  const tangentialY = distance > 0.001 ? dx / distance : 0
  const swirlStrength = params.vortexStrength * ring * (0.4 + pointer.intensity * 0.9) * insideFactor
  const vortexX = tangentialX * swirlStrength
  const vortexY = tangentialY * swirlStrength

  const wakeAlignment = Math.max(0, (-dx * headingX - dy * headingY) / Math.max(1, radius * 1.8))
  const wakeFalloff = Math.exp(-Math.max(0, distance - radius * 0.2) / (radius * 0.9))
  const gustScale = params.gustStrength * wakeAlignment * wakeFalloff * (0.35 + speed * 0.02) * insideFactor
  const gustX = headingX * gustScale
  const gustY = headingY * gustScale * 0.35

  const crossX = -headingY
  const crossY = headingX
  const shear = radial * speed * 0.018 * insideFactor
  const shearX = crossX * shear
  const shearY = crossY * shear

  const nx = smoothNoise(x * 0.018, y * 0.018, timeMs * 0.85, seed)
  const ny = smoothNoise(x * 0.018 + 43.2, y * 0.018 - 27.1, timeMs * 0.85, seed + 0.37)
  const turbulenceX = (ny - 0.5) * 2 * params.turbulenceStrength * (0.4 + radial) * (0.3 + pointer.intensity)
  const turbulenceY = (0.5 - nx) * 2 * params.turbulenceStrength * (0.4 + radial) * (0.3 + pointer.intensity)

  const burstRadius = params.burstRadius
  const burstFalloff = Math.max(0, 1 - distance / burstRadius)
  const burstDirectionX = distance > 0.001 ? dx / distance : headingX
  const burstDirectionY = distance > 0.001 ? dy / distance : headingY
  // Dwell turns a passing gust into a pressure buildup that can rip text loose.
  const burstScale = params.burstStrength * pointer.dwell * burstFalloff * burstFalloff * insideFactor
  const burstX = burstDirectionX * burstScale + headingX * burstScale * 0.75
  const burstY = burstDirectionY * burstScale + headingY * burstScale * 0.25 - burstScale * 0.16

  const flowX = vortexX + gustX + shearX
  const flowY = vortexY + gustY + shearY
  const lift = params.lift * (0.25 + radial + speed * 0.003) * insideFactor

  return {
    flowX,
    flowY,
    turbulenceX,
    turbulenceY,
    lift,
    vorticity: swirlStrength + shear * 0.4,
    burstX,
    burstY,
  }
}
