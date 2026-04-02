import { useEffect, useState } from 'react'
import WindParagraph from './components/WindParagraph'

const BODY_FONT = '400 30px "Cormorant Garamond", Georgia, serif'
const LINE_HEIGHT = 44

const COPY = `The forecast arrives as a pressure change before it becomes a sound. One second the paragraph sits in ordered columns, resting on its measured baseline, and the next a hard lateral gust pulls through the sentence like weather crossing an open plain. Serifs cant into the wake, counters catch stray eddies, and every grapheme rides a different ribbon of air before the springs under the text gather it back into shape.

This demo uses Pretext to lock the multiline geometry first, then lets the cursor behave like a moving wind source. A pointer pass injects velocity, vortex swirl, and turbulent lift into each character while the paragraph keeps a stable underlying structure. It should feel less like confetti and more like a sheet of printed matter being hit by a fast, dirty crosswind.`

function useReducedMotionPreference(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return reducedMotion
}

export default function App() {
  const reducedMotion = useReducedMotionPreference()
  const [strength, setStrength] = useState(1)
  const [debug, setDebug] = useState(false)

  return (
    <main className="app-shell">
      <section className="app-panel">
        <div className="app-toolbar">
          <label className="app-control">
            <span>Wind strength</span>
            <input
              type="range"
              min="0.6"
              max="1.6"
              step="0.05"
              value={strength}
              onChange={event => setStrength(Number.parseFloat(event.target.value))}
            />
            <strong>{strength.toFixed(2)}x</strong>
          </label>

          <label className="app-checkbox">
            <input
              type="checkbox"
              checked={debug}
              onChange={event => setDebug(event.target.checked)}
            />
            <span>Show anchors</span>
          </label>

          <div className="app-note">
            {reducedMotion ? 'Reduced motion active: softened displacement mode enabled.' : 'Hover inside the paragraph to generate a tornado-like wake.'}
          </div>
        </div>

        <WindParagraph
          text={COPY}
          font={BODY_FONT}
          lineHeight={LINE_HEIGHT}
          strength={strength}
          debug={debug}
          reducedMotion={reducedMotion}
        />
      </section>
    </main>
  )
}
