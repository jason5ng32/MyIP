<template>
    <!-- InvisibilityTest Resolver -->
    <div class="invisibilitytest-section mb-4">
        <div class="jn-title2">
            <h2 id="InvisibilityTest" :class="{ 'mobile-h2': isMobile }">🫣 {{ t('invisibilitytest.Title') }}</h2>
        </div>
        <div class="text-secondary">
            <p>{{ t('invisibilitytest.Note') }}</p>
        </div>
        <div class="row">
            <div class="col-12 mb-3">
                <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body">
                        <div class="col-12 col-md-auto mt-2">
                            <span>{{ t('invisibilitytest.Note2') }}</span>
                        </div>

                        <div class="input-group mb-2 mt-3">

                            <div class="input-group-text">
                                <input class="form-check-input mt-0" type="checkbox" value=""
                                    aria-label="Checkbox for Collecting datas" name="collectingDatas"
                                    id="collectingDatas" v-model="isAgreed">
                                <label for="collectingDatas">&nbsp;{{ t('invisibilitytest.agreement') }}</label>
                            </div>

                            <button class="btn btn-primary" @click="onSubmit"
                                :disabled="checkingStatus === 'running' || !isAgreed">
                                <span v-if="checkingStatus === 'idle'">{{
                                    t('invisibilitytest.Run') }}</span>
                                <span v-if="checkingStatus === 'running'" class="spinner-grow spinner-grow-sm"
                                    aria-hidden="true"></span>
                            </button>

                        </div>

                        <div class="jn-placeholder">
                            <p v-if="errorMsg" class="text-danger">{{ errorMsg }}</p>
                        </div>

                        <!-- Results Table -->
                        <Transition name="jn-it-slide-fade">
                            <div class="alert alert-success" role="alert" v-if="Object.keys(testResults).length > 0">

                                <p>{{ t('invisibilitytest.yourIP') }}: <strong>{{ testResults.ip }}</strong>.</p>

                                <p><i class="bi bi-lock-fill"></i> {{ t('invisibilitytest.proxyScore') }}:
                                    {{ testResults.score.proxy }}%.
                                </p>
                                <p><i class="bi bi-shield-lock-fill"></i> {{ t('invisibilitytest.VPNScore') }}:
                                    {{ testResults.score.vpn }}%.
                                </p>

                                <span v-if="testResults.score.proxy >= 50">
                                    <strong>{{ t('invisibilitytest.isProxy') }}&nbsp;</strong>
                                </span>
                                <span v-else>
                                    {{ t('invisibilitytest.notProxy') }}&nbsp;
                                </span>

                                <span v-if="testResults.score.vpn >= 50">
                                    <strong>{{ t('invisibilitytest.isVPN') }}</strong>
                                </span>
                                <span v-else>
                                    {{ t('invisibilitytest.notVPN') }}
                                </span>
                            </div>
                        </Transition>
                        <Transition name="slide-fade">
                            <div class="table-responsive text-nowrap" v-if="Object.keys(testResults).length > 0">
                                <table class="table table-hover" :class="{ 'table-dark': isDarkMode }">
                                    <thead>
                                        <tr>
                                            <th scope="col">{{ t('invisibilitytest.itemName') }}</th>
                                            <th scope="col">{{ t('invisibilitytest.itemProxyResult') }}</th>
                                            <th scope="col">{{ t('invisibilitytest.itemComment') }}</th>
                                        </tr>
                                    </thead>
                                    <tbody>

                                        <!--IP 黑名单-->
                                        <tr>
                                            <td class="jn-table-col">{{ t('invisibilitytest.blocklist.title') }}</td>
                                            <td>
                                                <i class="bi"
                                                    :class="(testResults.blocklist.proxy || testResults.blocklist.vpn) ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success'"></i>
                                            </td>
                                            <td>
                                                <span class="opacity-75"
                                                    v-if="(testResults.blocklist.proxy || testResults.blocklist.vpn)">{{
                                                    t('invisibilitytest.blocklist.proxy') }}</span>
                                                <span class="opacity-75" v-else>{{
                                                    t('invisibilitytest.blocklist.notProxy') }}</span>
                                            </td>
                                        </tr>

                                        <!--Header 判断-->
                                        <tr>
                                            <td>{{ t('invisibilitytest.headers.title') }}</td>
                                            <td>
                                                <i class="bi"
                                                    :class="testResults.headers.proxy ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success'"></i>
                                            </td>
                                            <td>
                                                <span class="opacity-75" v-if="testResults.headers.proxy">{{
                                                    t('invisibilitytest.headers.proxy') }}</span>
                                                <span class="opacity-75" v-else>{{
                                                    t('invisibilitytest.headers.notProxy') }}</span>
                                            </td>
                                        </tr>

                                        <!-- 数据中心 判断 -->
                                        <tr>
                                            <td>{{ t('invisibilitytest.datacenter.title') }}</td>
                                            <td>
                                                <i class="bi"
                                                    :class="(testResults.datacenter.proxy || testResults.datacenter.vpn) ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success'"></i>
                                            </td>
                                            <td>
                                                <span class="opacity-75"
                                                    v-if="(testResults.datacenter.proxy || testResults.datacenter.vpn)">
                                                    {{ t('invisibilitytest.datacenter.proxy') }}
                                                    <strong>{{ testResults.datacenter.hosting }}</strong>
                                                </span>
                                                <span class="opacity-75" v-else>{{
                                                    t('invisibilitytest.datacenter.notProxy') }}</span>
                                            </td>
                                        </tr>

                                        <!-- TCP 指纹判断 -->
                                        <tr>
                                            <td>{{ t('invisibilitytest.tcp.title') }}</td>
                                            <td>
                                                <i class="bi"
                                                    :class="testResults.tcp.proxy ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success'"></i>
                                            </td>
                                            <td>
                                                <span class="opacity-75" v-if="testResults.tcp.proxy">
                                                    {{ t('invisibilitytest.tcp.proxy') }}
                                                    <br />
                                                    {{ t('invisibilitytest.tcp.computer') }}
                                                    <strong>{{ testResults.tcp.clientos }}</strong>.

                                                    {{ t('invisibilitytest.tcp.server') }}
                                                    <strong>{{ testResults.tcp.ipos }}</strong>

                                                </span>
                                                <span class="opacity-75" v-else>{{ t('invisibilitytest.tcp.notProxy')
                                                    }}</span>
                                            </td>
                                        </tr>

                                        <!-- 时区差异 -->
                                        <tr>
                                            <td>{{ t('invisibilitytest.timezone.title') }}</td>
                                            <td>
                                                <i class="bi"
                                                    :class="(testResults.timezone.proxy || testResults.timezone.vpn) ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success'"></i>
                                            </td>
                                            <td>
                                                <span class="opacity-75"
                                                    v-if="(testResults.timezone.proxy || testResults.timezone.vpn)">
                                                    {{ t('invisibilitytest.timezone.proxy') }}
                                                    <br />
                                                    {{ t('invisibilitytest.timezone.computer') }}
                                                    <strong>{{ testResults.timezone.clienttimezone }}</strong>.
                                                    {{ t('invisibilitytest.timezone.server') }}
                                                    <strong>{{ testResults.timezone.iptimezone }}</strong>
                                                </span>
                                                <span class="opacity-75" v-else>{{
                                                    t('invisibilitytest.timezone.notProxy') }}</span>
                                            </td>
                                        </tr>

                                        <!-- 网络解析 -->
                                        <tr>
                                            <td>{{ t('invisibilitytest.net.title') }}</td>
                                            <td>
                                                <i class="bi"
                                                    :class="testResults.net.proxy ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success'"></i>
                                            </td>
                                            <td>
                                                <span class="opacity-75" v-if="testResults.net.proxy">{{
                                                    t('invisibilitytest.net.proxy')
                                                    }}</span>
                                                <span class="opacity-75" v-else>{{ t('invisibilitytest.net.notProxy')
                                                    }}</span>
                                            </td>
                                        </tr>

                                        <!-- WebRTC 检测 -->
                                        <tr>
                                            <td>{{ t('invisibilitytest.webrtc.title') }}</td>
                                            <td>
                                                <i class="bi"
                                                    :class="testResults.webrtc.proxy ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success'"></i>
                                            </td>
                                            <td>
                                                <span class="opacity-75" v-if="testResults.webrtc.proxy">
                                                    {{ t('invisibilitytest.webrtc.proxy') }}
                                                    <br />
                                                    {{ t('invisibilitytest.webrtc.ipsAre') }}

                                                    <span v-for="item in testResults.webrtc.allips"
                                                        :key="item"><strong>{{ item
                                                            }}</strong>, </span>
                                                    <strong>{{ testResults.webrtc.ip }}</strong>
                                                </span>
                                                <span class="opacity-75" v-else>{{ t('invisibilitytest.webrtc.notProxy')
                                                    }}</span>
                                            </td>
                                        </tr>

                                        <!-- 流量分析 -->
                                        <tr>
                                            <td>{{ t('invisibilitytest.flow.title') }}</td>
                                            <td>
                                                <i class="bi"
                                                    :class="testResults.flow.proxy ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success'"></i>
                                            </td>
                                            <td>
                                                <span class="opacity-75" v-if="testResults.flow.proxy">{{
                                                    t('invisibilitytest.flow.proxy')
                                                    }}</span>
                                                <span class="opacity-75" v-else>{{ t('invisibilitytest.flow.notProxy')
                                                    }}</span>
                                            </td>
                                        </tr>

                                        <!-- 延迟分析 -->
                                        <tr>
                                            <td>{{ t('invisibilitytest.latency.title') }}</td>
                                            <td>
                                                <i class="bi"
                                                    :class="testResults.latency.proxy ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success'"></i>
                                            </td>
                                            <td>
                                                <span class="opacity-75" v-if="testResults.latency.proxy">
                                                    {{ t('invisibilitytest.latency.proxy') }}
                                                    <br />
                                                    {{ t('invisibilitytest.latency.fromTCP') }}
                                                    <strong>{{ testResults.latency.tcpTime }}ms</strong>,

                                                    {{ t('invisibilitytest.latency.fromWS') }}
                                                    <strong>{{ testResults.latency.wsTime }}ms</strong>
                                                </span>
                                                <span class="opacity-75" v-else>{{
                                                    t('invisibilitytest.latency.notProxy') }}</span>
                                            </td>
                                        </tr>

                                        <!-- 高延迟分析 -->
                                        <tr>
                                            <td>{{ t('invisibilitytest.highlatency.title') }}</td>
                                            <td>
                                                <i class="bi"
                                                    :class="testResults.highlatency.proxy ? 'bi-x-circle-fill text-danger' : 'bi-check-circle-fill text-success'"></i>
                                            </td>
                                            <td>
                                                <span class="opacity-75" v-if="testResults.highlatency.proxy">{{
                                                    t('invisibilitytest.highlatency.proxy') }}</span>
                                                <span class="opacity-75" v-else>{{
                                                    t('invisibilitytest.highlatency.notProxy') }}</span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </Transition>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);

