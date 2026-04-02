import type { ParagraphLayoutSnapshot } from './pretextLayout'

export type ParticleRestState = {
  id: string
  char: string
  lineIndex: number
  index: number
  restX: number
  restY: number
  width: number
  mass: number
  seed: number
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

let measureCanvasContext: CanvasRenderingContext2D | null = null

function getMeasureContext(): CanvasRenderingContext2D {
  if (measureCanvasContext !== null) return measureCanvasContext
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('2D canvas context unavailable')
  measureCanvasContext = context
  return context
}

function segmentGraphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), part => part.segment)
}

function makeSeed(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function measureGraphemePrefixWidths(text: string, font: string): number[] {
  const context = getMeasureContext()
  context.font = font
  const graphemes = segmentGraphemes(text)
  const widths: number[] = []
  let prefix = ''

  for (const grapheme of graphemes) {
    // Measuring each growing prefix is a simple way to recover stable x
    // positions for graphemes without creating hidden DOM spans.
    prefix += grapheme
    widths.push(context.measureText(prefix).width)
  }

  return widths
}

export function buildParticleRestStates(layout: ParagraphLayoutSnapshot): ParticleRestState[] {
  const particles: ParticleRestState[] = []
  const baseY = Math.max(16, layout.lineHeight * 0.78)
  let absoluteIndex = 0

  for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex++) {
    const line = layout.lines[lineIndex]!
    const graphemes = segmentGraphemes(line.text)
    const prefixWidths = measureGraphemePrefixWidths(line.text, layout.font)

    let previousX = 0
    for (let graphemeIndex = 0; graphemeIndex < graphemes.length; graphemeIndex++) {
      const char = graphemes[graphemeIndex]!
      const nextX = prefixWidths[graphemeIndex]!
      const width = nextX - previousX
      previousX = nextX
      if (char === '\n') continue

      // Every grapheme gets a permanent home position. The wind pushes glyphs
      // away from this point, and the spring force brings them back later.
      const id = `${lineIndex}-${graphemeIndex}-${absoluteIndex}`
      particles.push({
        id,
        char,
        lineIndex,
        index: absoluteIndex,
        restX: line.x + nextX - width,
        restY: line.y + baseY,
        width,
        mass: 0.8 + Math.min(2.4, Math.max(0.55, width / 12)),
        seed: makeSeed(`${id}:${char}`),
      })
      absoluteIndex++
    }
  }

  return particles
}
