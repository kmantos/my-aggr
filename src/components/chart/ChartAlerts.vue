<template>
  <div class="chart-alerts">
    <div v-if="!alertsEnabled" class="chart-alerts__off">
      <p class="mt0 text-color-50">Price alerts are turned off.</p>
      <button type="button" class="btn -green" @click="enableAlerts">
        Turn on price alerts
      </button>
    </div>

    <template v-else>
      <div class="chart-alerts__header">
        <span class="chart-alerts__title">
          {{ market || 'Alerts' }}
          <small v-if="alerts.length" class="text-color-50">
            · {{ alerts.length }} alert{{ alerts.length === 1 ? '' : 's' }}
          </small>
        </span>
        <span v-if="currentPrice" class="chart-alerts__price text-color-50">
          now {{ formatPrice(currentPrice) }}
        </span>
      </div>

      <form class="chart-alerts__add" @submit.prevent="addAlert">
        <input
          v-model="newPrice"
          type="text"
          inputmode="decimal"
          class="form-control"
          :placeholder="currentPrice ? formatPrice(currentPrice) : 'Price'"
          :disabled="!market"
        />
        <button
          type="submit"
          class="btn -green"
          :disabled="!market || isAdding"
        >
          <i class="icon-plus"></i>
          <span class="ml8">Add alert</span>
        </button>
      </form>

      <p v-if="!alerts.length" class="text-color-50 mb0">
        No {{ market }} alert yet.
      </p>

      <table v-else class="table chart-alerts__table">
        <tbody>
          <tr
            v-for="alert of sortedAlerts"
            :key="alert.price"
            :class="{ '-triggered': alert.triggered }"
          >
            <td class="chart-alerts__price-cell">
              <i class="icon-dollar"></i>
              <input
                type="text"
                inputmode="decimal"
                class="form-control"
                :value="
                  typeof drafts[alert.price] === 'string'
                    ? drafts[alert.price]
                    : formatPrice(alert.price)
                "
                :disabled="alert.triggered"
                title="Edit, then Save to move the alert"
                @input="$set(drafts, alert.price, $event.target.value)"
              />
            </td>
            <td v-if="isEdited(alert)" class="chart-alerts__save">
              <button
                type="button"
                class="btn -green -small"
                @click="saveAlert(alert)"
              >
                Save
              </button>
            </td>
            <td
              v-else
              class="chart-alerts__status"
              :class="'-' + getStatus(alert)"
            >
              {{ statusLabels[getStatus(alert)] }}
              <button
                v-if="getStatus(alert) === 'missing'"
                type="button"
                class="btn -text -small"
                title="Register it again"
                v-tippy
                @click="recreateAlert(alert)"
              >
                <i class="icon-refresh"></i>
              </button>
            </td>
            <td class="table-action">
              <button
                type="button"
                class="btn -text -small"
                title="Remove"
                v-tippy
                @click="removeAlert(alert)"
              >
                <i class="icon-cross"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import alertService, {
  AlertEvent,
  AlertEventType,
  MarketAlert
} from '@/services/alertService'
import aggregatorService from '@/services/aggregatorService'
import { formatMarketPrice } from '@/services/productsService'
import paneActions from '@/utils/paneActions'

type AlertStatus = 'checking' | 'active' | 'triggered' | 'missing' | 'unknown'

/**
 * Alerts tab of the chart settings: the chart's coin alerts, add / edit price
 * / remove, status checked with the alerts server when the tab opens
 */
@Component({
  name: 'ChartAlerts',
  props: {
    paneId: {
      type: String,
      required: true
    }
  }
})
export default class ChartAlerts extends Vue {
  paneId: string

  market: string = null
  currentPrice: number = null
  alerts: MarketAlert[] = []
  statuses: { [price: string]: AlertStatus } = {}
  newPrice = ''
  isAdding = false
  // edited prices, by original price
  drafts: { [price: string]: string } = {}
  priceFormat: (price: number) => string = null

  statusLabels = {
    checking: 'Checking…',
    active: 'Active',
    triggered: 'Triggered',
    missing: 'Not found',
    unknown: 'Inactive'
  }

  get alertsEnabled() {
    return this.$store.state.settings.alerts
  }

  get sortedAlerts() {
    return this.alerts.slice().sort((a, b) => b.price - a.price)
  }

  async created() {
    aggregatorService.on('alert', this.onAlert)

    // the chart knows its alerts market (ex: BTCUSD) and current price
    paneActions.emit(
      'alerts-context',
      this.paneId,
      ({
        market,
        price,
        format
      }: {
        market: string
        price: number
        format: (price: number) => string
      }) => {
        this.market = market
        this.currentPrice = price
        this.priceFormat = format
      }
    )

    if (this.market) {
      await this.loadAlerts()
    }
  }

  beforeDestroy() {
    aggregatorService.off('alert', this.onAlert)
  }

  async loadAlerts() {
    const alerts = (await alertService.getAlerts(this.market)) || []

    this.alerts = alerts.map(alert => ({ ...alert }))

    for (const alert of this.alerts) {
      this.$set(
        this.statuses,
        alert.price,
        alert.triggered ? 'triggered' : 'checking'
      )
    }

    // ask the alerts server which alerts are still waiting
    await Promise.all(
      this.alerts
        .filter(alert => !alert.triggered)
        .map(alert => this.checkStatus(alert))
    )
  }

