import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import WindCursor from './WindCursor'
import { buildParticleRestStates } from '../lib/graphemeParticles'
import { computeParagraphLayout } from '../lib/pretextLayout'
import { createRuntimeParticles, stepSimulation, type ParticleRuntimeState } from '../lib/simulation'
import type { PointerFieldState, SimulationParams } from '../lib/windField'

type WindParagraphProps = {
  text: string
  font: string
  lineHeight: number
  strength: number
  debug: boolean
  reducedMotion: boolean
}

type SnapshotState = {
  width: number
  height: number
  particles: ParticleRuntimeState[]
}

const MIN_WIDTH = 320
const HORIZONTAL_PADDING = 44
const VERTICAL_PADDING = 40

export default function WindParagraph({
  text,
  font,
  lineHeight,
  strength,
  debug,
  reducedMotion,
}: WindParagraphProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const particleRefs = useRef<Array<HTMLSpanElement | null>>([])
  const animationFrameRef = useRef<number | null>(null)
  const pointerRef = useRef<PointerFieldState>({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    inside: false,
    intensity: 0,
    dwell: 0,
  })
  const lastPointerSampleRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  const runtimeParticlesRef = useRef<ParticleRuntimeState[]>([])
  const [availableWidth, setAvailableWidth] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [snapshot, setSnapshot] = useState<SnapshotState | null>(null)
  const [cursorState, setCursorState] = useState({ x: 0, y: 0, speed: 0, heading: 0, visible: false, dwell: 0 })

  const params = useMemo<SimulationParams>(() => {
    const multiplier = reducedMotion ? 0.35 : strength
    return {
      drag: 8.5 * multiplier,
      spring: 20 / Math.max(0.45, multiplier),
      recoverySpring: 9 / Math.max(0.5, multiplier),
      damping: 5.2,
      lift: 55 * multiplier,
      vortexRadius: 128,
      vortexStrength: 52 * multiplier,
      gustStrength: 30 * multiplier,
      turbulenceStrength: 22 * multiplier,
      maxDisplacement: reducedMotion ? 44 : 1100,
      burstStrength: reducedMotion ? 0 : 320 * multiplier,
      burstRadius: reducedMotion ? 0 : 220,
    }
  }, [reducedMotion, strength])

  useLayoutEffect(() => {
    const shell = shellRef.current
    if (shell === null) return

    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry === undefined) return
      const width = Math.max(MIN_WIDTH, Math.floor(entry.contentRect.width - HORIZONTAL_PADDING * 2))
      setAvailableWidth(width)
    })
    observer.observe(shell)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function buildSnapshot() {
      if (availableWidth <= 0) return
      await document.fonts.ready
      if (cancelled) return

      // Pretext gives us the final wrapped paragraph. We then turn that stable
      // layout into particle anchors for the wind simulation.
      const layout = computeParagraphLayout(text, font, availableWidth, lineHeight)
      const particles = createRuntimeParticles(buildParticleRestStates(layout))
      runtimeParticlesRef.current = particles
      particleRefs.current = []
      setSnapshot({
        width: layout.width,
        height: layout.height + VERTICAL_PADDING * 2,
        particles,
      })
    }

    buildSnapshot()
    return () => {
      cancelled = true
    }
  }, [availableWidth, font, lineHeight, text])

  useEffect(() => {
    if (snapshot === null) return

    function renderFrame() {
      const nodes = particleRefs.current
      const particles = runtimeParticlesRef.current
      for (let index = 0; index < particles.length; index++) {
        const particle = particles[index]!
        const node = nodes[index]
        if (node === null || node === undefined) continue
        // Direct DOM writes are deliberate here. Hundreds of glyphs can move
        // every frame without asking React to rerender them all.
        node.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0) rotate(${particle.angle}rad)`
        node.style.opacity = particle.opacity.toFixed(3)
        node.style.filter = particle.blur > 0.15 ? `blur(${particle.blur.toFixed(2)}px)` : ''
      }
    }

    function tick(time: number) {
      const previous = lastFrameTimeRef.current ?? time
      const dt = Math.min(0.028, (time - previous) / 1000)
      lastFrameTimeRef.current = time

      const pointer = pointerRef.current
      const targetIntensity = hovered ? 1 : 0
      pointer.intensity += (targetIntensity - pointer.intensity) * Math.min(1, dt * 8)
      const pointerSpeed = Math.hypot(pointer.vx, pointer.vy)
      if (hovered && pointer.inside && pointerSpeed < 42) {
        // Holding the cursor nearly still charges the blowout effect.
        pointer.dwell = Math.min(1, pointer.dwell + dt * 0.65)
      } else {
        pointer.dwell = Math.max(0, pointer.dwell - dt * 0.9)
      }
      setCursorState(cursor =>
        cursor.visible || pointer.dwell > 0.001
          ? { ...cursor, dwell: pointer.dwell }
          : cursor,
      )

      const particles = runtimeParticlesRef.current
      const shouldAnimate = pointer.intensity > 0.01 || particles.some(p => Math.hypot(p.vx, p.vy, p.x - p.restX, p.y - p.restY) > 0.2)

      if (shouldAnimate) {
        stepSimulation(particles, dt, time, pointer, params)
        renderFrame()
      } else if (particles.length > 0) {
        renderFrame()
      }

      animationFrameRef.current = requestAnimationFrame(tick)
    }

    animationFrameRef.current = requestAnimationFrame(tick)
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
      lastFrameTimeRef.current = null
    }
  }, [hovered, params, snapshot])

  const supportsHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

  function updatePointer(clientX: number, clientY: number, time: number): void {
    const stage = stageRef.current
    if (stage === null) return
    const bounds = stage.getBoundingClientRect()
    const sample = lastPointerSampleRef.current
    const x = clientX - bounds.left
    const y = clientY - bounds.top

    let vx = 0
    let vy = 0
    if (sample !== null) {
      // Pointer velocity sets the wind direction. Fast sweeps feel like a hard
      // gust, while slow movement gives the dwell charge time to build.
      const dt = Math.max(0.001, (time - sample.t) / 1000)
      vx = (x - sample.x) / dt
      vy = (y - sample.y) / dt
    }
    lastPointerSampleRef.current = { x, y, t: time }
    pointerRef.current = {
      ...pointerRef.current,
      x,
      y,
      vx,
      vy,
      inside: true,
    }

    const speed = Math.hypot(vx, vy)
    setCursorState({
      x,
      y,
      speed,
      heading: Math.atan2(vy, vx || 0.0001),
      visible: hovered && supportsHover,
      dwell: pointerRef.current.dwell,
    })
  }

  function handlePointerEnter(event: React.PointerEvent<HTMLDivElement>): void {
    if (!supportsHover || reducedMotion) return
    setHovered(true)
    updatePointer(event.clientX, event.clientY, event.timeStamp)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (!supportsHover || reducedMotion) return
    updatePointer(event.clientX, event.clientY, event.timeStamp)
  }

  function handlePointerLeave(): void {
    pointerRef.current = {
      ...pointerRef.current,
      inside: false,
      vx: 0,
      vy: 0,
      dwell: 0,
    }
    lastPointerSampleRef.current = null
    setHovered(false)
    setCursorState(cursor => ({ ...cursor, visible: false, speed: 0, dwell: 0 }))
  }

  return (
    <div className={`wind-shell${hovered ? ' wind-shell--hovered' : ''}`} ref={shellRef}>
      <div className="wind-copy">
        <p className="wind-copy__eyebrow">Pretext + React</p>
        <h1>Wind tunnel typography</h1>
        <p className="wind-copy__lede">
          Move the cursor into the paragraph. The lines are computed by Pretext,
          then each grapheme rides a local wake, vortex ring, and spring-backed recovery field.
        </p>
      </div>

      {snapshot !== null ? (
        <div
          className={`wind-stage${hovered ? ' wind-stage--cursorless' : ''}`}
          ref={stageRef}
          style={{ height: `${snapshot.height}px` }}
          onPointerEnter={handlePointerEnter}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <div
            className="wind-particles"
            style={{
              width: `${snapshot.width}px`,
              height: `${snapshot.height}px`,
            }}
          >
            {snapshot.particles.map((particle, index) => (
              <span
                key={particle.id}
                ref={node => {
                  particleRefs.current[index] = node
                }}
                className={`wind-particle${particle.char.trim().length === 0 ? ' wind-particle--space' : ''}`}
                style={{
                  transform: `translate3d(${particle.restX}px, ${particle.restY}px, 0)`,
                }}
              >
                {particle.char === ' ' ? '\u00A0' : particle.char}
              </span>
            ))}
          </div>

          {debug ? (
            <div className="wind-debug" aria-hidden="true">
              {snapshot.particles.map(particle => (
                <span
                  key={`debug-${particle.id}`}
                  className="wind-debug__anchor"
                  style={{
                    transform: `translate3d(${particle.restX}px, ${particle.restY}px, 0)`,
                  }}
                />
              ))}
            </div>
          ) : null}

          <WindCursor
            x={cursorState.x}
            y={cursorState.y}
            speed={cursorState.speed}
            heading={cursorState.heading}
            visible={cursorState.visible}
            dwell={cursorState.dwell}
          />
        </div>
      ) : (
        <div className="wind-stage wind-stage--loading">
          <p>Preparing text geometry…</p>
        </div>
      )}
    </div>
  )
}
