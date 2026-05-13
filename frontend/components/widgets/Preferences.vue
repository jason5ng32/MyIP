<template>
    <!-- Preferences panel -->
    <Sheet :open="isOpen" @update:open="onOpenChange">
        <SheetContent side="left" :title="t('nav.preferences.title')"
            :class="['flex flex-col p-0 gap-0', isMobile ? 'w-full max-w-full' : 'w-[420px] max-w-[420px]']">
            <!-- Header -->
            <header class="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
                <h2 class="flex items-center gap-2 text-base font-semibold m-0">
                    <SlidersHorizontal class="size-4 text-muted-foreground" />
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
                            class="flex-1 gap-1.5" :aria-label="opt.label" :title="opt.label">
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
                        <ToggleGroupItem v-for="num in [2, 4, 6]" :key="num" :value="String(num)" class="flex-1 gap-1.5"
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

                <!-- App Settings -->
                <section id="Pref_appSettings">
                    <SectionTitle :icon="AppWindow">{{ t('nav.preferences.appSettings') }}</SectionTitle>
                    <div class="rounded-lg border bg-card divide-y">
                        <PrefRow id="autoStart" :label="t('nav.preferences.autoRun')"
                            :tip="t('nav.preferences.autoRunTips')" :model-value="userPreferences.autoStart"
                            @update:model-value="prefAutoStart" />

                        <PrefRow v-if="userPreferences.autoStart" id="ConnectivityMultipleTests"
                            :label="t('nav.preferences.connectivityMultipleTests')"
                            :tip="t('nav.preferences.connectivityMultipleTestsTips')"
                            :model-value="userPreferences.connectivityMultipleTests"
                            @update:model-value="prefConnectivityMultipleTests" />

                        <PrefRow v-if="isMobile" id="simpleMode" :label="t('nav.preferences.simpleMode')"
                            :tip="t('nav.preferences.simpleModeTips')" :model-value="userPreferences.simpleMode"
                            @update:model-value="prefSimpleMode" />

                        <PrefRow id="ConnectivityNotifications"
                            :label="t('nav.preferences.popupConnectivityNotifications')"
                            :tip="t('nav.preferences.popupConnectivityNotificationsTips')"
                            :model-value="userPreferences.popupConnectivityNotifications"
                            @update:model-value="prefconnectivityShowNoti" />
                    </div>
                </section>
            </div>
        </SheetContent>
    </Sheet>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, h } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Icon } from '@iconify/vue';
import {
    AppWindow,
    Database,
    Globe,
    Languages,
    LaptopMinimal,
    LayoutGrid,
    Moon,
    Palette,
    SlidersHorizontal,
    Sun,
} from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const configs = computed(() => store.configs);
const userPreferences = computed(() => store.userPreferences);
const ipDBs = computed(() => store.ipDBs);
const isSignedIn = computed(() => store.isSignedIn);

const isOpen = computed(() => store.openSheet === 'preferences');
const onOpenChange = (val) => {
    store.setOpenSheet(val ? 'preferences' : null);
};