  async checkStatus(alert: MarketAlert) {
    const response = await alertService.toggleAlert(
      alert.market,
      alert.price,
      undefined,
      undefined,
      true
    )

    let status: AlertStatus

    if (!response || response.error) {
      // no push permission or server unreachable
      status = alert.active ? 'active' : 'unknown'
    } else if (response.alert) {
      status = 'active'
    } else {
      status = 'missing'
      await alertService.deactivateAlert(alert)
    }

    this.$set(this.statuses, alert.price, status)
  }

  getStatus(alert: MarketAlert): AlertStatus {
    if (alert.triggered) {
      return 'triggered'
    }

    return this.statuses[alert.price] || (alert.active ? 'active' : 'unknown')
  }

  formatPrice(price: number) {
    if (this.priceFormat) {
      return this.priceFormat(price)
    }

    return formatMarketPrice(price, this.market)
  }

  // status once the alerts server answered (or didn't) a create / move
  setStatusFromAlert(price: number) {
    const alert = this.alerts.find(alert => alert.price === price)

    if (alert && this.statuses[price] === 'checking') {
      this.$set(
        this.statuses,
        price,
        alert.triggered ? 'triggered' : alert.active ? 'active' : 'unknown'
      )
    }
  }

  parsePrice(value: string) {
    const price = +value.replace(/[^0-9.]/g, '')

    return price > 0 ? price : null
  }

  async addAlert() {
    const price = this.parsePrice(this.newPrice)

    if (!price || !this.market) {
      return
    }

    if (this.alerts.some(alert => alert.price === price)) {
      this.newPrice = ''
      return
    }

    this.isAdding = true

    try {
      await alertService.createAlert(
        {
          price,
          market: this.market,
          timestamp: Math.floor(Date.now() / 1000),
          active: false
        },
        this.currentPrice
      )
      this.newPrice = ''
      this.setStatusFromAlert(price)
    } finally {
      this.isAdding = false
    }
  }

  // price typed but not saved yet
  isEdited(alert: MarketAlert) {
    const draft = this.drafts[alert.price]

    return typeof draft === 'string' && draft !== this.formatPrice(alert.price)
  }

  // the alert only moves when Save is clicked
  async saveAlert(alert: MarketAlert) {
    const draft = this.drafts[alert.price]
    const price = this.parsePrice(draft || '')

    this.$delete(this.drafts, alert.price)

    if (!price || price === alert.price) {
      return
    }

    await alertService.moveAlert(
      alert.market,
      alert.price,
      { ...alert, price, active: false },
      this.currentPrice
    )
    this.setStatusFromAlert(price)
  }

  async recreateAlert(alert: MarketAlert) {
    await alertService.removeAlert(alert)
    await alertService.createAlert(
      { ...alert, active: false, triggered: false },
      this.currentPrice
    )
  }

  async removeAlert(alert: MarketAlert) {
    await alertService.removeAlert(alert)
  }

  enableAlerts() {
    this.$store.commit('settings/TOGGLE_ALERTS', true)
  }

  // keep the list in sync (alerts placed / moved / removed on the chart too)
  onAlert({ price, market, type, newPrice }: AlertEvent) {
    if (market !== this.market) {
      return
    }

    const index = this.alerts.findIndex(alert => alert.price === price)

    if (type === AlertEventType.CREATED && index === -1) {
      this.alerts.push({ price, market })
      this.$set(this.statuses, price, 'checking')

      // placed on the chart: no answer from the alerts server after a while
      setTimeout(() => this.setStatusFromAlert(price), 10000)
    } else if (index === -1) {
      return
    } else if (type === AlertEventType.DELETED) {
      this.alerts.splice(index, 1)
    } else if (type === AlertEventType.UPDATED) {
      this.$set(this.alerts[index], 'price', newPrice)
      this.$set(this.alerts[index], 'active', false)
      this.$set(this.statuses, newPrice, 'checking')
    } else if (type === AlertEventType.ACTIVATED) {
      this.$set(this.alerts[index], 'active', true)
      this.$set(this.statuses, price, 'active')
    } else if (type === AlertEventType.DEACTIVATED) {
      this.$set(this.alerts[index], 'active', false)
    } else if (type === AlertEventType.TRIGGERED) {
      this.$set(this.alerts[index], 'triggered', true)
      this.$set(this.statuses, price, 'triggered')
    }
  }
}
</script>

<style lang="scss" scoped>
.chart-alerts {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  &__title {
    font-weight: 500;
  }

  &__add {
    display: flex;
    gap: 0.5rem;

    .form-control {
      flex-grow: 1;
      min-width: 0;
      font-family: $font-monospace;
    }
  }

  &__table {
    width: 100%;

    tr.-triggered {
      opacity: 0.6;
    }

    td {
      vertical-align: middle;
    }
  }

  &__price-cell {
    display: flex;
    align-items: center;
    gap: 0.25rem;

    i {
      opacity: 0.5;
      font-size: 0.75em;
    }

    .form-control {
      width: 100%;
      min-width: 0;
      padding: 0.25rem 0.375rem;
      border-color: transparent;
      background: none;
      font-family: $font-monospace;

      &:hover:not(:disabled),
      &:focus {
        border-color: var(--theme-background-200);
      }
    }
  }

  &__save {
    text-align: right;
  }

  &__status {
    white-space: nowrap;
    text-align: right;
    font-weight: 600;

    &.-active {
      color: var(--theme-buy-100);
    }

    &.-triggered {
      font-weight: 400;
    }

    &.-missing {
      color: var(--theme-sell-100);
    }

    &.-checking,
    &.-unknown {
      opacity: 0.6;
      font-weight: 400;
    }
  }
}
</style>
