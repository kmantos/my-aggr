import Exchange from '../exchange'

export default class WHITEBIT extends Exchange {
  id = 'WHITEBIT'

  // WhiteBIT sends the latest past trades right after subscribing: remember
  // when each pair was subscribed to drop that backlog (not live trades)
  private subscribedAt: { [pair: string]: number } = {}

  protected endpoints = {
    PRODUCTS: [
        'https://whitebit.com/api/v4/public/markets'
    ]
  }

  async getUrl() {
    return 'wss://api.whitebit.com/ws'
  }

  formatProducts(response) {
    const products = [...response.map(p => p.name)];
    const productsUniqueSet = [...new Set(products)];
    return productsUniqueSet;
  }

  /**
   * Sub
   * @param {WebSocket} api
   * @param {string} pair
   */
  async subscribe(api, pair) {
    if (!(await super.subscribe(api, pair))) {
      return
    }

    this.subscribedAt[pair] = Date.now()

    api.send(
      JSON.stringify({
        id: 8,
        method: 'trades_subscribe',
        params: [pair]
      })
    )

    return true
  }

  /**
   * Unsub
   * @param {WebSocket} api
   * @param {string} pair
   */
  async unsubscribe(api, pair) {
    if (!(await super.unsubscribe(api, pair))) {
      return
    }

    api.send(
      JSON.stringify({
         id: 9,
         method: 'trades_unsubscribe',
         params: [pair]
      })
    )

    return true
  }

  formatTrade(market, trade) {
    const data = {
      exchange: this.id,
      pair: market,
      timestamp: parseInt((trade.time * 1000).toString()),
      price: +parseFloat(trade.price),
      size: parseFloat(trade.amount),
      side: trade.type
    }
    return data;
  }

  onMessage(event, api) {
    const json = JSON.parse(event.data)

    if (!json || json.method !== 'trades_update') {
      return;
    }

    const market = json.params[0]
    let trades = json.params[1].map(trade => this.formatTrade(market, trade))

    // first update after subscribing = backlog of past trades: keep only the
    // ones from the subscription on (2s margin for clocks differences)
    if (this.subscribedAt[market]) {
      const since = this.subscribedAt[market] - 2000

      delete this.subscribedAt[market]

      trades = trades.filter(trade => trade.timestamp >= since)
    }

    return this.emitTrades(api.id, trades)
  }

  onApiCreated(api) {
    this.startKeepAlive(api, { id: 0, method: 'ping', params: [] }, 30000)
  }

  onApiRemoved(api) {
    this.stopKeepAlive(api)
  }
}
