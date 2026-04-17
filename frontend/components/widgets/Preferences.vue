<template>
    <Sheet :open="isOpen" @update:open="onOpenChange">
        <SheetContent
            side="left"
            :title="t('nav.preferences.title')"
            :class="cn('overflow-y-auto pt-3', isMobile ? 'w-full max-w-full' : 'w-[400px] max-w-[400px]')">
            <div class="mt-3 flex items-center justify-between px-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                <h5 class="m-0 text-lg font-semibold">
                    <SlidersHorizontal class="inline size-[1em] align-[-0.125em]" />&nbsp;&nbsp;{{ t('nav.preferences.title') }}
                </h5>
                <SheetClose />
            </div>
            <div class="pt-0 m-2">
                <div class="preferences-tip">{{ t('nav.preferences.preferenceTips') }}</div>

                <!-- 语言设置 -->
                <div id="Pref_language">
                    <div class="preferences-title"><Languages class="inline size-[1em] align-[-0.125em]" /> {{ t('nav.preferences.language') }}</div>
                    <ToggleGroup :model-value="userPreferences.lang" type="single" class="flex-col w-1/2 gap-0 mb-2"
                        @update:model-value="(v) => v && prefLanguage(v)">
                        <ToggleGroupItem v-for="lang in ['auto', 'zh', 'en', 'fr', 'tr']" :key="lang" :value="lang"
                            class="justify-start w-full">
                            <span v-if="lang === 'zh'"><i class="fi fi-cn"></i> 中文</span>
                            <span v-else-if="lang === 'en'"><i class="fi fi-us"></i> English</span>
                            <span v-else-if="lang === 'fr'"><i class="fi fi-fr"></i> Français</span>
                            <span v-else-if="lang === 'tr'"><i class="fi fi-tr"></i> Türkçe</span>
                            <span v-else>{{ t('nav.preferences.systemAuto') }}</span>
                            <CircleCheck class="inline size-[1em] align-[-0.125em] ml-2" v-if="userPreferences.lang === lang" />
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <div class="preferences-tip">{{ t('nav.preferences.languageTips') }}</div>
                </div>

                <!-- 主题方案 -->
                <div id="Pref_colorScheme">
                    <div class="preferences-title"><Palette class="inline size-[1em] align-[-0.125em]" /> {{ t('nav.preferences.colorScheme') }}</div>
                    <ToggleGroup :model-value="userPreferences.theme" type="single"
                        @update:model-value="(v) => v && prefTheme(v)">
                        <ToggleGroupItem v-for="theme in ['auto', 'light', 'dark']" :key="theme" :value="theme">
                            <span v-if="theme === 'light'"><Sun class="inline size-[1em] align-[-0.125em]" /> {{ t('nav.preferences.colorLight') }}</span>
                            <span v-else-if="theme === 'dark'"><Moon class="inline size-[1em] align-[-0.125em]" /> {{ t('nav.preferences.colorDark') }}</span>
                            <span v-else>{{ t('nav.preferences.systemAuto') }}</span>
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>

                <!-- IP 源 -->
                <div id="Pref_ipCards">
                    <div class="preferences-title">
                        <LayoutGrid class="inline size-[1em] align-[-0.125em]" /> {{ t('nav.preferences.ipSourcesToCheck') }}
                    </div>
                    <ToggleGroup :model-value="String(userPreferences.ipCardsToShow)" type="single" class="w-1/2 mb-2"
                        @update:model-value="(v) => v && prefipCards(Number(v))">
                        <ToggleGroupItem v-for="num in [3, 6]" :key="num" :value="String(num)">
                            {{ num }}
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <div class="preferences-tip">{{ t('nav.preferences.ipSourcesToCheckTips') }}</div>
                </div>

                <!-- IP 地理位置数据库 -->
                <div id="Pref_ipGeoSource">
                    <div class="preferences-title">
                        <LayoutGrid class="inline size-[1em] align-[-0.125em]" /> {{ t('nav.preferences.ipDB') }}
                    </div>
                    <ToggleGroup :model-value="String(userPreferences.ipGeoSource)" type="single" class="flex-col w-1/2 gap-0 mb-2"
                        @update:model-value="(v) => v !== null && v !== undefined && prefipGeoSource(Number(v))">
                        <ToggleGroupItem v-for="ipdb in ipDBs" :key="ipdb.id" :value="String(ipdb.id)"
                            :disabled="!ipdb.enabled"
                            class="justify-start w-full">
                            <span :class="[ipdb.enabled ? '' : 'jn-disabled-text']">{{ ipdb.text }}</span>
                            <CircleCheck class="inline size-[1em] align-[-0.125em] ml-2" v-if="userPreferences.ipGeoSource === ipdb.id" />
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <div class="preferences-tip">{{ t('nav.preferences.ipDBTips') }}</div>
                </div>

                <!-- 应用设置 -->
                <div id="Pref_appSettings">
                    <div class="preferences-title"><AppWindow class="inline size-[1em] align-[-0.125em]" /> {{ t('nav.preferences.appSettings') }}</div>
                    <ul class="flex flex-col border border-neutral-200 dark:border-neutral-700 rounded-md overflow-hidden">
                        <li class="flex items-start justify-between p-3 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
                            <div class="flex-1 mr-2">
                                <div class="font-bold">
                                    <label for="autoStart">{{ t('nav.preferences.autoRun') }}</label>
                                </div>
                                <div class="preferences-tip">{{ t('nav.preferences.autoRunTips') }}</div>
                            </div>
                            <Switch id="autoStart" :model-value="userPreferences.autoStart"
                                @update:model-value="(v) => prefAutoStart(v)" />
                        </li>

                        <li v-if="userPreferences.autoStart"
                            class="flex items-start justify-between p-3 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
                            <div class="flex-1 mr-2">
                                <div class="font-bold">
                                    <label for="ConnectivityRefresh">{{ t('nav.preferences.connectivityAutoRefresh') }}</label>
                                </div>
                                <div class="preferences-tip">{{ t('nav.preferences.connectivityAutoRefreshTips') }}</div>
                            </div>
                            <Switch id="ConnectivityRefresh" :model-value="userPreferences.connectivityAutoRefresh"
                                @update:model-value="(v) => prefConnectivityRefresh(v)" />
                        </li>

                        <li v-if="configs.map"
                            class="flex items-start justify-between p-3 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
                            <div class="flex-1 mr-2">
                                <div class="font-bold">
                                    <label for="showMap">{{ t('nav.preferences.showMap') }}</label>
                                </div>
                                <div class="preferences-tip">{{ t('nav.preferences.showMapTips') }}</div>
                            </div>
                            <Switch id="showMap" :model-value="userPreferences.showMap"
                                @update:model-value="(v) => prefShowMap(v)" />
                        </li>

                        <li v-if="isMobile"
                            class="flex items-start justify-between p-3 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
                            <div class="flex-1 mr-2">
                                <div class="font-bold">
                                    <label for="simpleMode">{{ t('nav.preferences.simpleMode') }}</label>
                                </div>
                                <div class="preferences-tip">{{ t('nav.preferences.simpleModeTips') }}</div>
                            </div>
                            <Switch id="simpleMode" :model-value="userPreferences.simpleMode"
                                @update:model-value="(v) => prefSimpleMode(v)" />
                        </li>

                        <li class="flex items-start justify-between p-3 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
                            <div class="flex-1 mr-2">
                                <div class="font-bold">
                                    <label for="ConnectivityNotifications">{{ t('nav.preferences.popupConnectivityNotifications') }}</label>
                                </div>
                                <div class="preferences-tip">{{ t('nav.preferences.popupConnectivityNotificationsTips') }}</div>
                            </div>
                            <Switch id="ConnectivityNotifications" :model-value="userPreferences.popupConnectivityNotifications"
                                @update:model-value="(v) => prefconnectivityShowNoti(v)" />
                        </li>
                    </ul>
                </div>

                <div class="h-6 mb-5"></div>
            </div>
        </SheetContent>
    </Sheet>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
    AppWindow,
    CircleCheck,
    Languages,
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

