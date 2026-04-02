import type { ParticleRestState } from './graphemeParticles'
import { sampleWindField, type PointerFieldState, type SimulationParams } from './windField'

export type ParticleRuntimeState = ParticleRestState & {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  opacity: number
  blur: number
  detached: number
}

export function createRuntimeParticles(restStates: ParticleRestState[]): ParticleRuntimeState[] {
  return restStates.map(rest => ({
    ...rest,
    x: rest.restX,
    y: rest.restY,
    vx: 0,
    vy: 0,
    angle: 0,
    opacity: 1,
    blur: 0,
    detached: 0,
  }))
}

export function stepSimulation(
  particles: ParticleRuntimeState[],
  dt: number,
  timeMs: number,
  pointer: PointerFieldState,
  params: SimulationParams,
): void {
  for (const particle of particles) {
    const sample = sampleWindField(particle.x, particle.y, timeMs, particle.seed, pointer, params)
    const offsetX = particle.restX - particle.x
    const offsetY = particle.restY - particle.y

    // We keep two spring modes:
    // - a tighter one while the glyph is still mostly attached
    // - a softer recovery spring after a burst has thrown it far away
    const accelX =
      offsetX * (particle.detached > 0.12 ? params.recoverySpring : params.spring) +
      (sample.flowX + sample.turbulenceX + sample.burstX - particle.vx) * params.drag
    const accelY =
      offsetY * (particle.detached > 0.12 ? params.recoverySpring : params.spring) +
      (sample.flowY + sample.turbulenceY + sample.burstY - particle.vy) * params.drag -
      sample.lift / particle.mass

    particle.vx += accelX * dt
    particle.vy += accelY * dt

    particle.vx *= Math.max(0, 1 - params.damping * dt)
    particle.vy *= Math.max(0, 1 - params.damping * dt)

    particle.x += particle.vx * dt
    particle.y += particle.vy * dt

    const dx = particle.x - particle.restX
    const dy = particle.y - particle.restY
    const displacement = Math.hypot(dx, dy)
    if (sample.burstX !== 0 || sample.burstY !== 0) {
      // "Detached" tracks whether this glyph is in the dramatic blowout phase.
      particle.detached = Math.min(1, particle.detached + dt * 1.9)
    } else {
      particle.detached = Math.max(0, particle.detached - dt * 1.1)
    }

    if (displacement > params.maxDisplacement && particle.detached < 0.35) {
      // Ordinary gusts stay local. Once the burst is strong enough we stop
      // clamping hard, which lets letters fly well beyond the paragraph.
      const ratio = params.maxDisplacement / displacement
      particle.x = particle.restX + dx * ratio
      particle.y = particle.restY + dy * ratio
      particle.vx *= 0.7
      particle.vy *= 0.7
    }

    const speed = Math.hypot(particle.vx, particle.vy)
    particle.angle = particle.angle * 0.82 + (sample.vorticity * 0.03 + particle.vx * 0.015) * 0.18
    particle.opacity = Math.max(0.08, Math.min(1, 1 - displacement / (params.maxDisplacement * 2.2) - particle.detached * 0.2))
    particle.blur = Math.min(8, speed * 0.028 + particle.detached * 1.8)
  }
}
