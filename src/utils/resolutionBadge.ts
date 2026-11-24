import store from '@/store'
import { IS_CAR_BROWSER } from './constants'

/**
 * Optional screen resolution label (Settings > Other > Show screen resolution):
 * window size, pixel ratio, screen size, car detection and the browser
 * identifier, on the left of the screen. Below dialogs (z-index 10).
 */
let badge: HTMLElement = null

function render() {
  if (!badge) {
    return
  }

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

function show() {
  if (badge) {
    return
  }

  badge = document.createElement('div')
  badge.className = 'resolution-badge'
  badge.style.cssText = [
    'position: fixed',
    'left: 0',
    'top: 50%',
    'transform: translateY(-50%)',
    'z-index: 5',
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

  render()
  window.addEventListener('resize', render)
  document.body.appendChild(badge)
}

function hide() {
  if (!badge) {
    return
  }

  window.removeEventListener('resize', render)
  badge.remove()
  badge = null
}

export function watchResolutionBadge() {
  store.watch(
    state =>
      !!(state as any).settings && (state as any).settings.showResolution,
    enabled => (enabled ? show() : hide()),
    { immediate: true }
  )
}
