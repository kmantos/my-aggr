/**
 * Make sure visitors run the latest deployed version.
 *
 * Every build publishes version.json with its build id. When the published
 * build differs from the running one (on load, when the tab becomes visible
 * again, and every few minutes), the page reloads to pick up the new version.
 * Asset file names are content hashed, so a reload always gets fresh code.
 */
const BUILD_ID = import.meta.env.VITE_APP_BUILD_ID
const CHECK_INTERVAL = 5 * 60 * 1000
const RELOADED_FOR_KEY = 'reloaded-for-build'

async function checkForUpdate() {
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`,
      { cache: 'no-store' }
    )

    if (!response.ok) {
      return
    }

    const { build } = await response.json()

    if (!build || build === BUILD_ID) {
      return
    }

    // reload only once per new build, to avoid a loop if the page itself
    // is still served from cache for a little while
    if (sessionStorage.getItem(RELOADED_FOR_KEY) === build) {
      return
    }

    sessionStorage.setItem(RELOADED_FOR_KEY, build)

    console.info(`[update] new version ${build} (running ${BUILD_ID})`)

    window.location.reload()
  } catch (error) {
    // offline, blocked storage... try again later
  }
}

export function watchForUpdates() {
  if (import.meta.env.DEV || !BUILD_ID) {
    return
  }

  checkForUpdate()

  setInterval(checkForUpdate, CHECK_INTERVAL)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdate()
    }
  })
}
