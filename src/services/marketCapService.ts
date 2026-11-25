/**
 * Biggest coins by market cap, from CoinGecko's public API (fetched in the
 * browser, cached for a day). Stablecoins and wrapped / staked / bridged
 * tokens are left out: they're quotes or copies of another coin, never a
 * pane's coin.
 */

const API = 'https://api.coingecko.com/api/v3/coins/markets'
const CACHE_KEY = 'TOP_COINS_BY_MARKET_CAP'
const CACHE_DURATION = 1000 * 60 * 60 * 24
const COUNT = 100

// used until the list is fetched (or when CoinGecko can't be reached)
export const FALLBACK_TOP_COINS = [
  'BTC',
  'ETH',
  'BNB',
  'XRP',
  'SOL',
  'TRX',
  'HYPE',
  'ZEC',
  'XMR',
  'DOGE',
  'BCH',
  'LINK',
  'ADA',
  'XLM',
  'LEO',
  'NEAR',
  'SUI',
  'AVAX',
  'LTC',
  'HBAR',
  'GRAM',
  'TON',
  'SHIB',
  'DOT',
  'UNI',
  'AAVE',
  'CRO',
  'TAO',
  'PEPE',
  'ETC',
  'APT',
  'ICP',
  'ONDO',
  'ENA',
  'POL'
]

// in case the stablecoins category can't be fetched
export const STABLECOINS = [
  'USDT',
  'USDC',
  'USDE',
  'USDS',
  'DAI',
  'FDUSD',
  'TUSD',
  'USDD',
  'USDP',
  'BUSD',
  'PYUSD',
  'RLUSD',
  'USD1',
  'USDG',
  'USDT0',
  'USDTB',
  'USD0',
  'GHO',
  'FRAX',
  'UST',
  'EURC',
  'EURT'
]

// wrapped / staked copies of another coin
export const COPY_TOKENS = [
  'WBTC',
  'WETH',
  'STETH',
  'WSTETH',
  'WEETH',
  'EETH',
  'CBBTC',
  'CBETH',
  'RETH',
  'BETH',
  'WBETH',
  'METH',
  'EZETH',
  'RSETH',
  'BTCB',
  'SOLVBTC',
  'LBTC',
  'JITOSOL',
  'MSOL',
  'BNSOL',
  'WBNB',
  'WTRX'
]

const COPY_TOKEN_REGEX = /wrapped|staked|bridged|restaked|liquid staking/i

interface CoinGeckoMarket {
  symbol: string
  name: string
}

export interface MarketCapCoins {
  // biggest first
  coins: string[]
  // stablecoins and wrapped / staked copies, never a pane's coin
  excluded: string[]
}

const FALLBACK: MarketCapCoins = {
  coins: FALLBACK_TOP_COINS,
  excluded: STABLECOINS.concat(COPY_TOKENS)
}

let promiseOfTopCoins: Promise<MarketCapCoins> = null

function readCache(): MarketCapCoins | null {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY))

    if (
      cache &&
      Array.isArray(cache.coins) &&
      cache.coins.length &&
      Array.isArray(cache.excluded) &&
      Date.now() - cache.timestamp < CACHE_DURATION
    ) {
      return { coins: cache.coins, excluded: cache.excluded }
    }
  } catch (error) {
    // no cache
  }

  return null
}

function writeCache(data: MarketCapCoins) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...data, timestamp: Date.now() })
    )
  } catch (error) {
    // storage unavailable
  }
}

async function fetchMarkets(category?: string): Promise<CoinGeckoMarket[]> {
  const params = new URLSearchParams({
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: COUNT.toString(),
    page: '1'
  })

  if (category) {
    params.set('category', category)
  }

  const response = await fetch(`${API}?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`CoinGecko responded ${response.status}`)
  }

  return response.json()
}

async function fetchTopCoins(): Promise<MarketCapCoins> {
  const [markets, stablecoins] = await Promise.all([
    fetchMarkets(),
    fetchMarkets('stablecoins').catch(() => [] as CoinGeckoMarket[])
  ])

  const excluded = STABLECOINS.concat(
    COPY_TOKENS,
    stablecoins.map(coin => coin.symbol.toUpperCase())
  )
  const coins: string[] = []

  for (const coin of markets) {
    const symbol = coin.symbol.toUpperCase()

    if (COPY_TOKEN_REGEX.test(coin.name)) {
      excluded.push(symbol)
    }

    if (excluded.indexOf(symbol) !== -1 || coins.indexOf(symbol) !== -1) {
      continue
    }

    coins.push(symbol)
  }

  if (!coins.length) {
    throw new Error('empty list')
  }

  return {
    coins,
    excluded: excluded.filter(
      (symbol, index, all) => all.indexOf(symbol) === index
    )
  }
}

/**
 * symbols (uppercase) of the biggest coins by market cap (biggest first) and
 * of the stablecoins / wrapped tokens
 */
export function getTopCoins(): Promise<MarketCapCoins> {
  const cached = readCache()

  if (cached) {
    return Promise.resolve(cached)
  }

  if (!promiseOfTopCoins) {
    promiseOfTopCoins = fetchTopCoins()
      .then(data => {
        writeCache(data)
        return data
      })
      .catch(error => {
        console.warn('[market cap] using the built-in coins list', error)
        // retry on next call
        promiseOfTopCoins = null
        return FALLBACK
      })
  }

  return promiseOfTopCoins
}
