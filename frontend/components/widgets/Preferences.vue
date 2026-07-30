<template>
    <!-- Preferences panel -->
    <Sheet :open="isOpen" @update:open="onOpenChange">
        <SheetContent side="left" :title="t('nav.preferences.title')"
            class="flex flex-col p-0 gap-0 w-full max-w-full md:w-[420px] md:max-w-[420px]">
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
                                    <Icon v-if="currentLang.flag" :icon="'circle-flags:' + currentLang.flag"
                                        class="size-4 shrink-0" />
                                    <Globe v-else class="size-4 text-muted-foreground shrink-0" />
                                    {{ currentLang.label }}
                                </span>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="lang in langOptions" :key="lang.value" :value="lang.value">
                                <span class="inline-flex items-center gap-2">
                                    <Icon v-if="lang.flag" :icon="'circle-flags:' + lang.flag"
                                        class="size-4 shrink-0" />
                                    <Globe v-else class="size-4 text-muted-foreground shrink-0" />
                                    {{ lang.label }}
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
                        <ToggleGroupItem v-for="num in [2, 4, 6]" :key="num" :value="String(num)" class="flex-1 gap-1.5 cursor-pointer"
                            :aria-label="num.toString()" :title="num.toString()">
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
                            <SelectItem v-for="ipdb in ipDBs" :key="ipdb.id" :value="String(ipdb.id)"
                                :disabled="!ipdb.enabled" :class="{ 'line-through cursor-not-allowed': !ipdb.enabled }">
                                {{ ipdb.text }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <SectionTip>{{ t('nav.preferences.ipDBTips') }}</SectionTip>
                </section>

                <!-- Auto Run on Startup — per-module switches only. IP info always
                     runs (no switch). The Connectivity test options live in App
                     Settings below: they apply to manual runs too, not just startup. -->
                <section id="Pref_autoRun">
                    <SectionTitle :icon="Play">{{ t('nav.preferences.autoRun') }}</SectionTitle>
                    <div class="rounded-lg border bg-card divide-y">
                        <PrefRow id="autoRunConnectivity" :label="t('nav.Connectivity')"
                            :model-value="userPreferences.autoRunConnectivity"
                            @update:model-value="(v) => prefAutoRun('autoRunConnectivity', v)" />

                        <PrefRow id="autoRunWebRTC" :label="t('nav.WebRTC')"
                            :model-value="userPreferences.autoRunWebRTC"
                            @update:model-value="(v) => prefAutoRun('autoRunWebRTC', v)" />

                        <PrefRow id="autoRunDnsLeak" :label="t('nav.DNSLeakTest')"
                            :model-value="userPreferences.autoRunDnsLeak"
                            @update:model-value="(v) => prefAutoRun('autoRunDnsLeak', v)" />
                    </div>
                    <SectionTip>{{ t('nav.preferences.autoRunTips') }}</SectionTip>
                </section>

                <!-- App Settings -->
                <section id="Pref_appSettings">
                    <SectionTitle :icon="AppWindow">{{ t('nav.preferences.appSettings') }}</SectionTitle>
                    <div class="rounded-lg border bg-card divide-y">
                        <PrefRow id="ConnectivityMultipleTests"
                            :label="t('nav.preferences.connectivityMultipleTests')"
                            :tip="t('nav.preferences.connectivityMultipleTestsTips')"
                            :model-value="userPreferences.connectivityMultipleTests"
                            @update:model-value="prefConnectivityMultipleTests" />

                        <PrefRow id="ConnectivityNotifications"
                            :label="t('nav.preferences.popupConnectivityNotifications')"
                            :tip="t('nav.preferences.popupConnectivityNotificationsTips')"
                            :model-value="userPreferences.popupConnectivityNotifications"
                            @update:model-value="prefconnectivityShowNoti" />

                        <PrefRow id="simpleMode" :label="t('nav.preferences.simpleMode')"
                            :tip="t('nav.preferences.simpleModeTips')" :model-value="userPreferences.simpleMode"
                            @update:model-value="prefSimpleMode" />
                    </div>
                </section>

                <!-- IP History -->
                <section id="Pref_ipHistory">
                    <SectionTitle :icon="History">{{ t('nav.preferences.ipHistory') }}</SectionTitle>
                    <div class="rounded-lg border bg-card divide-y">
                        <PrefRow id="ipHistoryEnabled" :label="t('nav.preferences.ipHistoryEnabled')"
                            :model-value="userPreferences.ipHistoryEnabled"
                            @update:model-value="prefIpHistoryEnabled" />

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
                            <Slider id="ipHistoryDays" :model-value="[ipHistoryDaysDraft]" :min="1" :max="90"
                                :step="1" :disabled="!userPreferences.ipHistoryEnabled"
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
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Icon } from '@iconify/vue';
import {
    AppWindow,
    Database,
    Globe,
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

// Language options (data driven; flag use circle-flags ISO code)
const langOptions = [
    { value: 'auto', label: t('nav.preferences.systemAuto'), flag: '' },
    { value: 'zh', label: '中文', flag: 'cn' },
    { value: 'en', label: 'English', flag: 'us' },
    { value: 'ru', label: 'Русский', flag: 'ru' },
    { value: 'fr', label: 'Français', flag: 'fr' },
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

// App Settings switch row: label (+ optional tip) on left, Switch on right.
const PrefRow = (props, { emit }) =>
    h('div', { class: 'flex items-start justify-between gap-3 p-3' }, [
        h('div', { class: 'flex-1 min-w-0' }, [
            h('label', {
                for: props.id,
                class: 'text-sm font-medium cursor-pointer select-none',
            }, props.label),
            props.tip
                ? h('p', { class: 'mt-0.5 text-xs text-muted-foreground leading-relaxed' }, props.tip)
                : null,
        ]),
        h(Switch, {
            id: props.id,
            modelValue: props.modelValue,
            'onUpdate:modelValue': (v) => emit('update:modelValue', v),
        }),
    ]);
PrefRow.props = ['id', 'label', 'tip', 'modelValue'];
PrefRow.emits = ['update:modelValue'];
</script>
