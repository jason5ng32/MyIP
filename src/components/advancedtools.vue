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

            <div class="col-lg-3 col-md-6 col-12 mb-4">
                <div class="jn-adv-card card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body" @click.prevent="navigateAndToggleOffcanvas('/pingtest')" role="button">
                        <h3>🌐 {{ $t('pingtest.Title') }}</h3>
                        <p>{{ $t('advancedtools.PingTestNote') }}</p>

                        <div class="go-corner">
                            <div class="go-arrow">
                                ↓
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-3 col-md-6 col-12 mb-4">
                <div class="jn-adv-card card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body" @click.prevent="navigateAndToggleOffcanvas('/mtrtest')" role="button">
                        <h3>📡 {{ $t('mtrtest.Title') }}</h3>
                        <p>{{ $t('advancedtools.MTRTestNote') }}</p>

                        <div class="go-corner">
                            <div class="go-arrow">
                                ↓
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-3 col-md-6 col-12 mb-4">
                <div class="jn-adv-card card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body" @click.prevent="navigateAndToggleOffcanvas('/ruletest')" role="button">
                        <h3>🚏 {{ $t('ruletest.Title') }}</h3>
                        <p>{{ $t('advancedtools.RuleTestNote') }}</p>

                        <div class="go-corner">
                            <div class="go-arrow">
                                ↓
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-3 col-md-6 col-12 mb-4">
                <div class="jn-adv-card card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body" @click.prevent="navigateAndToggleOffcanvas('/dnsresolver')" role="button">
                        <h3>🔦 {{ $t('dnsresolver.Title') }}</h3>
                        <p>{{ $t('advancedtools.DNSResolverNote') }}</p>

                        <div class="go-corner">
                            <div class="go-arrow">
                                ↓
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <div :data-bs-theme="isDarkMode ? 'dark' : ''" class="offcanvas offcanvas-bottom" tabindex="-1"
            :class="[isMobile ? ' h-100' : 'jn-h-80']" id="offcanvasTools" aria-labelledby="offcanvasToolsLabel">
            <div class="offcanvas-header">
                <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
            </div>
            <div class="offcanvas-body mb-4"
            :class="[isMobile ? ' w-100' : 'jn-canvas-width']"
            >
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
            
        }
    },

    methods: {
        navigateAndToggleOffcanvas(routePath) {
            this.$router.push(routePath);
            switch(routePath) {
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
        }
    },
}
</script>

<style scoped>
#offcanvasTools {
    z-index: 10000;
}

.jn-h-80 {
    height: 80%;
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