const checkingStatus = ref('idle');
const errorMsg = ref('');
const testResults = ref({});
const userID = ref('');
const isAgreed = ref(false);
const retryCount = ref(0);

// 生成28位字符串
const generate28DigitString = () => {
    const unixTime = Date.now().toString();
    const fixedString = "jason5ng32";
    const neededUnixTimeLength = 13;
    const remainingLength = 28 - fixedString.length - neededUnixTimeLength;
    const randomString = Math.random().toString(36).substring(2, 2 + remainingLength);
    return unixTime.substring(0, neededUnixTimeLength) + fixedString + randomString;
};

// 加载测试脚本
const loadScript = () => {
    const script = document.createElement('script');
    script.src = `https://proxydetectjs.ipcheck.ing/?pdKey=${import.meta.env.VITE_INVISIBILITY_TEST_KEY}&pdVal=${userID.value}`;
    script.async = true;
    script.setAttribute('data-tag', 'invisibilityTestScript');
    script.onload = () => {
        // console.log('Script loaded successfully');
    };
    script.onerror = (error) => {
        console.error('Script load error:', error);
    };
    document.head.appendChild(script);
};

// 移除测试脚本
const removeScript = () => {
    const scripts = document.querySelectorAll('script[data-tag="invisibilityTestScript"]');
    scripts.forEach(script => script.remove());
};

