<template>
    <!-- Search BTN -->
    <button class="btn btn-primary position-fixed" style="bottom: 20px; right: 20px; z-index: 1050;"
        data-bs-toggle="modal" aria-label="IP Check" data-bs-target="#IPCheck" @click="openQueryIP"
        v-tooltip="$t('Tooltips.QueryIP')"><i class="bi bi-search"></i></button>

    <!-- Search Modal -->
    <div class="modal fade" id="IPCheck" tabindex="-1" aria-labelledby="IPCheck" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                <div class="modal-header" :class="{ 'dark-mode-border': isDarkMode }">
                    <h5 class="modal-title" id="IPCheckTitle">{{ $t('ipcheck.Title') }}</h5>
                    <button type="button" class="btn-close" :class="{ 'dark-mode-close-button': isDarkMode }"
                        data-bs-dismiss="modal" aria-label="Close"></button>

                </div>
                <div class="modal-body" :class="{ 'dark-mode': isDarkMode }">
                    <input type="text" class="form-control mb-2" :class="{ 'dark-mode': isDarkMode }"
                        :placeholder="$t('ipcheck.Placeholder')" v-model="inputIP" @keyup.enter="submitQuery"
                        name="inputIP" id="inputIP">
                    <div v-if="modalQueryError" class="text-danger">{{ modalQueryError }}</div>
                    <div v-if="modalQueryResult" class="mt-2">
                        <div class="card-body">
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-pc-display-horizontal"></i> {{ $t('ipInfos.Country')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">{{ modalQueryResult.country_name }}&nbsp;
                                        <span v-if="modalQueryResult.country_code"
                                            :class="'jn-fl fi fi-' + modalQueryResult.country_code.toLowerCase()"></span>
                                    </span>
                                </li>
                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto"><i class="bi bi-houses"></i> {{ $t('ipInfos.Region')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.region }}
                                    </span>
                                </li>
                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto"><i class="bi bi-sign-turn-right"></i> {{
                                        $t('ipInfos.City')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.city }}
                                    </span>
                                </li>
                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto"><i class="bi bi-ethernet"></i> {{ $t('ipInfos.ISP')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.isp }}
                                    </span>
                                </li>


                                <li v-if="ipGeoSource === 0 && modalQueryResult.type !== $t('ipInfos.proxyDetect.type.unknownType')"
                                    class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-reception-4"></i> {{ $t('ipInfos.type')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.type }}
                                        <span v-if="modalQueryResult.proxyOperator !== 'unknown'">
                                            ( {{ modalQueryResult.proxyOperator }} )
                                        </span>
                                    </span>
                                </li>

                                <li v-if="ipGeoSource === 0 && modalQueryResult.isProxy !== $t('ipInfos.proxyDetect.unknownProxyType')"
                                    class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-shield-fill-check"></i>
                                        {{ $t('ipInfos.isProxy') }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.isProxy }}
                                        <span
                                            v-if="modalQueryResult.proxyProtocol !== $t('ipInfos.proxyDetect.unknownProtocol')">
                                            ( {{ modalQueryResult.proxyProtocol }} )
                                        </span>
                                    </span>
                                </li>


                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-buildings"></i> {{ $t('ipInfos.ASN') }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        <a v-if="modalQueryResult.asnlink" :href="modalQueryResult.asnlink"
                                            target="_blank"
                                            class="link-underline-opacity-50 link-underline-opacity-100-hover"
                                            :class="[isDarkMode ? 'link-light' : 'link-dark']">{{ modalQueryResult.asn
                                            }}</a>
                                    </span>
                                </li>
                            </ul>
                        </div>

                    </div>
                </div>
                <div class="modal-footer" :class="{ 'dark-mode-border': isDarkMode }">
                    <button id="sumitQueryButton" type="button" class="btn btn-primary"
                        :class="{ 'btn-secondary': !isValidIP(inputIP), 'btn-primary': isValidIP(inputIP) }"
                        @click="submitQuery" :disabled="!isValidIP(inputIP) || reCaptchaStatus === false || isChecking === 'running'
                            ">{{
                                $t('ipcheck.Button') }}</button>
                    <span v-if="configs.recaptcha" class="text-secondary" style="font-size:10px">
                        This site is protected by reCAPTCHA and the Google
                        <a href="https://policies.google.com/privacy">Privacy Policy</a> and
                        <a href="https://policies.google.com/terms">Terms of Service</a> apply.
                    </span>
                </div>


            </div>
        </div>
    </div>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { Modal } from 'bootstrap';

