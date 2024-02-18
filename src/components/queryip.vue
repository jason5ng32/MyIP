<template>
    <!-- Search BTN -->
    <button class="btn btn-primary position-fixed" style="bottom: 20px; right: 20px; z-index: 1050;" data-bs-toggle="modal"
        aria-label="IP Check" data-bs-target="#IPCheck" @click="$trackEvent('SideButtons', 'ToggleClick', 'QueryIP');"><i
            class="bi bi-search"></i></button>

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
                        :placeholder="$t('ipcheck.Placeholder')" v-model="inputIP" @keyup.enter="submitQuery" name="inputIP"
                        id="inputIP">
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
                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }"><span
                                        class="jn-text col-auto"><i class="bi bi-houses"></i> {{ $t('ipInfos.Region')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.region }}
                                    </span>
                                </li>
                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }"><span
                                        class="jn-text col-auto"><i class="bi bi-sign-turn-right"></i> {{ $t('ipInfos.City')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.city }}
                                    </span>
                                </li>
                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }"><span
                                        class="jn-text col-auto"><i class="bi bi-ethernet"></i> {{ $t('ipInfos.ISP')
                                        }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        {{ modalQueryResult.isp }}
                                    </span>
                                </li>
                                <li class="list-group-item jn-list-group-item" :class="{ 'dark-mode': isDarkMode }">
                                    <span class="jn-text col-auto">
                                        <i class="bi bi-buildings"></i> {{ $t('ipInfos.ASN') }}</span>&nbsp;:&nbsp;
                                    <span class="col-10 ">
                                        <a v-if="modalQueryResult.asnlink" :href="modalQueryResult.asnlink" target="_blank"
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
                    <button type="button" class="btn btn-primary"
                        :class="{ 'btn-secondary': !isValidIP(inputIP), 'btn-primary': isValidIP(inputIP) }"
                        @click="submitQuery" :disabled="!isValidIP(inputIP)">{{ $t('ipcheck.Button') }}</button>

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

        return {
            isDarkMode,
            isMobile,
            ipGeoSource
        };
    },

    data() {
        return {
            inputIP: '',
            modalQueryResult: null,
            modalQueryError: "",
        }
    },

    methods: {

        // 查询 IP 信息
        async submitQuery() {
            if (this.isValidIP(this.inputIP)) {
                this.modalQueryError = "";
                this.modalQueryResult = null;
                await this.fetchIPForModal(this.inputIP);
            } else {
                this.modalQueryError = this.$t('ipcheck.Error');
                this.modalQueryResult = null;
            }
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
            let lang = this.$Lang;
            if (lang === 'zh') {
                lang = 'zh-CN';
            };

            sourceID = this.ipGeoSource;

            const sources = [
                { id: 0, url: `/api/ipchecking?ip=${ip}&lang=${lang}`, transform: this.transformDataFromIPapi },
                { id: 1, url: `/api/ipinfo?ip=${ip}`, transform: this.transformDataFromIPapi },
                { id: 2, url: `/api/ipsb?ip=${ip}`, transform: this.transformDataFromIPapi },
                { id: 3, url: `/api/ipapicom?ip=${ip}&lang=${lang}`, transform: this.transformDataFromIPapi },
                { id: 4, url: `https://ipapi.co/${ip}/json/`, transform: this.transformDataFromIPapi },
                { id: 5, url: `api/keycdn?ip=${ip}`, transform: this.transformDataFromIPapi },
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
                    break;
                } catch (error) {
                    console.error("Error fetching IP details:", error);
                }
            }
        },
    }
}
</script>

<style scoped></style>
