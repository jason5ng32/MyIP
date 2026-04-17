<template>
    <!-- InvisibilityTest Resolver -->
    <div class="invisibilitytest-section my-4">
        <div class="text-neutral-500">
            <p>{{ t('invisibilitytest.Note') }}</p>
        </div>
        <div class="mb-3">
            <div class="jn-card rounded-lg border bg-card text-card-foreground">
                <div class="p-4">
                    <div class="mt-2">
                        <span>{{ t('invisibilitytest.Note2') }}</span>
                    </div>

                    <div class="flex items-stretch mb-2 mt-3">
                        <div class="flex items-center gap-2 px-3 border border-input rounded-l-md">
                            <input type="checkbox" class="h-4 w-4 rounded"
                                aria-label="Checkbox for Collecting datas" name="collectingDatas"
                                id="collectingDatas" v-model="isAgreed" :disabled="!store.user">
                            <label for="collectingDatas">&nbsp;{{ t('invisibilitytest.agreement') }}</label>
                        </div>

                        <Button class="rounded-l-none -ml-px bg-blue-600 hover:bg-blue-700 text-white"
                            @click="onSubmit"
                            :disabled="checkingStatus === 'running' || !isAgreed || !store.user">
                            <span v-if="checkingStatus === 'idle'">{{ t('invisibilitytest.Run') }}</span>
                            <span v-if="checkingStatus === 'running'"
                                class="inline-block h-3 w-3 rounded-full bg-current animate-pulse" aria-hidden="true"></span>
                        </Button>
                    </div>

                    <div v-if="!store.user" class="text-green-600 mb-2 mt-3">
                        {{ t('user.SignInToUse') }}
                    </div>

                    <div class="jn-placeholder">
                        <p v-if="errorMsg" class="text-red-600">{{ errorMsg }}</p>
                    </div>

                    <!-- Results -->
                    <Transition name="jn-it-slide-fade">
                        <div class="px-3 py-2 rounded-md border bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200"
                            role="alert" v-if="Object.keys(testResults).length > 0 && store.user">

                            <p>{{ t('invisibilitytest.yourIP') }}: <strong>{{ testResults.ip }}</strong>.</p>
                            <p><i class="bi bi-lock-fill"></i> {{ t('invisibilitytest.proxyScore') }}:
                                {{ testResults.score.proxy }}%.</p>
                            <p><i class="bi bi-shield-lock-fill"></i> {{ t('invisibilitytest.VPNScore') }}:
                                {{ testResults.score.vpn }}%.</p>

                            <span v-if="testResults.score.proxy >= 50">
                                <strong>{{ t('invisibilitytest.isProxy') }}&nbsp;</strong>
                            </span>
                            <span v-else>{{ t('invisibilitytest.notProxy') }}&nbsp;</span>

                            <span v-if="testResults.score.vpn >= 50">
                                <strong>{{ t('invisibilitytest.isVPN') }}</strong>
                            </span>
                            <span v-else>{{ t('invisibilitytest.notVPN') }}</span>
                        </div>
                    </Transition>
                    <Transition name="slide-fade">
                        <div class="overflow-x-auto whitespace-nowrap"
                            v-if="Object.keys(testResults).length > 0 && store.user">
                            <table class="w-full border-collapse">
                                <thead>
                                    <tr class="border-b border-neutral-200 dark:border-neutral-700">
                                        <th scope="col" class="text-left p-2">{{ t('invisibilitytest.itemName') }}</th>
                                        <th scope="col" class="text-left p-2">{{ t('invisibilitytest.itemProxyResult') }}</th>
                                        <th scope="col" class="text-left p-2">{{ t('invisibilitytest.itemComment') }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2">{{ t('invisibilitytest.headers.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="testResults.headers.proxy ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.headers.proxy">{{ t('invisibilitytest.headers.positive') }}</span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.headers.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2">{{ t('invisibilitytest.datacenter.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="testResults.datacenter.is_datacenter ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.datacenter.is_datacenter">{{ t('invisibilitytest.datacenter.positive') }}</span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.datacenter.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2 jn-table-col">{{ t('invisibilitytest.blocklist.proxy.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="testResults.blocklist.proxy ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.blocklist.proxy">{{ t('invisibilitytest.blocklist.proxy.positive') }}</span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.blocklist.proxy.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2 jn-table-col">{{ t('invisibilitytest.blocklist.vpn.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="testResults.blocklist.vpn ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.blocklist.vpn">{{ t('invisibilitytest.blocklist.vpn.positive') }}</span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.blocklist.vpn.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2 jn-table-col">{{ t('invisibilitytest.blocklist.vpnExitNode.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="testResults.blocklist.vpnExitNode ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.blocklist.vpnExitNode">{{ t('invisibilitytest.blocklist.vpnExitNode.positive') }}</span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.blocklist.vpnExitNode.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2 jn-table-col">{{ t('invisibilitytest.tor.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="(testResults.tor_detection.proxy || testResults.tor_detection.vpn) ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.tor_detection.proxy || testResults.tor_detection.vpn">{{ t('invisibilitytest.tor.positive') }}</span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.tor.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2">{{ t('invisibilitytest.tcp.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="testResults.tcp.proxy ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.tcp.proxy">
                                                {{ t('invisibilitytest.tcp.positive') }}
                                                <br />
                                                {{ t('invisibilitytest.tcp.computer') }}
                                                <strong>{{ testResults.tcp.clientos }}</strong>.
                                                {{ t('invisibilitytest.tcp.server') }}
                                                <strong>{{ testResults.tcp.ipos }}</strong>
                                            </span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.tcp.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2">{{ t('invisibilitytest.latencyVSPing.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="testResults.latency_vs_ping.vpn ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.latency_vs_ping.vpn">
                                                {{ t('invisibilitytest.latencyVSPing.positive') }}
                                                <br />
                                                {{ t('invisibilitytest.latencyVSPing.fromTCP') }}
                                                <strong>{{ testResults.latency_vs_ping.tcpTime }}ms</strong>,
                                                {{ t('invisibilitytest.latencyVSPing.fromPing') }}
                                                <strong>{{ testResults.latency_vs_ping.pingTime }}ms</strong>
                                            </span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.latencyVSPing.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2">{{ t('invisibilitytest.latencyVSWS.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="testResults.latency_vs_ws.proxy ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.latency_vs_ws.proxy">
                                                {{ t('invisibilitytest.latencyVSWS.positive') }}
                                                <br />
                                                {{ t('invisibilitytest.latencyVSWS.fromTCP') }}
                                                <strong>{{ testResults.latency_vs_ws.tcpTime }}ms</strong>,
                                                {{ t('invisibilitytest.latencyVSWS.fromWS') }}
                                                <strong>{{ testResults.latency_vs_ws.wsTime }}ms</strong>
                                            </span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.latencyVSWS.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2">{{ t('invisibilitytest.timezone.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="(testResults.timezone.proxy || testResults.timezone.vpn) ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.timezone.proxy || testResults.timezone.vpn">
                                                {{ t('invisibilitytest.timezone.positive') }}
                                                <br />
                                                {{ t('invisibilitytest.timezone.computer') }}
                                                <strong>{{ testResults.timezone.clienttimezone }}</strong>.
                                                {{ t('invisibilitytest.timezone.server') }}
                                                <strong>{{ testResults.timezone.iptimezone }}</strong>
                                            </span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.timezone.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2">{{ t('invisibilitytest.net.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="testResults.net.proxy ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.net.proxy">{{ t('invisibilitytest.net.positive') }}</span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.net.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2">{{ t('invisibilitytest.webrtc.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="testResults.webrtc.proxy ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.webrtc.proxy">
                                                {{ t('invisibilitytest.webrtc.positive') }}
                                                <br />
                                                {{ t('invisibilitytest.webrtc.ipsAre') }}
                                                <span v-for="item in testResults.webrtc.allips" :key="item"><strong>{{ item }}</strong>, </span>
                                                <strong>{{ testResults.webrtc.ip }}</strong>
                                            </span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.webrtc.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2">{{ t('invisibilitytest.flow.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="testResults.flow.proxy ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.flow.proxy">{{ t('invisibilitytest.flow.positive') }}</span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.flow.negative') }}</span>
                                        </td>
                                    </tr>

                                    <tr class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                        <td class="p-2">{{ t('invisibilitytest.highlatency.title') }}</td>
                                        <td class="p-2">
                                            <i class="bi" :class="testResults.highlatency.proxy ? 'bi-x-circle-fill text-red-600' : 'bi-check-circle-fill text-green-600'"></i>
                                        </td>
                                        <td class="p-2">
                                            <span class="opacity-75" v-if="testResults.highlatency.proxy">{{ t('invisibilitytest.highlatency.positive') }}</span>
                                            <span class="opacity-75" v-else>{{ t('invisibilitytest.highlatency.negative') }}</span>
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
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import { Button } from '@/components/ui/button';

const { t } = useI18n();

const store = useMainStore();
const isSignedIn = computed(() => store.isSignedIn);

const checkingStatus = ref('idle');
const errorMsg = ref('');
const testResults = ref({});
const userID = ref('');
const isAgreed = ref(false);
const retryCount = ref(0);

const generate28DigitString = () => {
    const unixTime = Date.now().toString();
    const fixedString = "jason5ng32";
    const neededUnixTimeLength = 13;
    const remainingLength = 28 - fixedString.length - neededUnixTimeLength;
    const randomString = Math.random().toString(36).substring(2, 2 + remainingLength);
    return unixTime.substring(0, neededUnixTimeLength) + fixedString + randomString;
};

const loadScript = () => {
    const script = document.createElement('script');
    script.src = `https://proxydetectjs.ipcheck.ing/?pdKey=${import.meta.env.VITE_INVISIBILITY_TEST_KEY}&pdVal=${userID.value}`;
    script.async = true;
    script.setAttribute('data-tag', 'invisibilityTestScript');
    script.onload = () => { };
    script.onerror = (error) => {
        console.error('Script load error:', error);
    };
    document.head.appendChild(script);
};

const removeScript = () => {
    const scripts = document.querySelectorAll('script[data-tag="invisibilityTestScript"]');
    scripts.forEach(script => script.remove());
};

const onSubmit = () => {
    checkingStatus.value = 'running';
    userID.value = generate28DigitString();
    trackEvent('Section', 'StartClick', 'InvisibilityTest');
    errorMsg.value = '';
    testResults.value = {};
    loadScript();
    if (isSignedIn.value && !store.userAchievements.JustInCase.achieved) {
        store.setTriggerUpdateAchievements('JustInCase');
    }
    setTimeout(() => {
        getResult();
    }, 10000);
};

const getResult = async () => {
    try {
        const response = await authenticatedFetch(`/api/invisibility?id=${userID.value}`);
        const data = response;

        if ((data.message === "Data not found" || data.status === "pending") && retryCount.value < 3) {
            setTimeout(() => {
                getResult();
                retryCount.value++;
            }, 10000);
            return;
        }
        testResults.value = data;

        let proxyScore = Math.floor(testResults.value.score.proxy);
        let vpnScore = Math.floor(testResults.value.score.vpn);
        if (isSignedIn.value && !store.userAchievements.HiddenWell.achieved && proxyScore === 0 && vpnScore === 0) {
            store.setTriggerUpdateAchievements('HiddenWell');
        }
        if (isSignedIn.value && !store.userAchievements.SlipUp.achieved && (proxyScore > 50 || vpnScore > 50)) {
            store.setTriggerUpdateAchievements('SlipUp');
        }
    } catch (error) {
        console.error('Error fetching InvisibilityTest results:', error);
        if (error.message.includes('Invalid token')) {
            errorMsg.value = t('user.InvalidUserToken');
            return;
        }
        if (error.message.includes('Sign in required')) {
            errorMsg.value = t('user.SignInToUse');
            return;
        }
        if (retryCount.value < 3) {
            setTimeout(() => {
                getResult();
                retryCount.value++;
            }, 8000);
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
