<template>
  <CompactCard :tx="(tx as any)">
    <ProfileBadge
      :address="tx.from"
      :name="fromIdentity?.name"
      :profile-url="fromProfileUrl"
      :is-bot="fromIsBot"
      size="x-small"
    />

    <div class="basis-full h-0 sm:hidden"></div>

    <span class="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1 flex-wrap">
      {{ actionText }}
      <span v-if="valueDisplay" class="font-medium text-neutral-800 dark:text-neutral-200">
        {{ valueDisplay }}
      </span>
      on
      <a
        href="https://stakingverse.io/"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200 hover:underline"
      >
        <img
          src="/assets/images/stakingverse-logo.png"
          class="w-5 h-5 -my-0.5 rounded object-cover"
          alt=""
          aria-hidden="true"
        />
        <span>Stakingverse</span>
      </a>
    </span>

    <TimeStamp :timestamp="tx.blockTimestamp" />
  </CompactCard>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import type { Transaction } from '../../lib/types'
import { useAddressResolver } from '../../composables/useAddressResolver'
import { formatFunctionName, formatLYX, optimizeImageUrl } from '../../lib/formatters'
import { isBot as checkIsBot } from '../../lib/eoa'
import CompactCard from './CompactCard.vue'
import ProfileBadge from '../shared/ProfileBadge.vue'
import TimeStamp from '../shared/TimeStamp.vue'

const props = defineProps<{
  tx: Transaction
  chainId: number
}>()

const { getIdentity, queueResolve } = useAddressResolver()

watchEffect(() => {
  const addrs = [props.tx.from, props.tx.to].filter(Boolean)
  if (addrs.length) queueResolve(props.chainId, addrs)
})

const fromIdentity = computed(() => getIdentity(props.tx.from))
const fromIsBot = computed(() => checkIsBot(fromIdentity.value))
const fromProfileUrl = computed(() => {
  const images = fromIdentity.value?.profileImages
  if (!images?.length) return ''
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const src = (sorted.find(i => i.width >= 32) || sorted[0]).src
  return optimizeImageUrl(src, 24)
})

const actionText = computed(() => {
  const fn = props.tx.functionName || ''
  switch (fn) {
    case 'deposit':
      return 'staked'
    case 'withdraw':
      return 'withdrew'
    case 'claim':
      return 'claimed'
    case 'transferStake':
      return 'transferred stake'
    case 'burn':
      return 'burned'
    default:
      return formatFunctionName(fn).toLowerCase()
  }
})

const valueDisplay = computed(() => formatLYX(props.tx.value || '0'))
</script>
