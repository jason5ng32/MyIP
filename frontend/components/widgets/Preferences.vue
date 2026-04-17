<template>
    <!-- Preferences 面板：左侧 Sheet 滑入；分 5 个 section（Language / Theme / IP Sources / IP DB / App Settings） -->
    <Sheet :open="isOpen" @update:open="onOpenChange">
        <SheetContent side="left" :title="t('nav.preferences.title')"
            :class="cn('flex flex-col p-0 gap-0', isMobile ? 'w-full max-w-full' : 'w-[420px] max-w-[420px]')">
            <!-- Header -->
            <header class="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
                <h2 class="flex items-center gap-2 text-base font-semibold m-0">
                    <SlidersHorizontal class="size-4 text-muted-foreground" />
                    {{ t('nav.preferences.title') }}
                </h2>
                <SheetClose
                    class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
            </header>

            <!-- 内容（独立滚动） -->
            <div class="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                <!-- 顶部提示 -->
                <p class="text-xs text-muted-foreground leading-relaxed">
                    {{ t('nav.preferences.preferenceTips') }}
                </p>

                <!-- Language —————————————————————————————— -->
                <section id="Pref_language">
                    <SectionTitle :icon="Languages">{{ t('nav.preferences.language') }}</SectionTitle>
                    <Select :model-value="userPreferences.lang"
                        @update:model-value="(v) => v && prefLanguage(v)">
                        <SelectTrigger class="w-full shadow-none">
                            <SelectValue>
                                <span class="inline-flex items-center gap-2">
                                    <Icon v-if="currentLang.flag" :icon="'circle-flags:' + currentLang.flag" class="size-4 shrink-0" />
                                    <Globe v-else class="size-4 text-muted-foreground shrink-0" />
                                    {{ currentLang.label }}
                                </span>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="lang in langOptions" :key="lang.value" :value="lang.value">
                                <span class="inline-flex items-center gap-2">
                                    <Icon v-if="lang.flag" :icon="'circle-flags:' + lang.flag" class="size-4 shrink-0" />
                                    <Globe v-else class="size-4 text-muted-foreground shrink-0" />
                                    {{ lang.label }}
                                </span>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <SectionTip>{{ t('nav.preferences.languageTips') }}</SectionTip>
                </section>

                <!-- Color Scheme ———————————————————————————— -->
                <section id="Pref_colorScheme">
                    <SectionTitle :icon="Palette">{{ t('nav.preferences.colorScheme') }}</SectionTitle>
                    <ToggleGroup :model-value="userPreferences.theme" type="single" class="w-full"
                        @update:model-value="(v) => v && prefTheme(v)">
                        <ToggleGroupItem v-for="opt in themeOptions" :key="opt.value" :value="opt.value" class="flex-1 gap-1.5">
                            <component :is="opt.icon" class="size-4" />
                            {{ opt.label }}
                        </ToggleGroupItem>
                    </ToggleGroup>
                </section>

                <!-- IP Sources Count ————————————————————————— -->
                <section id="Pref_ipCards">
                    <SectionTitle :icon="LayoutGrid">{{ t('nav.preferences.ipSourcesToCheck') }}</SectionTitle>
                    <ToggleGroup :model-value="String(userPreferences.ipCardsToShow)" type="single" class="w-full"
                        @update:model-value="(v) => v && prefipCards(Number(v))">
                        <ToggleGroupItem v-for="num in [3, 6]" :key="num" :value="String(num)" class="flex-1">
                            {{ num }}
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <SectionTip>{{ t('nav.preferences.ipSourcesToCheckTips') }}</SectionTip>
                </section>

                <!-- IP Geo DB ——————————————————————————————— -->
                <section id="Pref_ipGeoSource">
                    <SectionTitle :icon="Database">{{ t('nav.preferences.ipDB') }}</SectionTitle>
                    <Select :model-value="String(userPreferences.ipGeoSource)"
                        @update:model-value="(v) => v != null && prefipGeoSource(Number(v))">
                        <SelectTrigger class="w-full shadow-none">
                            <SelectValue>{{ currentIpDB?.text || '—' }}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="ipdb in ipDBs" :key="ipdb.id" :value="String(ipdb.id)" :disabled="!ipdb.enabled">
                                {{ ipdb.text }}
                                <span v-if="!ipdb.enabled" class="ml-1 text-xs text-muted-foreground">(unavailable)</span>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <SectionTip>{{ t('nav.preferences.ipDBTips') }}</SectionTip>
                </section>

                <!-- App Settings ———————————————————————————— -->
                <section id="Pref_appSettings">
                    <SectionTitle :icon="AppWindow">{{ t('nav.preferences.appSettings') }}</SectionTitle>
                    <!-- 不用 <Card>：Card 默认带 jn-card 阴影，跟 Select / ToggleGroup 的扁平对比会凹凸不平
                         面板内统一走"border + bg-card"的扁平容器，所有控件同海拔 -->
                    <div class="rounded-lg border bg-card divide-y">
                        <PrefRow id="autoStart" :label="t('nav.preferences.autoRun')"
                            :tip="t('nav.preferences.autoRunTips')"
                            :model-value="userPreferences.autoStart" @update:model-value="prefAutoStart" />

                        <PrefRow v-if="userPreferences.autoStart" id="ConnectivityRefresh"
                            :label="t('nav.preferences.connectivityAutoRefresh')"
                            :tip="t('nav.preferences.connectivityAutoRefreshTips')"
                            :model-value="userPreferences.connectivityAutoRefresh"
                            @update:model-value="prefConnectivityRefresh" />

                        <PrefRow v-if="configs.map" id="showMap"
                            :label="t('nav.preferences.showMap')"
                            :tip="t('nav.preferences.showMapTips')"
                            :model-value="userPreferences.showMap" @update:model-value="prefShowMap" />

                        <PrefRow v-if="isMobile" id="simpleMode"
                            :label="t('nav.preferences.simpleMode')"
                            :tip="t('nav.preferences.simpleModeTips')"
                            :model-value="userPreferences.simpleMode" @update:model-value="prefSimpleMode" />

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
// refactor/02：Preferences 全部走 shadcn primitive + 语义色 token
// - 5+ 选项的语言/数据库切到 Select 下拉，遵守"5 档以上不平铺"的偏好
// - Theme（3 档）/ IP Sources（2 档）保留 ToggleGroup
// - App Settings 用 Card + 内部抽出 PrefRow，每行就一行声明（标签 / 描述 / Switch）
// - SectionTitle / SectionTip 为本组件抽两个 inline functional 子组件，避免在每个 section 重复样式
import { ref, computed, onMounted, h } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
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

