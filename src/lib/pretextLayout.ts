import { layoutWithLines, prepareWithSegments, type PreparedTextWithSegments } from '@chenglou/pretext'

export type ParagraphLayoutLine = {
  text: string
  width: number
  x: number
  y: number
}

export type ParagraphLayoutSnapshot = {
  text: string
  font: string
  lineHeight: number
  width: number
  height: number
  lineCount: number
  prepared: PreparedTextWithSegments
  lines: ParagraphLayoutLine[]
}

const preparedCache = new Map<string, PreparedTextWithSegments>()

function getPrepared(text: string, font: string): PreparedTextWithSegments {
  const key = `${font}::${text}`
  const cached = preparedCache.get(key)
  if (cached !== undefined) return cached
  const prepared = prepareWithSegments(text, font)
  preparedCache.set(key, prepared)
  return prepared
}

export function computeParagraphLayout(
  text: string,
  font: string,
  width: number,
  lineHeight: number,
): ParagraphLayoutSnapshot {
  // Pretext decides where every line should wrap. The animation layer only
  // starts after we know this "resting" layout.
  const prepared = getPrepared(text, font)
  const layout = layoutWithLines(prepared, width, lineHeight)
  const lines = layout.lines.map((line, index) => ({
    text: line.text,
    width: line.width,
    x: 0,
    y: index * lineHeight,
  }))

  return {
    text,
    font,
    lineHeight,
    width,
    height: layout.height,
    lineCount: layout.lineCount,
    prepared,
    lines,
  }
}
