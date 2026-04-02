type WindCursorProps = {
  x: number
  y: number
  speed: number
  heading: number
  visible: boolean
  dwell: number
}

export default function WindCursor({ x, y, speed, heading, visible, dwell }: WindCursorProps) {
  const stretch = Math.min(1.5, 1 + speed * 0.009 + dwell * 0.12)
  const glow = Math.min(1, 0.25 + speed * 0.0014 + dwell * 0.45)
  const debrisCount = 5

  return (
    <div
      className={`wind-cursor${visible ? ' wind-cursor--visible' : ''}`}
      style={{
        transform: `translate3d(${x}px, ${y}px, 0) rotate(${heading}rad) scale(${stretch}, 1)`,
        ['--wind-glow' as string]: `${glow}`,
      }}
      aria-hidden="true"
    >
      {/* Keep the cursor small and quiet.
          It should feel like a compact gust marker, not a second main character. */}
      <span className="wind-cursor__aura wind-cursor__aura--core" />
      <span className="wind-cursor__aura wind-cursor__aura--tail" />
      <svg viewBox="0 0 54 38" className="wind-cursor__svg">
        <path className="wind-cursor__stroke wind-cursor__stroke--main" d="M7 20C14 15 22 15 29 19C35 22 41 22 48 18" />
        <path className="wind-cursor__stroke wind-cursor__stroke--tail" d="M10 27C17 24 23 24 29 27C35 29 40 29 46 26" />
        <circle cx={12 + dwell * 1.8} cy="20" r="3.2" className="wind-cursor__core" />
      </svg>
      <span className="wind-cursor__debris">
        {Array.from({ length: debrisCount }, (_, index) => (
          <span
            key={index}
            className="wind-cursor__speck"
            style={{
              ['--speck-index' as string]: `${index}`,
              ['--speck-delay' as string]: `${index * -0.16}s`,
              ['--speck-x' as string]: `${12 + index * 5}px`,
              ['--speck-y' as string]: `${11 + (index % 3) * 5}px`,
            }}
          />
        ))}
      </span>
    </div>
  )
}
