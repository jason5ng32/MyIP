<template>
  <!-- DNS Leak Test -->
  <section class="mb-10">
    <!-- Header -->
    <header class="mb-2 flex flex-col items-start justify-between gap-4">
      <div class="flex flex-row items-center justify-between gap-4 w-full">
        <h2 id="DNSLeakTest"
          class="m-0 flex min-w-0 flex-1 items-center gap-2 text-xl md:text-3xl font-semibold tracking-tight leading-tight">
          🛑 {{ t('dnsleaktest.Title') }}
        </h2>
        <JnTooltip :text="t('Tooltips.RefreshDNSLeakTest')" side="left">
          <Button size="icon" variant="outline" class="shrink-0 cursor-pointer" @click="checkAllDNSLeakTest(true)"
            aria-label="Refresh DNS Leak Test">
            <component :is="isStarted ? RotateCw : Play" />
          </Button>
        </JnTooltip>
      </div>
      <div class="text-base text-muted-foreground">
        <p v-if="!isSimpleMode">{{ t('dnsleaktest.Note') }}</p>
        <p v-if="!isSimpleMode">{{ t('dnsleaktest.Note2') }}</p>
      </div>
    </header>

    <!-- Card grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card v-for="(leak, index) in leakTest" :key="leak.id"
        class="keyboard-shortcut-card jn-card min-w-0 overflow-hidden transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50">
        <CardContent class="p-4 min-w-0">
          <!-- Top: heartbeat icon + name + index -->
          <div class="flex flex-col gap-2 mb-3 w-full min-w-0">
            <div class="flex items-center gap-2 min-w-0 w-full">
              <DoorOpen class="size-6 text-muted-foreground shrink-0" />
              <span class="text-base font-medium truncate min-w-0 flex-1">{{ leak.name }}</span>

              <span class="font-mono text-muted-foreground shrink-0">#{{ index + 1 }}</span>
            </div>
            <!-- Provider name (secondary information) — fixed per card, sourced
                 from each provider's `name` export in utils/dnsleaks. -->
            <p class="w-full min-w-0 mb-1 text-xs font-mono text-muted-foreground truncate"
              :title="leak.providerName">
              {{ leak.providerName }}
            </p>
          </div>

          <!-- Endpoint status row -->
          <div class="flex items-center gap-1.5 mb-3 min-w-0 min-h-6">
            <span class="relative flex shrink-0">
              <span v-if="toneOf(leak) === 'wait'"
                class="absolute inline-flex size-2 rounded-full bg-info opacity-75 animate-ping"></span>
              <span class="relative inline-flex size-2 rounded-full" :class="dotClass(toneOf(leak))"></span>
            </span>
            <FitText :text="leak.ip" :tiers="INLINE_TIERS" :title="leak.ip" class="font-mono min-w-0"
              :class="textClass(toneOf(leak))" data-mask="ip" />
          </div>

          <!-- ISP + Country sub-block -->
          <dl class="rounded-md bg-muted/50 p-3 space-y-2 text-sm">
            <div>
              <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <EthernetPort class="size-3.5" />
                <span>{{ t('ipInfos.ISP') }}</span>
              </dt>
              <dd class="font-medium wrap-break-word" :title="leak.org">
                <span v-if="!isFieldPending(leak.org)">{{ leak.org }}</span>
                <span v-else class="text-muted-foreground font-normal">—</span>
              </dd>
            </div>
            <div>
              <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <MapPin class="size-3.5" />
                <span>{{ t('dnsleaktest.EndpointCountry') }}</span>
              </dt>
              <dd class="font-medium flex items-center gap-1.5 flex-wrap">
                <template v-if="!isFieldPending(leak.country)">
                  <Icon v-if="leak.country_code" :icon="'circle-flags:' + leak.country_code.toLowerCase()"
                    class="shrink-0 size-4" />
                  <span class="wrap-break-word">{{ leak.country }}</span>
                </template>
                <span v-else class="text-muted-foreground font-normal">—</span>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>

    <!-- Enhanced DNS leak test banner — surfaces the deeper tool once the
         homepage test has resolved (success or timeout). fade-slide
         transition mirrors CensorshipCheck's conclusion banner. -->
    <Transition name="fade-slide">
      <div v-if="showEnhancedBanner"
        class="mt-3 flex flex-col md:flex-row items-start gap-3 rounded-lg border border-info/30 bg-info/5 p-4 md:p-5">

        <div class="flex-1 min-w-0 space-y-1.5">
          <h3 class="text-sm font-semibold m-0 flex items-center gap-2 mb-2">
            <Sparkles class="size-4 text-info shrink-0" />
            {{ t('dnsleaktest.EnhancedBanner.Title') }}
          </h3>
          <p class="text-sm text-muted-foreground leading-relaxed m-0">
            {{ t('dnsleaktest.EnhancedBanner.Note') }}
          </p>
        </div>
        <div class="w-full md:w-auto md:self-stretch flex justify-end items-end md:items-center">
          <Button variant="action" size="sm" @click="openEnhancedTest" class="shrink-0 cursor-pointer">
            <span>{{ t('dnsleaktest.EnhancedBanner.CTA') }}</span>
            <ArrowRight class="size-4 ml-1" />
          </Button>
        </div>
      </div>
    </Transition>
  </section>
</template>


