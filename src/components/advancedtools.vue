<template>
    <!-- Advanced Tools -->
    <div class="advanced-tools-section mb-4">
        <div class="jn-title2">
            <h2 id="AdvancedTools" :class="{ 'mobile-h2': isMobile }">🧰 {{ $t('advancedtools.Title') }}</h2>

        </div>
        <div class="text-secondary">
            <p>{{ $t('advancedtools.Note') }}</p>
        </div>
        <div class="row">
            <div class="col-lg-3 col-md-6 col-12 mb-4" v-for="(card, index) in cards" :key="index">
                <div class="jn-adv-card card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body" @click.prevent="navigateAndToggleOffcanvas(card.path)" role="button">
                        <h3 :class="{ 'mobile-h3': isMobile }">{{ card.icon }} {{ $t(card.titleKey) }}</h3>
                        <p class="opacity-75">{{ $t(card.noteKey) }}</p>
                        <div class="go-corner">
                            <div class="go-arrow"><i class="bi bi-chevron-double-down"></i></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div :data-bs-theme="isDarkMode ? 'dark' : ''" class="offcanvas offcanvas-bottom" tabindex="-1"
            :class="[isMobile ? 'h-100' : 'jn-h']" id="offcanvasTools" aria-labelledby="offcanvasToolsLabel">
            <div class="offcanvas-header justify-content-end">
                <button v-if="!isMobile" type="button" class="btn opacity-50 jn-bold" @click="fullScreen">
                    <span v-if="!isFullScreen">
                        <i class="bi bi-arrows-fullscreen"></i>
                    </span>
                    <span v-else>
                        <i class="bi bi-fullscreen-exit"></i>
                    </span>
                </button>

                <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
            </div>
            <div class="offcanvas-body pt-0" :class="[isMobile ? ' w-100' : 'jn-canvas-width']">
                <router-view></router-view>
            </div>
        </div>
    </div>

</template>

<script>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { Offcanvas } from 'bootstrap';

export default {
    name: 'AdvancedTools',

    // 引入 Store
    setup() {
        const store = useStore();
        const isDarkMode = computed(() => store.state.isDarkMode);
        const isMobile = computed(() => store.state.isMobile);


        return {
            isDarkMode,
            isMobile,
        };
    },

    data() {
        return {
            cards: [
                { path: '/pingtest', icon: '🌐', titleKey: 'pingtest.Title', noteKey: 'advancedtools.PingTestNote' },
                { path: '/mtrtest', icon: '📡', titleKey: 'mtrtest.Title', noteKey: 'advancedtools.MTRTestNote' },
                { path: '/ruletest', icon: '🚏', titleKey: 'ruletest.Title', noteKey: 'advancedtools.RuleTestNote' },
                { path: '/dnsresolver', icon: '🔦', titleKey: 'dnsresolver.Title', noteKey: 'advancedtools.DNSResolverNote' },
            ],
            isFullScreen: false,
        }
    },

    methods: {
        navigateAndToggleOffcanvas(routePath) {
            this.$router.push(routePath);
            switch (routePath) {
                case '/pingtest':
                    this.$trackEvent('Nav', 'NavClick', 'PingTest');
                    break;
                case '/mtrtest':
                    this.$trackEvent('Nav', 'NavClick', 'MTRTest');
                    break;
                case '/ruletest':
                    this.$trackEvent('Nav', 'NavClick', 'RuleTest');
                    break;
                case '/dnsresolver':
                    this.$trackEvent('Nav', 'NavClick', 'DNSResolver');
                    break;
            }
            var offcanvas = new Offcanvas(document.getElementById('offcanvasTools'));
            offcanvas.show();
        },

        fullScreen() {
            const offcanvas = document.getElementById('offcanvasTools');
            if (offcanvas) {
                offcanvas.style.transition = 'height 0.5s ease-in-out';
                if (!this.isFullScreen) {
                    offcanvas.style.height = '100%';
                    this.isFullScreen = true;
                } else {
                    offcanvas.style.height = '80%';
                    this.isFullScreen = false;
                }
                setTimeout(() => {
                    offcanvas.style.transition = '';
                }, 500);
            }
        }

    },
}
</script>

<style scoped>
#offcanvasTools {
    z-index: 10000;
}

.jn-h {
    height: 80%;
}

.jn-bold {
    -webkit-text-stroke: 1px;
}

.jn-bold:hover {
    opacity: 1 !important;
}

.jn-canvas-width {
    width: fit-content;
    margin: auto;
    max-width: 1400px;
}


.go-corner {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    width: 32px;
    height: 32px;
    overflow: hidden;
    top: 0;
    right: 0;
    background-color: rgb(13, 110, 253);
    border-radius: 0 4px 0 32px;
}

.go-arrow {
    margin-top: -4px;
    margin-right: -4px;
    color: white;
    transition: all 0.4s ease;
}

.jn-adv-card:hover .go-arrow {
    transform: rotateZ(-180deg);
}

.jn-adv-card {
    display: block;
    position: relative;
    text-decoration: none;
    z-index: 0;
    overflow: hidden;
}

.jn-adv-card:before {
    content: "";
    position: absolute;
    z-index: -1;
    top: -16px;
    right: -16px;
    background: rgb(13, 110, 253);
    height: 42px;
    width: 42px;
    border-radius: 32px;
    transform: scale(1);
    transform-origin: 50% 50%;
    transition: transform 0.25s ease-out;
}

.jn-adv-card:hover:before {
    transform: scale(21);
}

.jn-adv-card:hover p {
    transition: all 0.3s ease-out;
    color: #fff;
}

.jn-adv-card:hover h3 {
    transition: all 0.3s ease-out;
    color: #fff;
}
</style>