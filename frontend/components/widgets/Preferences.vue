<template>
  <!-- Preferences panel -->
  <Sheet :open="isOpen" @update:open="onOpenChange">
    <SheetContent side="left" :title="t('nav.preferences.title')"
      class="flex flex-col p-0 gap-0 w-full max-w-full md:w-125 md:max-w-125">
      <!-- Header -->
      <header class="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
        <h2 class="flex items-center gap-2 text-base font-semibold m-0">
          <Cog class="size-4 text-muted-foreground" />
          {{ t('nav.preferences.title') }}
        </h2>
        <SheetClose
          class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
      </header>

      <!-- Content (scrollable) -->
      <div class="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        <!-- Top note -->
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ t('nav.preferences.preferenceTips') }}
        </p>

        <!-- Language -->
        <section id="Pref_language">
          <SectionTitle :icon="Languages">{{ t('nav.preferences.language') }}</SectionTitle>
          <Select :model-value="userPreferences.lang" @update:model-value="(v) => v && prefLanguage(v)">
            <SelectTrigger class="w-full shadow-none">
              <SelectValue>
                <span class="inline-flex items-center gap-2">
                  {{ currentLang.label }}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="lang in langOptions" :key="lang.value" :value="lang.value">
                <span class="inline-flex items-center gap-2">
                  {{ lang.label }}
                  <!-- Partial translation: literal "Beta", deliberately untranslated. -->
                  <Badge v-if="lang.beta" variant="outline" class="px-1.5 text-[10px] font-medium">Beta</Badge>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <SectionTip>{{ t('nav.preferences.languageTips') }}</SectionTip>
        </section>

        <!-- Color Scheme -->
        <section id="Pref_colorScheme">
          <SectionTitle :icon="Palette">{{ t('nav.preferences.colorScheme') }}</SectionTitle>
          <ToggleGroup :model-value="userPreferences.theme" type="single" class="w-full" variant="outline"
            @update:model-value="(v) => v && prefTheme(v)">
            <ToggleGroupItem v-for="opt in themeOptions" :key="opt.value" :value="opt.value"
              class="flex-1 gap-1.5 cursor-pointer" :aria-label="opt.label" :title="opt.label">
              <component :is="opt.icon" class="size-4" />
              {{ opt.label }}
            </ToggleGroupItem>
          </ToggleGroup>
        </section>

        <!-- IP Sources Count -->
        <section id="Pref_ipCards">
          <SectionTitle :icon="LayoutGrid">{{ t('nav.preferences.ipSourcesToCheck') }}</SectionTitle>
          <ToggleGroup :model-value="String(userPreferences.ipCardsToShow)" type="single" class="w-full"
            variant="outline" @update:model-value="(v) => v && prefipCards(Number(v))">
            <ToggleGroupItem v-for="num in [2, 4, 6]" :key="num" :value="String(num)"
              class="flex-1 gap-1.5 cursor-pointer" :aria-label="num.toString()" :title="num.toString()">
              {{ num }}
            </ToggleGroupItem>
          </ToggleGroup>
          <SectionTip>{{ t('nav.preferences.ipSourcesToCheckTips') }}</SectionTip>
        </section>

        <!-- IP Geo DB -->
        <section id="Pref_ipGeoSource">
          <SectionTitle :icon="Database">{{ t('nav.preferences.ipDB') }}</SectionTitle>
          <Select :model-value="String(userPreferences.ipGeoSource)"
            @update:model-value="(v) => v != null && prefipGeoSource(Number(v))">
            <SelectTrigger class="w-full shadow-none">
              <SelectValue>{{ currentIpDB?.text || '—' }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="ipdb in ipDBs" :key="ipdb.id" :value="String(ipdb.id)" :disabled="!ipdb.enabled"
                :class="{ 'line-through cursor-not-allowed': !ipdb.enabled }">
                {{ ipdb.text }}
              </SelectItem>
            </SelectContent>
          </Select>
          <SectionTip>{{ t('nav.preferences.ipDBTips') }}</SectionTip>
        </section>

        <!-- Auto Run on Startup — per-module switches only. IP info always
                     runs (no switch). The Connectivity test options live in their own
                     section below: they apply to manual runs too, not just startup. -->
        <section id="Pref_autoRun">
          <SectionTitle :icon="Play">{{ t('nav.preferences.autoRun') }}</SectionTitle>
          <div class="rounded-lg border bg-card divide-y">
            <PrefRow id="autoRunConnectivity" :label="t('nav.Connectivity')"
              :model-value="userPreferences.autoRunConnectivity"
              @update:model-value="(v) => prefAutoRun('autoRunConnectivity', v)" />

            <PrefRow id="autoRunWebRTC" :label="t('nav.WebRTC')" :model-value="userPreferences.autoRunWebRTC"
              @update:model-value="(v) => prefAutoRun('autoRunWebRTC', v)" />

            <PrefRow id="autoRunDnsLeak" :label="t('nav.DNSLeakTest')" :model-value="userPreferences.autoRunDnsLeak"
              @update:model-value="(v) => prefAutoRun('autoRunDnsLeak', v)" />
          </div>
          <SectionTip>{{ t('nav.preferences.autoRunTips') }}</SectionTip>
        </section>

        <!-- Connectivity Test: default list + its three switches. Labels
                     stay terse; the section title carries the context. -->
        <section id="Pref_connectivity">
          <SectionTitle :icon="Activity">{{ t('nav.Connectivity') }}</SectionTitle>
          <div class="rounded-lg border bg-card divide-y">
            <!-- Default list: PrefRow's two-line rhythm with a Select. -->
            <div class="p-3 pb-2">
              <div class="flex items-center justify-between gap-3">
                <span class="min-w-0 flex-1 text-sm font-medium select-none">
                  {{ t('nav.preferences.connectivity.defaultList') }}</span>
                <Select :model-value="currentDefaultListId"
                  @update:model-value="(v) => v && prefConnectivityDefaultList(v)">
                  <SelectTrigger class="w-40 shrink-0 shadow-none">
                    <SelectValue><span class="truncate">{{ currentDefaultListName }}</span></SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="list in connectivityLists" :key="list.id" :value="list.id">
                      <span class="block max-w-64 truncate">{{ connectivityListName(list) }}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p class="mt-1 text-xs text-muted-foreground leading-relaxed">
                {{ t('nav.preferences.connectivity.defaultListTips') }}</p>
            </div>

            <PrefRow id="ConnectivityMultipleTests" :label="t('nav.preferences.connectivity.multipleTests')"
              :tip="t('nav.preferences.connectivity.multipleTestsTips')"
              :model-value="userPreferences.connectivityMultipleTests"
              @update:model-value="prefConnectivityMultipleTests" />

            <PrefRow id="ConnectivityNotifications" :label="t('nav.preferences.connectivity.notifications')"
              :tip="t('nav.preferences.connectivity.notificationsTips')"
              :model-value="userPreferences.popupConnectivityNotifications"
              @update:model-value="prefconnectivityShowNoti" />

            <PrefRow id="ConnectivityCardTitleOpensSite" :label="t('nav.preferences.connectivity.titleOpensSite')"
              :tip="t('nav.preferences.connectivity.titleOpensSiteTips')"
              :model-value="userPreferences.connectivityCardTitleOpensSite"
              @update:model-value="prefConnectivityCardTitleOpensSite" />
          </div>
        </section>

        <!-- App Settings -->
        <section id="Pref_appSettings">
          <SectionTitle :icon="AppWindow">{{ t('nav.preferences.appSettings') }}</SectionTitle>
          <div class="rounded-lg border bg-card divide-y">
            <PrefRow id="simpleMode" :label="t('nav.preferences.simpleMode')" :tip="t('nav.preferences.simpleModeTips')"
              :model-value="userPreferences.simpleMode" @update:model-value="prefSimpleMode" />
          </div>
        </section>

        <!-- IP History -->
        <section id="Pref_ipHistory">
          <SectionTitle :icon="History">{{ t('nav.preferences.ipHistory') }}</SectionTitle>
          <div class="rounded-lg border bg-card divide-y">
            <PrefRow id="ipHistoryEnabled" :label="t('nav.preferences.ipHistoryEnabled')"
              :model-value="userPreferences.ipHistoryEnabled" @update:model-value="prefIpHistoryEnabled" />

            <!-- Retention slider: live number while dragging, preference
                             committed on release so pruning never fires mid-drag. -->
            <div class="p-3" :class="{ 'opacity-50': !userPreferences.ipHistoryEnabled }">
              <div class="flex items-center justify-between gap-3 mb-3">
                <label for="ipHistoryDays" class="text-sm font-medium select-none">
                  {{ t('nav.preferences.ipHistoryDays') }}
                </label>
                <span class="text-sm font-mono tabular-nums text-muted-foreground">
                  {{ ipHistoryDaysDraft }}
                </span>
              </div>
              <Slider id="ipHistoryDays" :model-value="[ipHistoryDaysDraft]" :min="1" :max="90" :step="1"
                :disabled="!userPreferences.ipHistoryEnabled"
                @update:model-value="(v) => { if (v?.[0] != null) ipHistoryDaysDraft = v[0]; }"
                @value-commit="(v) => prefIpHistoryDays(v?.[0])" />
            </div>
          </div>
          <SectionTip>{{ t('nav.preferences.ipHistoryTips') }}</SectionTip>
        </section>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup>
import { computed, ref, watch, h } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent } from '@/utils/app-events.js';
import { clampRetentionDays } from '@/utils/ip-history.js';
import { LOCALES } from '@/utils/locale-registry.js';
import { MINE_LIST_ID } from '@/data/connectivity-import-lists.js';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  AppWindow,
  Database,
  History,
  Languages,
  LaptopMinimal,
  LayoutGrid,
  Moon,
  Palette,
  Play,
  Cog,
  Sun,
} from '@lucide/vue';

