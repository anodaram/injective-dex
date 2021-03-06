<template>
  <v-market-layout>
    <template slot="trading-panel">
      <v-balances />
      <v-trading class="mt-1 flex-1" />
    </template>

    <v-market-chart slot="chart" :market="market" />
    <v-orderbook slot="order-books" />
    <v-orders slot="orders" />
  </v-market-layout>
</template>

<script lang="ts">
import Vue from 'vue'
import { UiSpotMarketWithToken } from '@injectivelabs/ui-common'
import VMarketLayout from '~/layouts/market.vue'
import VBalances from '~/components/partials/common/balances/index.vue'
import VTrading from '~/components/partials/spot/trading/index.vue'
import VMarketChart from '~/components/partials/common/market/chart.vue'
import VOrders from '~/components/partials/spot/orders.vue'
import VOrderbook from '~/components/partials/spot/orderbook.vue'
import { ORDERBOOK_POLLING_ENABLED } from '~/app/utils/constants'

export default Vue.extend({
  components: {
    VMarketLayout,
    VTrading,
    VBalances,
    VOrders,
    VOrderbook,
    VMarketChart
  },

  data() {
    return {
      interval: 0 as any
    }
  },

  computed: {
    market(): UiSpotMarketWithToken | undefined {
      return this.$accessor.spot.market
    }
  },

  mounted() {
    Promise.all([
      this.setOrderbookPolling(),
      this.$accessor.spot.initMarketStreams()
    ])
      .then(() => {})
      .catch(this.$onRejected)
  },

  beforeDestroy() {
    clearInterval(this.interval)
  },

  methods: {
    setOrderbookPolling() {
      if (ORDERBOOK_POLLING_ENABLED) {
        this.interval = setInterval(async () => {
          await this.$accessor.spot.pollOrderbook()
        }, 2000)
      }
    }
  }
})
</script>
