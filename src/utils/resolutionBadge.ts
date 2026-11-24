import { IS_CAR_BROWSER } from './constants'

/**
 * TEMPORARY: shows the screen resolution, pixel ratio, car detection and the
 * browser identifier on the left of the screen, so the size used on a car
 * screen can be tuned. Remove once the car's resolution is known.
 */
export function showResolutionBadge() {
  const badge = document.createElement('div')

  badge.className = 'resolution-badge'
  badge.style.cssText = [
    'position: fixed',
    'left: 0',
    'top: 50%',
    'transform: translateY(-50%)',
    'z-index: 1000',
    'max-width: min(60vw, 420px)',
    'padding: 6px 8px',
    'border-radius: 0 6px 6px 0',
    'background: rgba(0, 0, 0, 0.75)',
    'color: #fff',
    'font-size: 12px',
    'line-height: 1.4',
    'user-select: text',
    'word-break: break-all'
  ].join(';')

  const render = () => {
    const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100

    badge.innerHTML = `
      <strong>${window.innerWidth}×${window.innerHeight}</strong> @${dpr}x
      · screen ${window.screen.width}×${window.screen.height}
      · car: ${IS_CAR_BROWSER ? 'yes' : 'no'}
      <div style="opacity:.75;font-size:11px;margin-top:2px"></div>
    `
    // browser identifier as text (no html)
    badge.lastElementChild.textContent = navigator.userAgent
  }

  render()
  window.addEventListener('resize', render)
  document.body.appendChild(badge)
}