const { t } = useI18n();

const store = useMainStore();
const userPreferences = computed(() => store.userPreferences);
const ipDBs = computed(() => store.ipDBs);

const isOpen = computed(() => store.openSheet === 'preferences');
const onOpenChange = (val) => {
  store.setOpenSheet(val ? 'preferences' : null);
};

// Text-only options — the picker deliberately shows no flags: a language
// isn't a country (e.g. English under a US flag reads wrong to Brits).
const langOptions = [
  { value: 'auto', label: t('nav.preferences.systemAuto') },
  ...LOCALES.map(({ code, nativeName, status }) => ({
    value: code, label: nativeName, beta: status === 'beta',
  })),
];
const currentLang = computed(() =>
  langOptions.find(l => l.value === userPreferences.value.lang) || langOptions[0]
);

// Theme options (3 options: light / dark / auto)
const themeOptions = [
  { value: 'light', label: t('nav.preferences.colorLight'), icon: Sun },
  { value: 'dark', label: t('nav.preferences.colorDark'), icon: Moon },
  { value: 'auto', label: t('nav.preferences.systemAuto'), icon: LaptopMinimal },
];

// Current selected IP DB (for SelectValue display)
const currentIpDB = computed(() =>
  ipDBs.value.find(db => db.id === userPreferences.value.ipGeoSource)
);