// Sheet 开关：与 store.openSheet 双向绑定（refactor/01）
const isOpen = computed(() => store.openSheet === 'preferences');
const onOpenChange = (val) => {
    store.setOpenSheet(val ? 'preferences' : null);
};

// 语言选项（数据驱动；flag 走 circle-flags ISO code）
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

// 主题选项（3 档：light / dark / auto）
const themeOptions = [
    { value: 'light', label: t('nav.preferences.colorLight'), icon: Sun },
    { value: 'dark', label: t('nav.preferences.colorDark'), icon: Moon },
    { value: 'auto', label: t('nav.preferences.systemAuto'), icon: LaptopMinimal },
];

// 当前选中的 IP DB（用于 SelectValue 显示）
const currentIpDB = computed(() =>
    ipDBs.value.find(db => db.id === userPreferences.value.ipGeoSource)
);

// 主题切换需要协调 darkMode + body class + PWA meta
const prefersDarkMode = ref(window.matchMedia('(prefers-color-scheme: dark)').matches);
const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

const handleThemeChange = (event) => {
    prefersDarkMode.value = event.matches;
    const theme = userPreferences.value.theme;
    if (theme === 'auto') store.setDarkMode(prefersDarkMode.value);
    else if (theme === 'light') store.setDarkMode(false);
    else if (theme === 'dark') store.setDarkMode(true);
    updateBodyClass();
    PWAColor();
};

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
    switch (value) {
        case 'light': store.setDarkMode(false); break;
        case 'dark': store.setDarkMode(true); break;
        case 'auto': handleThemeChange({ matches: mediaQueryList.matches }); break;
    }
    updateBodyClass();
    PWAColor();
    store.updatePreference('theme', value);
    trackEvent('Nav', 'PreferenceClick', 'Theme');
};

const prefLanguage = (value) => {
    store.updatePreference('lang', value);
    trackEvent('Nav', 'PrefereceClick', 'LanguageChange');
};

const prefConnectivityRefresh = (value) => {
    store.updatePreference('connectivityAutoRefresh', value);
    if (isSignedIn.value && !store.userAchievements.ResourceHog.achieved) {
        store.setTriggerUpdateAchievements('ResourceHog');
    }
    trackEvent('Nav', 'PrefereceClick', 'ConnectivityRefresh');
};

const prefShowMap = (value) => {
    store.updatePreference('showMap', value);
    trackEvent('Nav', 'PrefereceClick', 'ShowMap');
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

const toggleMaps = () => {
    store.updatePreference('showMap', !userPreferences.value.showMap);
    trackEvent('Nav', 'ToggleClick', 'ShowMap');
};

onMounted(() => {
    mediaQueryList.addEventListener('change', handleThemeChange);
    handleThemeChange({ matches: mediaQueryList.matches });
    setTimeout(updateIPDBs, 4000);
});

defineExpose({
    toggleMaps,
});

// ——— 内联 functional 子组件：减少模板里重复的 section title / tip / Switch row 样式 ———

// section 标题：lucide icon + 文字，统一节奏
const SectionTitle = (props, { slots }) =>
    h('h3', { class: 'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2' }, [
        props.icon ? h(props.icon, { class: 'size-3.5' }) : null,
        slots.default?.(),
    ]);
SectionTitle.props = ['icon'];

// section 提示文字：放在控件下方
const SectionTip = (props, { slots }) =>
    h('p', { class: 'mt-2 text-xs text-muted-foreground leading-relaxed' }, slots.default?.());

// App Settings 里的开关行：label + tip 在左，Switch 在右
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