<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useStatusTone, ipFieldTone, isFieldPending as isFieldPendingShared } from '@/composables/use-status-tone.js';
import { useMaxmind } from '@/composables/use-maxmind.js';
import { EthernetPort, Play, MapPin, RotateCw, Sparkles, ArrowRight, DoorOpen } from '@lucide/vue';
import { Icon } from '@iconify/vue';
import FitText from '@/components/widgets/FitText.vue';
import { INLINE_TIERS } from '@/composables/use-fit-text.js';
import {
  ipApi, surfshark, ipleak, browserleaks, runWithRetry,
} from '@/utils/dnsleaks';

// One source of truth for which providers to run and in what order. Adding
// a new provider = create the file under utils/dnsleaks and append it here.
const PROVIDERS = [ipApi, surfshark, ipleak, browserleaks];


const { t } = useI18n();
const store = useMainStore();
const router = useRouter();
const { lookupMaxmind } = useMaxmind();
const isStarted = ref(false);
const userPreferences = computed(() => store.userPreferences);
const isSimpleMode = computed(() => userPreferences.value.simpleMode);
// Sticky flag for the Enhanced DNS Leak Test banner.
const hasEverSettled = ref(false);

// Also gated on configs.originalSite to match the Advanced.vue card gate.
const showEnhancedBanner = computed(() =>
  hasEverSettled.value && store.configs?.originalSite === true
);

const openEnhancedTest = () => {
  trackEvent('Section', 'BannerClick', 'EnhancedDnsLeakTest');
  router.push('/enhanceddnsleaktest');
};

const { dotClass, textClass } = useStatusTone();

// Business status → 4 tone levels
const toneOf = (leak) => ipFieldTone(leak.ip, {
  waitLabels: t('dnsleaktest.StatusWait'),
  errorLabels: t('dnsleaktest.StatusError'),
});


// Status
const isFieldPending = (value) => isFieldPendingShared(value, {
  waitLabels: t('dnsleaktest.StatusWait'),
  errorLabels: t('dnsleaktest.StatusError'),
});

const createDefaultCard = () => ({
  name: t('dnsleaktest.Name'),
  country_code: '',
  country: t('dnsleaktest.StatusWait'),
  ip: t('dnsleaktest.StatusWait'),
  org: t('dnsleaktest.StatusWait'),
});

const leakTest = reactive(PROVIDERS.map((p) => ({
  ...createDefaultCard(),
  id: p.id,
  providerName: p.name,
})));

// Apply MaxMind lookup to a card that already has a resolved leak IP.
const applyMaxMindGeo = async (index, ip) => {
  const geo = await lookupMaxmind(ip);
  if (geo) {
    leakTest[index].country_code = geo.country_code;
    leakTest[index].country = geo.country;
    leakTest[index].org = geo.org;
    return;
  }
  leakTest[index].country = t('dnsleaktest.StatusError');
  leakTest[index].country_code = '';
  leakTest[index].org = t('dnsleaktest.StatusError');
};

const markLeakCardError = (index) => {
  leakTest[index].ip = t('dnsleaktest.StatusError');
  leakTest[index].country = t('dnsleaktest.StatusError');
  leakTest[index].country_code = '';
  leakTest[index].org = t('dnsleaktest.StatusError');
};

// Run one provider against its card slot, with retry (3 attempts, fresh
// prefix per attempt — see `runWithRetry` in utils/dnsleaks). On full
// failure (all attempts threw) the card is flipped to the error state.
const runProvider = async (index, provider) => {
  try {
    const { ip } = await runWithRetry(provider);
    leakTest[index].ip = ip;
    await applyMaxMindGeo(index, ip);
  } catch (error) {
    console.error('Error fetching leak test data:', error);
    markLeakCardError(index);
  }
};

// Check all. Staggers startup by 300ms per provider to avoid a thundering-
// herd on first paint.
const checkAllDNSLeakTest = async (isRefresh) => {
  isStarted.value = true;
  if (isRefresh) {
    trackEvent('Section', 'RefreshClick', 'DNSLeakTest');
    leakTest.forEach((server) => {
      server.ip = t('dnsleaktest.StatusWait');
      server.country = t('dnsleaktest.StatusWait');
      server.country_code = '';
      server.org = t('dnsleaktest.StatusWait');
    });
  }

  const delayedRun = (provider, index, delay) => new Promise((resolve) => {
    setTimeout(() => {
      runProvider(index, provider).then(resolve, resolve);
    }, delay);
  });

  const promises = PROVIDERS.map((provider, index) =>
    delayedRun(provider, index, 100 + index * 300),
  );

  const allSettledPromise = Promise.allSettled(promises);
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 6000));

  return Promise.race([allSettledPromise, timeoutPromise]).then(() => {
    store.setLoadingStatus('DNSLeakTest', true);
    // Local sticky flag for the Enhanced DNS Leak Test banner
    hasEverSettled.value = true;
  });
};

onMounted(() => {
  store.setMountingStatus('DNSLeakTest', true);
});

defineExpose({
  checkAllDNSLeakTest,
  leakTest,
});
</script>

<style scoped>
/* fade-slide — same shape as CensorshipCheck.vue's conclusion banner */
.fade-slide-enter-active {
  transition: all 0.3s ease-out;
}

.fade-slide-leave-active {
  transition: all 0.2s ease-out;
}

.fade-slide-enter-from {
  transform: translateY(10px);
  opacity: 0;
}

.fade-slide-leave-to {
  opacity: 0;
}
</style>