const prefTheme = (value) => {
  // Application is handled by use-theme.js, which watches this preference.
  store.updatePreference('theme', value);
  trackEvent('Nav', 'PreferenceClick', 'Theme');
};

const prefLanguage = (value) => {
  store.updatePreference('lang', value);
  trackEvent('Nav', 'PrefereceClick', 'LanguageChange');
};

// Which Connectivity list the section opens on; a stale preference falls
// back to Mine (whose display name is localized, never stored).
const connectivityLists = computed(() => userPreferences.value.connectivityLists?.lists || []);
const connectivityListName = (list) => (list.id === MINE_LIST_ID ? t('connectivity.lists.Mine') : list.name);
const currentDefaultListId = computed(() => {
  const preferred = userPreferences.value.connectivityDefaultListId;
  return connectivityLists.value.some((l) => l.id === preferred) ? preferred : MINE_LIST_ID;
});
const currentDefaultListName = computed(() => {
  const list = connectivityLists.value.find((l) => l.id === currentDefaultListId.value);
  return list ? connectivityListName(list) : '—';
});
const prefConnectivityDefaultList = (value) => {
  store.updatePreference('connectivityDefaultListId', value);
  trackEvent('Nav', 'PrefereceClick', 'ConnectivityDefaultList');
};

const prefConnectivityMultipleTests = (value) => {
  store.updatePreference('connectivityMultipleTests', value);
  // Achievement rule (ResourceHog) lives in data/achievement-rules.js.
  emitAppEvent('preferences:multiple-tests-toggled');
  trackEvent('Nav', 'PrefereceClick', 'ConnectivityMultipleTests');
};