// 提交查询
const onSubmit = () => {
    checkingStatus.value = 'running';
    userID.value = generate28DigitString();
    trackEvent('Section', 'StartClick', 'InvisibilityTest');
    errorMsg.value = '';
    testResults.value = {};
    loadScript();

    setTimeout(() => {
        getResult();
    }, 6000);
};

// 获取测试结果
const getResult = async () => {
    try {
        const response = await fetch(`/api/invisibility?id=${userID.value}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();

        // 检查并重试
        if (data.message === "Data not found" && retryCount.value < 3) {
            setTimeout(() => {
                getResult();
            }, 4000, retryCount.value++);
            return;
        }
        testResults.value = data;
    } catch (error) {
        console.error('Error fetching InvisibilityTest results:', error);
        if (retryCount.value < 3) {
            setTimeout(() => {
                getResult();
            }, 4000, retryCount.value + 1);
            return;
        } else {
            errorMsg.value = t('invisibilitytest.fetchError');
        }
    } finally {
        removeScript();
    }
    checkingStatus.value = 'idle';
    retryCount.value = 0;
};
</script>

<style scoped>
.jn-placeholder {
    height: 16pt;
}

.jn-table-col {
    min-width: 120pt;
}

.jn-circle {
    width: 80pt;
    height: 80pt;
    border-radius: 50%;
    display: inline-block;
}

.jn-it-slide-fade-enter-active {
    transition: all 0.5s ease-in;
}

.jn-it-slide-fade-leave-active {
    transition: all 0.5s ease-out;
}

.jn-it-slide-fade-enter-from,
.jn-it-slide-fade-leave-to {
    transform: translateY(20px);
    opacity: 0;
}
</style>