// Language options (data driven; flag use circle-flags ISO code)
const langOptions = [
    { value: 'auto', label: t('nav.preferences.systemAuto'), flag: '' },
    { value: 'zh', label: '中文', flag: 'cn' },
    { value: 'en', label: 'English', flag: 'us' },
    { value: 'fr', label: 'Français', flag: 'fr' },
    { value: 'tr', label: 'Türkçe', flag: 'tr' },
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

// Theme coordination — applies the user's preference ("light" / "dark" / "auto")
// to the store, <html> `.dark` class, body class, and PWA meta colors.
//
// Single source of truth: applyTheme() reads the *current* userPreferences.theme
// and the *current* OS color-scheme together, decides the effective dark state,
// and pushes it everywhere. Called on mount, on OS flip, and on user preference
// change — so all three triggers path through the same logic.
//
// The earlier version read userPreferences.theme at callback-definition time
// and also called handleThemeChange inside prefTheme *before* persisting the
// new theme value, so "auto" could miss the OS flip and "click auto" could
// get stuck on the previous manual state.
const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

const applyTheme = () => {
    const theme = userPreferences.value.theme;
    const isDark =
        theme === 'dark' ||
        (theme === 'auto' && mediaQueryList.matches);
    store.setDarkMode(isDark);
    updateBodyClass();
    PWAColor();
};

const handleMediaChange = () => applyTheme();

const updateBodyClass = () => {
    document.body.classList.toggle('body-dark-mode', isDarkMode.value);
};

const PWAColor = () => {
    const themeColor = document.querySelector('meta[name="theme-color"]');
    const backgroundColor = document.querySelector('meta[name="background-color"]');
    const color = isDarkMode.value ? '#171a1d' : '#f8f9fa';
    const bgColor = isDarkMode.value ? '#212529' : '#ffffff';
    themeColor.setAttribute('content', color);
    backgroundColor.setAttribute('content', bgColor);
};

const updateIPDBs = () => {
    if (configs.value && Object.keys(configs.value).length > 0) {
        store.updateIPDBs({ id: 0, enabled: configs.value.ipChecking });
        store.updateIPDBs({ id: 1, enabled: configs.value.ipInfo });
        store.updateIPDBs({ id: 3, enabled: configs.value.ipapiis });
        store.updateIPDBs({ id: 4, enabled: configs.value.ip2location });
    }
};

const prefTheme = (value) => {
    // Persist first so applyTheme() reads the new value, then apply.
    store.updatePreference('theme', value);
    applyTheme();
    trackEvent('Nav', 'PreferenceClick', 'Theme');
};

const prefLanguage = (value) => {
    store.updatePreference('lang', value);
    trackEvent('Nav', 'PrefereceClick', 'LanguageChange');
};

const prefConnectivityMultipleTests = (value) => {
    store.updatePreference('connectivityMultipleTests', value);
    if (isSignedIn.value && !store.userAchievements.ResourceHog.achieved) {
        store.setTriggerUpdateAchievements('ResourceHog');
    }
    trackEvent('Nav', 'PrefereceClick', 'ConnectivityMultipleTests');
};

const prefSimpleMode = (value) => {
    store.updatePreference('simpleMode', value);
    trackEvent('Nav', 'PrefereceClick', 'SimpleMode');
};

const prefAutoStart = (value) => {
    store.updatePreference('autoStart', value);
    trackEvent('Nav', 'PrefereceClick', 'AutoStart');
    if (isSignedIn.value && !value && !store.userAchievements.EnergySaver.achieved) {
        store.setTriggerUpdateAchievements('EnergySaver');
    }
};

const prefconnectivityShowNoti = (value) => {
    store.updatePreference('popupConnectivityNotifications', value);
    trackEvent('Nav', 'PrefereceClick', 'ConnectivityNotifications');
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

onMounted(() => {
    mediaQueryList.addEventListener('change', handleMediaChange);
    applyTheme();
    setTimeout(updateIPDBs, 4000);
});

// Clean up the OS listener if this component is ever torn down (it normally
// lives for the life of the app, but be hygienic).
onUnmounted(() => {
    mediaQueryList.removeEventListener('change', handleMediaChange);
});

// Also react when the user switches theme via any path — the watcher keeps
// applyTheme() firing even if a future code path mutates store.theme directly.
watch(() => userPreferences.value.theme, applyTheme);


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

// App Settings switch row: label + tip on left, Switch on right
const PrefRow = (props, { emit }) =>
    h('div', { class: 'flex items-start justify-between gap-3 p-3' }, [
        h('div', { class: 'flex-1 min-w-0' }, [
            h('label', {
                for: props.id,
                class: 'text-sm font-medium cursor-pointer select-none',
            }, props.label),
            h('p', { class: 'mt-0.5 text-xs text-muted-foreground leading-relaxed' }, props.tip),
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