const prefSimpleMode = (value) => {
  store.updatePreference('simpleMode', value);
  trackEvent('Nav', 'PrefereceClick', 'SimpleMode');
};

// Per-module startup auto-run toggle. The EnergySaver achievement rule
// (earned once every auto-run module is off) lives in data/achievement-rules.js.
const prefAutoRun = (key, value) => {
  store.updatePreference(key, value);
  trackEvent('Nav', 'PrefereceClick', key);
  const prefs = userPreferences.value;
  emitAppEvent('preferences:autorun-changed', {
    allAutoRunOff: !prefs.autoRunConnectivity && !prefs.autoRunWebRTC && !prefs.autoRunDnsLeak,
  });
};

const prefconnectivityShowNoti = (value) => {
  store.updatePreference('popupConnectivityNotifications', value);
  trackEvent('Nav', 'PrefereceClick', 'ConnectivityNotifications');
};

const prefConnectivityCardTitleOpensSite = (value) => {
  store.updatePreference('connectivityCardTitleOpensSite', value);
  trackEvent('Nav', 'PrefereceClick', 'ConnectivityCardTitleOpensSite');
};

// IP history recorder: on/off + retention days (1–90). The draft ref feeds the
// slider's live readout; the preference is written on value-commit only.
const ipHistoryDaysDraft = ref(clampRetentionDays(userPreferences.value.ipHistoryDays));
watch(() => userPreferences.value.ipHistoryDays, (v) => {
  ipHistoryDaysDraft.value = clampRetentionDays(v);
});

const prefIpHistoryEnabled = (value) => {
  store.updatePreference('ipHistoryEnabled', value);
  trackEvent('Nav', 'PrefereceClick', 'IpHistoryEnabled');
};

const prefIpHistoryDays = (value) => {
  if (value == null) return;
  const days = clampRetentionDays(value);
  ipHistoryDaysDraft.value = days;
  store.updatePreference('ipHistoryDays', days);
  trackEvent('Nav', 'PrefereceClick', 'IpHistoryDays');
};

const prefipCards = (value) => {
  store.updatePreference('ipCardsToShow', value);
  trackEvent('Nav', 'PrefereceClick', 'ipCards');
};

const prefipGeoSource = (value) => {
  store.updatePreference('ipGeoSource', value);
  trackEvent('Nav', 'PrefereceClick', 'ipGeoSource');
  trackEvent('IPCheck', 'SelectSource', ipDBs.value.find(x => x.id === value).text);
};

// Section title: lucide icon + text, unified rhythm
const SectionTitle = (props, { slots }) =>
  h('h3', { class: 'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2' }, [
    props.icon ? h(props.icon, { class: 'size-3.5' }) : null,
    slots.default?.(),
  ]);
SectionTitle.props = ['icon'];

// Section tip text
const SectionTip = (props, { slots }) =>
  h('p', { class: 'mt-2 text-xs text-muted-foreground leading-relaxed' }, slots.default?.());

// Preference switch row. Two stacked lines: label + Switch vertically
// centered on the first, the optional tip full-width on the second (so it
// runs under the control instead of wrapping beside it). Tip rows trim the
// bottom padding — the tip's own line-height already provides visual air.
const PrefRow = (props, { emit }) =>
  h('div', { class: props.tip ? 'p-3 pb-2' : 'p-3' }, [
    h('div', { class: 'flex items-center justify-between gap-3' }, [
      h('label', {
        for: props.id,
        class: 'min-w-0 flex-1 text-sm font-medium cursor-pointer select-none',
      }, props.label),
      h(Switch, {
        id: props.id,
        class: 'shrink-0',
        modelValue: props.modelValue,
        'onUpdate:modelValue': (v) => emit('update:modelValue', v),
      }),
    ]),
    props.tip
      ? h('p', { class: 'mt-1 text-xs text-muted-foreground leading-relaxed' }, props.tip)
      : null,
  ]);
PrefRow.props = ['id', 'label', 'tip', 'modelValue'];
PrefRow.emits = ['update:modelValue'];
</script>
