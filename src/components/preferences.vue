<template>
    <!-- Offcanvas Preferences -->
    <div :data-bs-theme="isDarkMode ? 'dark' : 'light'" :class="[isMobile ? ' w-100' : '']"
        class="offcanvas offcanvas-start h-100 border-0 mt-5" tabindex="-1" id="offcanvasPreferences"
        aria-labelledby="offcanvasPreferencesLabel">
        <div class="offcanvas-header mt-3">
            <h5 class="offcanvas-title"><i class="bi bi-toggles"></i>&nbsp;&nbsp;{{
                $t('nav.preferences.title') }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body pt-0 m-2">
            <div class="preferences-tip">{{ $t('nav.preferences.preferenceTips') }}</div>

            <!-- 主题方案 -->

            <div id="Pref_colorScheme">
                <div class="form-label col-12 preferences-title"><i class="bi bi-palette-fill"></i> {{
                    $t('nav.preferences.colorScheme') }}</div>
                <div class="btn-group col-auto" role="group" aria-label="Color Scheme">
                    <template v-for="theme in ['auto', 'light', 'dark']">
                        <input type="radio" class="btn-check" :name="'darkMode' + theme" :id="'darkMode' + theme"
                            autocomplete="off" :value="theme" v-model="userPreferences.theme"
                            @change="prefTheme(theme)">
                        <label class="btn" :class="{
                            'btn-outline-dark': !isDarkMode,
                            'btn-outline-light': isDarkMode,
                            'active text-bg-primary': userPreferences.theme === theme
                        }" :for="'darkMode' + theme">
                            <span v-if="theme === 'light'"><i class="bi bi-brightness-high"></i> {{
                                $t('nav.preferences.colorLight') }}</span>
                            <span v-else-if="theme === 'dark'"><i class="bi bi-moon-stars"></i> {{
                                $t('nav.preferences.colorDark') }}</span>
                            <span v-else>{{ $t('nav.preferences.colorAuto') }}</span>
                        </label>
                    </template>
                </div>
            </div>

            <!-- IP 源 -->

            <div id="Pref_ipCards">
                <div class="form-label col-12 preferences-title">
                    <i class="bi bi-ui-checks-grid"></i> {{ $t('nav.preferences.ipSourcesToCheck') }}
                </div>
                <div class="btn-group col-auto w-50 mb-2" role="group" aria-label="ipCards">
                    <template v-for="num in [2, 3, 6]">
                        <input v-model="userPreferences.ipCardsToShow" type="radio" class="btn-check"
                            :name="'ipCards_' + num" :id="'ipCards_' + num" autocomplete="off" :value=num
                            @change="prefipCards(num)">
                        <label class="btn jn-number" :class="{
                            'btn-outline-dark': !isDarkMode,
                            'btn-outline-light': isDarkMode,
                            'active text-bg-primary': userPreferences.ipCardsToShow === num
                        }" :for="'ipCards_' + num">{{ num
                            }}</label>
                    </template>
                </div>
                <div class="preferences-tip">{{ $t('nav.preferences.ipSourcesToCheckTips') }}</div>
            </div>

            <!-- IP 地理位置数据库 -->

            <div id="Pref_ipGeoSource">
                <div class="form-label col-12 preferences-title">
                    <i class="bi bi-ui-checks-grid"></i> {{ $t('nav.preferences.ipDB') }}
                </div>
                <div class="btn-group-vertical col-auto w-50 mb-2" role="group" aria-label="ipGeoSource">
                    <template v-for="ipdb in ipDBs">
                        <input v-model="userPreferences.ipGeoSource" type="radio" class="btn-check"
                            :name="'ipGeoSource_' + ipdb.text" :id="'ipGeoSource_' + ipdb.id" autocomplete="off"
                            :value=ipdb.id @change="prefipGeoSource(ipdb.id)">
                        <label class="btn jn-number text-start" :class="{
                            'btn-outline-dark': !isDarkMode,
                            'btn-outline-light': isDarkMode,
                            'active text-bg-primary': userPreferences.ipGeoSource === ipdb.id,
                            'jn-disabled-button': !ipdb.enabled
                        }" :for="'ipGeoSource_' + ipdb.id" :aria-disabled="!ipdb.enabled" :aria-label="ipdb.text">
                            <span :class="[ipdb.enabled ? '' : 'jn-disabled-text']">{{ ipdb.text }}&nbsp;</span>
                            <i class="bi bi-check2-circle" v-if="userPreferences.ipGeoSource === ipdb.id"></i>
                        </label>
                    </template>
                </div>
                <div class="preferences-tip">{{ $t('nav.preferences.ipDBTips') }}</div>
            </div>

            <!-- 应用设置 -->

            <div id="Pref_appSettings">
                <div class="form-label col-12 preferences-title"><i class="bi bi-window-dock"></i> {{
                    $t('nav.preferences.appSettings') }}</div>
                <ul class="list-group">
                    <li class="list-group-item d-flex justify-content-between align-items-start"
                        :class="[isDarkMode ? 'border-light' : 'border-dark']">
                        <div class="me-auto">
                            <div class="fw-bold"><label class="form-check-label" for="autoStart">{{
                                $t('nav.preferences.autoRun')
                                    }}</label>
                            </div>
                            <div class="preferences-tip">{{ $t('nav.preferences.autoRunTips') }}</div>
                        </div>
                        <div class="form-check form-switch col-auto ">
                            <input class="form-check-input" type="checkbox" role="switch" id="autoStart"
                                :checked="userPreferences.autoStart" @change="prefAutoStart($event.target.checked)">
                        </div>
                    </li>

                    <li class="list-group-item d-flex justify-content-between align-items-start"
                        :class="[isDarkMode ? 'border-light' : 'border-dark']" v-if="userPreferences.autoStart">
                        <div class="me-auto">
                            <div class="fw-bold"><label class="form-check-label" for="ConnectivityRefresh">{{
                                $t('nav.preferences.connectivityAutoRefresh') }}</label></div>
                            <div class="preferences-tip">{{ $t('nav.preferences.connectivityAutoRefreshTips') }}</div>
                        </div>
                        <div class="form-check form-switch col-auto ">
                            <input class="form-check-input" type="checkbox" role="switch" id="ConnectivityRefresh"
                                :checked="userPreferences.connectivityAutoRefresh"
                                @change="prefConnectivityRefresh($event.target.checked)">
                        </div>
                    </li>

                    <li class="list-group-item d-flex justify-content-between align-items-start"
                        :class="[isDarkMode ? 'border-light' : 'border-dark']" v-if="configs.bingMap">
                        <div class="me-auto">
                            <div class="fw-bold"><label class="form-check-label" for="showMap">{{
                                $t('nav.preferences.showMap')
                                    }}</label>
                            </div>
                            <div class="preferences-tip">{{ $t('nav.preferences.showMapTips') }}</div>
                        </div>
                        <div class="form-check form-switch col-auto ">
                            <input class="form-check-input" type="checkbox" role="switch" id="showMap"
                                :checked="userPreferences.showMap" @change="prefShowMap($event.target.checked)">
                        </div>
                    </li>

                    <li class="list-group-item d-flex justify-content-between align-items-start"
                        :class="[isDarkMode ? 'border-light' : 'border-dark']" v-if="isMobile">
                        <div class="me-auto">
                            <div class="fw-bold"><label class="form-check-label" for="simpleMode">{{
                                $t('nav.preferences.simpleMode')
                                    }}</label></div>
                            <div class="preferences-tip">{{ $t('nav.preferences.simpleModeTips') }}</div>
                        </div>
                        <div class="form-check form-switch col-auto ">
                            <input class="form-check-input" type="checkbox" role="switch" id="simpleMode"
                                :checked="userPreferences.simpleMode" @change="prefSimpleMode($event.target.checked)">
                        </div>
                    </li>

                    <li class="list-group-item d-flex justify-content-between align-items-start"
                        :class="[isDarkMode ? 'border-light' : 'border-dark']">
                        <div class="me-auto">
                            <div class="fw-bold"><label class="form-check-label" for="ConnectivityNotifications">{{
                                $t('nav.preferences.popupConnectivityNotifications') }}</label>
                            </div>
                            <div class="preferences-tip">{{ $t('nav.preferences.popupConnectivityNotificationsTips') }}
                            </div>
                        </div>
                        <div class="form-check form-switch col-auto ">
                            <input class="form-check-input" type="checkbox" role="switch" id="ConnectivityNotifications"
                                :checked="userPreferences.popupConnectivityNotifications"
                                @change="prefconnectivityShowNoti($event.target.checked)">
                        </div>
                    </li>

                </ul>
            </div>

            <div id="offcanvasPlaceholder mb-5" class="jn-placeholder mb-5">
            </div>

        </div>
    </div>

