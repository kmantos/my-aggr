import fs from 'fs'
import path from 'path'

/**
 * Coin logos (colored) from @web3icons/core, served as `coins/<SYMBOL>.svg`
 * (dev server) and emitted with the build. `virtual:coin-icons` exports the
 * list of available symbols, so the app only requests logos that exist.
 */

const SVGS = path.resolve(__dirname, 'node_modules/@web3icons/core/dist/svgs')

// symbols whose logo is a network logo (or another token's)
const ALIASES = {
  TON: 'networks/branded/ton',
  GRAM: 'networks/branded/ton',
  HYPE: 'networks/branded/hyper-evm'
}

function listIcons() {
  const icons = {}
  const dir = path.join(SVGS, 'tokens/branded')

  for (const file of fs.readdirSync(dir)) {
    const match = file.match(/^([A-Za-z0-9]+)\.svg\.js$/)

    if (match) {
      icons[match[1].toUpperCase()] = 'tokens/branded/' + match[1]
    }
  }

  for (const symbol in ALIASES) {
    if (fs.existsSync(path.join(SVGS, ALIASES[symbol] + '.svg.js'))) {
      icons[symbol] = ALIASES[symbol]
    }
  }

  return icons
}

// the package's modules are `var X = '<svg ...>'; export { X as default }`
function readSvg(source) {
  const content = fs.readFileSync(path.join(SVGS, source + '.svg.js'), 'utf8')
  const match = content.match(/=\s*'((?:[^'\\]|\\.)*)'/)

  if (!match) {
    return null
  }

  return JSON.parse(
    '"' + match[1].replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'
  )
}

export default function coinIcons() {
  let icons

  return {
    name: 'coin-icons',
    buildStart() {
      icons = listIcons()
    },
    resolveId(id) {
      if (id === 'virtual:coin-icons') {
        return '\0virtual:coin-icons'
      }
    },
    load(id) {
      if (id === '\0virtual:coin-icons') {
        return `export default ${JSON.stringify(Object.keys(icons).sort())}`
      }
    },
    configureServer(server) {
      icons = icons || listIcons()

      server.middlewares.use((req, res, next) => {
        const match = req.url && req.url.match(/\/coins\/([A-Z0-9]+)\.svg$/)
        const svg = match && icons[match[1]] && readSvg(icons[match[1]])

        if (!svg) {
          return next()
        }

        res.setHeader('Content-Type', 'image/svg+xml')
        res.end(svg)
      })
    },
    generateBundle() {
      for (const symbol in icons) {
        const svg = readSvg(icons[symbol])

        if (svg) {
          this.emitFile({
            type: 'asset',
            fileName: `coins/${symbol}.svg`,
            source: svg
          })
        }
      }
    }
  }
}