export default {
    name: 'QueryIP',

    // 引入 Store
    setup() {
        const store = useStore();
        const isDarkMode = computed(() => store.state.isDarkMode);
        const isMobile = computed(() => store.state.isMobile);
        const ipGeoSource = computed(() => store.state.ipGeoSource);
        const configs = computed(() => store.state.configs);

        return {
            isDarkMode,
            isMobile,
            ipGeoSource,
            configs,
        };
    },

    data() {
        return {
            inputIP: '',
            modalQueryResult: null,
            modalQueryError: "",
            reCaptchaStatus: true,
            reCaptchaLoaded: false,
            isChecking: "idle",
        }
    },

    methods: {
        // 查询 IP 信息
        async submitQuery() {
            // 首先检查输入的 IP 是否有效
            if (this.isValidIP(this.inputIP)) {
                this.modalQueryError = "";
                this.modalQueryResult = null;
                this.isChecking = "running";
                // 如果 reCAPTCHA 已启用，验证令牌
                switch (this.configs.recaptcha) {
                    case true:
                        // 执行 reCAPTCHA 验证
                        grecaptcha.ready(async () => {
                            grecaptcha.execute(import.meta.env.VITE_RECAPTCHA_SITE_KEY, { action: 'submit' }).then(async (token) => {
                                let recaptchaSuccess = await this.verifyRecaptchaToken(token);
                                if (recaptchaSuccess) {
                                    this.reCaptchaStatus = true;
                                    await this.fetchIPForModal(this.inputIP);
                                } else {
                                    this.reCaptchaStatus = false;
                                    this.modalQueryError = this.$t('ipcheck.recaptchaError');
                                    this.isChecking = "idle";
                                }
                            });
                        });
                        break;
                    case false:
                        await this.fetchIPForModal(this.inputIP);
                        break;
                }
            } else {
                // 如果 IP 无效，设置错误信息
                this.modalQueryError = this.$t('ipcheck.Error');
                this.modalQueryResult = null;
                this.isChecking = "idle";
            }
        },

        // 加载 reCAPTCHA 脚本
        loadRecaptchaScript() {
            if (this.configs.recaptcha === false || this.reCaptchaLoaded === true) {
                return;
            }
            // 创建一个 script 元素
            const script = document.createElement('script');
            script.src = `https://www.google.com/recaptcha/api.js?render=${import.meta.env.VITE_RECAPTCHA_SITE_KEY}`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
            // 获取加载完成的状态
            script.onload = () => {
                this.reCaptchaLoaded = true;
            };
        },

        // 验证 reCAPTCHA 令牌
        async verifyRecaptchaToken(token) {
            const response = await fetch(`/api/recaptcha?token=${token}`, {
                method: 'GET',
            });
            const data = await response.json();
            return data.success;
        },

        // 打开查询 IP 的模态框
        openQueryIP() {
            // 如果 reCAPTCHA 脚本尚未加载，加载它
            if (!window.grecaptcha && this.configs.recaptcha) {
                this.loadRecaptchaScript();
            }
            this.$trackEvent('SideButtons', 'ToggleClick', 'QueryIP');
        },

        // 重置 modalQueryResult
        setupModalEventListener() {
            const modalElement = document.getElementById("IPCheck");
            modalElement.addEventListener("hidden.bs.modal", this.resetModalData);
        },

        // 验证 IP 地址合法性
        isValidIP(ip) {
            const ipv4Pattern =
                /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            const ipv6Pattern =
                /^(([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?))$/;
            return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
        },

        // 转换 IP 信息
        transformDataFromIPapi(data) {
            if (data.error) {
                throw new Error(data.reason);
            }

            if (this.ipGeoSource === 0) {

                const proxyDetect = data.proxyDetect || {};

                const isProxy = proxyDetect.proxy === 'yes' ? this.$t('ipInfos.proxyDetect.yes') :
                    proxyDetect.proxy === 'no' ? this.$t('ipInfos.proxyDetect.no') :
                        this.$t('ipInfos.proxyDetect.unknownProxyType');

                const type = proxyDetect.type === 'Business' ? this.$t('ipInfos.proxyDetect.type.Business') :
                    proxyDetect.type === 'Residential' ? this.$t('ipInfos.proxyDetect.type.Residential') :
                        proxyDetect.type === 'Wireless' ? this.$t('ipInfos.proxyDetect.type.Wireless') :
                            proxyDetect.type === 'Hosting' ? this.$t('ipInfos.proxyDetect.type.Hosting') :
                                proxyDetect.type ? proxyDetect.type : this.$t('ipInfos.proxyDetect.type.unknownType');

                const proxyProtocol = proxyDetect.protocol === 'unknown' ? this.$t('ipInfos.proxyDetect.unknownProtocol') :
                    proxyDetect.protocol ? proxyDetect.protocol : this.$t('ipInfos.proxyDetect.unknownProtocol');

                const proxyOperator = proxyDetect.operator ? proxyDetect.operator : "";

                return {
                    country_name: data.country_name || "",
                    country_code: data.country || "",
                    region: data.region || "",
                    city: data.city || "",
                    latitude: data.latitude || "",
                    longitude: data.longitude || "",
                    isp: data.org || "",
                    asn: data.asn || "",
                    asnlink: data.asn ? `https://radar.cloudflare.com/${data.asn}` : false,
                    mapUrl: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${this.bingMapLanguage}&CanvasMode=CanvasLight` : "",
                    mapUrl_dark: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${this.bingMapLanguage}&CanvasMode=RoadDark` : "",
                    isProxy: isProxy,
                    type: type,
                    proxyProtocol: proxyProtocol,
                    proxyOperator: proxyOperator,
                };
            }


            return {
                country_name: data.country_name || "",
                country_code: data.country || "",
                region: data.region || "",
                city: data.city || "",
                latitude: data.latitude || "",
                longitude: data.longitude || "",
                isp: data.org || "",
                asn: data.asn || "",
                asnlink: data.asn ? `https://radar.cloudflare.com/traffic/${data.asn}` : false,
                mapUrl: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${this.bingMapLanguage}&CanvasMode=CanvasLight` : "",
                mapUrl_dark: data.latitude && data.longitude ? `/api/map?latitude=${data.latitude}&longitude=${data.longitude}&language=${this.bingMapLanguage}&CanvasMode=RoadDark` : ""
            };
        },

        // 获取 IP 信息
        async fetchIPForModal(ip, sourceID = null) {

            if (this.reCaptchaStatus === false) {
                this.modalQueryError = this.$t('ipcheck.recaptchaError');
                return;
            }

            let lang = this.$Lang;
            if (lang === 'zh') {
                lang = 'zh-CN';
            };

            sourceID = this.ipGeoSource;

            const sources = [
                { id: 0, url: `/api/ipchecking?ip=${ip}&lang=${lang}`, transform: this.transformDataFromIPapi },
                { id: 1, url: `/api/ipinfo?ip=${ip}`, transform: this.transformDataFromIPapi },
                { id: 2, url: `/api/ipapicom?ip=${ip}&lang=${lang}`, transform: this.transformDataFromIPapi },
                { id: 3, url: `https://ipapi.co/${ip}/json/`, transform: this.transformDataFromIPapi },
                { id: 4, url: `/api/keycdn?ip=${ip}`, transform: this.transformDataFromIPapi },
                { id: 5, url: `/api/ipsb?ip=${ip}`, transform: this.transformDataFromIPapi },
            ];

            // 根据指定的源获取数据
            for (const source of sources) {
                if (sourceID && source.id !== sourceID) {
                    continue;
                }
                try {
                    const response = await fetch(source.url);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const data = await response.json();
                    if (data.error) {
                        throw new Error(data.reason || "IP lookup failed");
                    }

                    // 使用对应的转换函数更新 modalQueryResult
                    this.modalQueryResult = source.transform(data);
                    this.isChecking = "idle";
                    break;
                } catch (error) {
                    console.error("Error fetching IP details:", error);
                }
            }
        },
    },
}
</script>

<style scoped></style>