const prefersDarkMode = ref(window.matchMedia('(prefers-color-scheme: dark)').matches);
const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

const handleThemeChange = (event) => {
    prefersDarkMode.value = event.matches;
    const theme = userPreferences.value.theme;
    if (theme === 'auto') {
        store.setDarkMode(prefersDarkMode.value);
    } else if (theme === 'light') {
        store.setDarkMode(false);
    } else if (theme === 'dark') {
        store.setDarkMode(true);
    }
    updateBodyClass();
    PWAColor();
};

const updateBodyClass = () => {
    document.body.classList.toggle("body-dark-mode", isDarkMode.value);
};

const PWAColor = () => {
    const themeColor = document.querySelector('meta[name="theme-color"]');
    const backgroundColor = document.querySelector('meta[name="background-color"]');
    const color = isDarkMode.value ? "#171a1d" : "#f8f9fa";
    const bgColor = isDarkMode.value ? "#212529" : "#ffffff";
    themeColor.setAttribute("content", color);
    backgroundColor.setAttribute("content", bgColor);
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
        case 'light':
            store.setDarkMode(false);
            break;
        case 'dark':
            store.setDarkMode(true);
            break;
        case 'auto':
            handleThemeChange({ matches: mediaQueryList.matches });
            break;
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
</script>

<style scoped>
.preferences-title {
    margin-top: 12pt;
    font-weight: 500;
    margin-bottom: 12pt;
}

.preferences-tip {
    font-size: smaller;
    opacity: 0.7;
    margin-top: 3pt;
}

.jn-disabled-text {
    opacity: 0.5;
    text-decoration: line-through;
}
</style>