</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';

export default {
    name: 'Preferences',

    // 引入 Store
    setup() {
        const store = useStore();
        const isDarkMode = computed(() => store.state.isDarkMode);
        const isMobile = computed(() => store.state.isMobile);
        const configs = computed(() => store.state.configs);
        const userPreferences = computed(() => store.state.userPreferences);
        const ipDBs = computed(() => store.state.ipDBs);

        return {
            isDarkMode,
            isMobile,
            configs,
            userPreferences,
            ipDBs,
        };
    },

    data() {
        return {
            prefersDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
        }
    },
    methods: {

        // 保存偏好设置到 Vuex
        setUserPreferences(key, value) {
            this.$store.commit('UPDATE_PREFERENCE', { key, value });
        },

        // 主题模式切换
        handleThemeChange(event) {
            this.prefersDarkMode = event.matches;
            if (this.userPreferences.theme === 'auto') {
                this.$store.commit('SET_DARK_MODE', this.prefersDarkMode);
            } else if (this.userPreferences.theme === 'light') {
                this.$store.commit('SET_DARK_MODE', false);
            } else if (this.userPreferences.theme === 'dark') {
                this.$store.commit('SET_DARK_MODE', true);
            }
            this.updateBodyClass();
            this.PWAColor();
        },


        // 偏好设置里的一些配置项
        prefTheme(value) {
            switch (value) {
                case 'light':
                    this.$store.commit('SET_DARK_MODE', false);
                    break;
                case 'dark':
                    this.$store.commit('SET_DARK_MODE', true);
                    break;
                case 'auto':
                    this.handleThemeChange({ matches: this.mediaQueryList.matches });
                    break;
            }
            this.updateBodyClass();
            this.PWAColor();
            this.setUserPreferences('theme', value);
            this.$trackEvent('Nav', 'PrefereceClick', 'Theme');
        },

        prefConnectivityRefresh(value) {
            this.setUserPreferences('connectivityAutoRefresh', value);
            this.$trackEvent('Nav', 'PrefereceClick', 'ConnectivityRefresh');
        },

        prefShowMap(value) {
            this.setUserPreferences('showMap', value);
            this.$trackEvent('Nav', 'PrefereceClick', 'ShowMap');
        },

        prefSimpleMode(value) {
            this.setUserPreferences('simpleMode', value);
            this.$trackEvent('Nav', 'PrefereceClick', 'SimpleMode');
        },

        prefAutoStart(value) {
            this.setUserPreferences('autoStart', value);
            this.$trackEvent('Nav', 'PrefereceClick', 'AutoStart');
        },

        prefconnectivityShowNoti(value) {
            this.setUserPreferences('popupConnectivityNotifications', value);
            this.$trackEvent('Nav', 'PrefereceClick', 'ConnectivityNotifications');
        },

        prefipCards(value) {
            this.setUserPreferences('ipCardsToShow', value);
            this.$trackEvent('Nav', 'PrefereceClick', 'ipCards');
        },

        prefipGeoSource(value) {
            this.setUserPreferences('ipGeoSource', value);
            this.$trackEvent('Nav', 'PrefereceClick', 'ipGeoSource');
            this.$trackEvent('IPCheck', 'SelectSource', this.ipDBs.find(x => x.id === value).text);
        },

        toggleMaps() {
            this.setUserPreferences('showMap', !this.userPreferences.showMap);
            this.$trackEvent('Nav', 'ToggleClick', 'ShowMap');
        },

        // 收起导航栏
        collapseNav() {
            document.querySelector('#navbarNavAltMarkup').classList.remove('show');
        },

        // 更新 body class
        updateBodyClass() {
            if (this.isDarkMode) {
                document.body.classList.add("dark-mode");
            } else {
                document.body.classList.remove("dark-mode");
            }
        },

        // 更新 PWA 颜色
        PWAColor() {
            if (this.isDarkMode) {
                document
                    .querySelector('meta[name="theme-color"]')
                    .setAttribute("content", "#171a1d");
                document
                    .querySelector('meta[name="background-color"]')
                    .setAttribute("content", "#212529");
            } else {
                document
                    .querySelector('meta[name="theme-color"]')
                    .setAttribute("content", "#f8f9fa");
                document
                    .querySelector('meta[name="background-color"]')
                    .setAttribute("content", "#ffffff");
            }
        },

    },
    created() {
        this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
        this.mediaQueryList.addListener(this.handleThemeChange);
        this.handleThemeChange({ matches: this.mediaQueryList.matches });
    },
    beforeDestroy() {
        if (this.mediaQueryList) {
            this.mediaQueryList.removeListener(this.handleThemeChange);
        }
    },
}
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

.jn-number {
    min-width: 40pt;
}

.jn-margin {
    margin-top: 42pt;
}

.jn-placeholder {
    height: 20pt;
}

.jn-disabled-text {
    opacity: 0.5;
    text-decoration: line-through;
}

.jn-disabled-button {
    pointer-events: none;
}

#offcanvasPreferences {
    z-index: 1053;
}
</style>