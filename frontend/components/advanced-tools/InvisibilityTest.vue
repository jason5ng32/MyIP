<template>
    <div class="invisibilitytest-section my-4 space-y-4">
        <!-- Top note -->
        <div class="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
            <p>{{ t('invisibilitytest.Note') }}</p>
            <p>{{ t('invisibilitytest.Note2') }}</p>
        </div>

        <!-- Input area: Agree to check + Run -->
        <div class="space-y-2">
            <div class="flex items-stretch gap-0">
                <!-- Checkbox (flat container and Button combined) -->
                <label for="collectingDatas"
                    class="flex items-center gap-2 px-3 border border-input border-r-0 bg-background rounded-l-md text-sm cursor-pointer select-none"
                    :class="{ 'opacity-50 cursor-not-allowed': !store.user }">
                    <input type="checkbox" id="collectingDatas" name="collectingDatas"
                        class="size-4 cursor-pointer accent-action" aria-label="Checkbox for Collecting datas"
                        v-model="isAgreed" :disabled="!store.user" />
                    <span>{{ t('invisibilitytest.agreement') }}</span>
                </label>
                <Button variant="action" class="rounded-l-none cursor-pointer"
                    :disabled="checkingStatus === 'running' || !isAgreed || !store.user" @click="onSubmit">
                    <Spinner v-if="checkingStatus === 'running'" />
                    <template v-else>
                        <Play class="size-4 shrink-0" />
                    </template>
                </Button>
            </div>

            <!-- Login Hint -->
            <div v-if="!store.user"
                class="flex items-start gap-2 p-3 rounded-md border border-info/30 bg-info/10 text-sm text-info">
                <Info class="size-4 mt-0.5 shrink-0" />
                <span>{{ t('user.SignInToUse') }}</span>
            </div>

            <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>

            <!-- Monthly quota exhausted: not an error — explain + sponsor path. -->
            <div v-if="quotaExceeded"
                class="flex items-start gap-2 p-3 rounded-md border border-warning/30 bg-warning/10 text-sm text-warning">
                <Hourglass class="size-4 mt-0.5 shrink-0" />
                <span>
                    {{ t('user.QuotaExceeded') }}
                    <button type="button" class="underline underline-offset-2 cursor-pointer"
                        @click="openUsageDialog">{{ t('user.ViewUsage') }}</button>
                </span>
            </div>
        </div>

        <!-- Result: Summary card + Detailed list -->
        <template v-if="Object.keys(testResults).length > 0 && store.user">
            <!-- Summary Card: IP + two scores + judgment -->
            <Transition name="fade-slide">
                <Card>
                    <CardContent class="p-4 md:p-6 space-y-4">
                        <!-- IP Display -->
                        <div>
                            <div class="text-xs text-muted-foreground mb-1">{{ t('invisibilitytest.yourIP') }}</div>
                            <div class="font-mono font-semibold text-lg wrap-break-word">{{ testResults.ip }}</div>
                        </div>

                        <!-- Two scores -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div class="flex items-center gap-2">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <Lock class="size-4 text-muted-foreground shrink-0" />
                                        <div class="text-xs text-muted-foreground">{{ t('invisibilitytest.proxyScore')
                                            }}</div>
                                    </div>
                                    <div class="text-2xl font-semibold tabular-nums"
                                        :class="scoreToneClass(testResults.score.proxy)">
                                        {{ testResults.score.proxy }}%
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <Shield class="size-4 text-muted-foreground shrink-0" />
                                        <div class="text-xs text-muted-foreground">{{ t('invisibilitytest.VPNScore') }}
                                        </div>
                                    </div>
                                    <div class="text-2xl font-semibold tabular-nums"
                                        :class="scoreToneClass(testResults.score.vpn)">
                                        {{ testResults.score.vpn }}%
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Judgment -->
                        <div class="text-sm">
                            <span
                                :class="testResults.score.proxy >= 50 ? 'text-destructive font-semibold' : 'text-muted-foreground'">
                                {{ testResults.score.proxy >= 50 ? t('invisibilitytest.isProxy') :
                                t('invisibilitytest.notProxy') }}
                            </span>
                            <span class="mx-1"></span>
                            <span
                                :class="testResults.score.vpn >= 50 ? 'text-destructive font-semibold' : 'text-muted-foreground'">
                                {{ testResults.score.vpn >= 50 ? t('invisibilitytest.isVPN') :
                                t('invisibilitytest.notVPN') }}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </Transition>

            <!-- Detailed list: 14 items, divide-y list -->
            <Transition name="fade-slide">
                <Card>
                    <CardContent class="p-0">
                        <header class="flex items-center gap-2 px-4 py-3 border-b">
                            <ListChecks class="size-4 text-muted-foreground" />
                            <h3 class="text-sm font-semibold m-0">{{ t('invisibilitytest.itemName') }}</h3>
                        </header>
                        <ul class="divide-y list-none p-0 m-0">
                            <li v-for="item in detectionItems" :key="item.key"
                                class="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                                <!-- Status icon -->
                                <component :is="item.flagged ? CircleX : CircleCheck" class="size-4 mt-0.5 shrink-0"
                                    :class="item.flagged ? 'text-destructive' : 'text-success'" />
                                <!-- Item name + description -->
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-medium mb-0.5">{{ t(`invisibilitytest.${item.key}.title`)
                                        }}</div>
                                    <div class="text-xs text-muted-foreground leading-relaxed">
                                        {{ t(`invisibilitytest.${item.key}.${item.flagged ? 'positive' : 'negative'}`)
                                        }}
                                        <!-- Item extra information: render each key separately -->
                                        <template v-if="item.flagged && item.extras">
                                            <br />
                                            <template v-if="item.key === 'tcp'">
                                                {{ t('invisibilitytest.tcp.computer') }}<strong>{{ item.extras.os
                                                    }}</strong>.
                                                {{ t('invisibilitytest.tcp.server') }}<strong>{{ item.extras.serverOs
                                                    }}</strong>
                                            </template>
                                            <template v-else-if="item.key === 'timezone'">
                                                {{ t('invisibilitytest.timezone.computer') }}<strong>{{
                                                    item.extras.client }}</strong>.
                                                {{ t('invisibilitytest.timezone.server') }}<strong>{{ item.extras.server
                                                    }}</strong>
                                            </template>
                                            <template v-else-if="item.key === 'latencyVSPing'">
                                                {{ t('invisibilitytest.latencyVSPing.fromTCP') }}<strong>{{
                                                    item.extras.tcp }}ms</strong>,
                                                {{ t('invisibilitytest.latencyVSPing.fromPing') }}<strong>{{
                                                    item.extras.ping }}ms</strong>
                                            </template>
                                            <template v-else-if="item.key === 'latencyVSWS'">
                                                {{ t('invisibilitytest.latencyVSWS.fromTCP') }}<strong>{{
                                                    item.extras.tcp }}ms</strong>,
                                                {{ t('invisibilitytest.latencyVSWS.fromWS') }}<strong>{{ item.extras.ws
                                                    }}ms</strong>
                                            </template>
                                            <template v-else-if="item.key === 'webrtc'">
                                                {{ t('invisibilitytest.webrtc.ipsAre') }}
                                                <strong class="font-mono">{{ item.extras.ips.join(', ') }}</strong>
                                            </template>
                                        </template>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </Transition>
        </template>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent } from '@/utils/app-events.js';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { CircleCheck, CircleX, Hourglass, Info, ListChecks, Lock, Shield, Play } from '@lucide/vue';

const { t } = useI18n();

const store = useMainStore();
const route = useRoute();
const router = useRouter();

// Open the Benefits & Usage dialog. Inside the Advanced Tools drawer the
// dialog would stack on top of it — close the drawer first (it's driven by
// the ?tool query; standalone pages don't carry it, nothing to close).
const openUsageDialog = () => {
    if (route.query.tool) router.push({ path: '/', query: {} });
    store.setTriggerUserBenefits(true);
};

const checkingStatus = ref('idle');
const errorMsg = ref('');
const quotaExceeded = ref(false);
const testResults = ref({});
const userID = ref('');
const isAgreed = ref(false);
const retryCount = ref(0);

// Score → semantic color: <30 clean / 30-70 warning / ≥70 danger
const scoreToneClass = (score) => {
    if (score < 30) return 'text-success';
    if (score < 70) return 'text-warning';
    return 'text-destructive';
};

// 14 items detection data: label goes i18n {key}.title; positive/negative text is also
// key determined will be used by template to pull t(`invisibilitytest.${key}.title|positive|negative`) from i18n.
const detectionItems = computed(() => {
    const r = testResults.value;
    if (!r || !r.headers) return [];
    return [
        { key: 'headers', flagged: Boolean(r.headers.proxy) },
        { key: 'datacenter', flagged: Boolean(r.datacenter.is_datacenter) },
        { key: 'blocklist.proxy', flagged: Boolean(r.blocklist.proxy) },
        { key: 'blocklist.vpn', flagged: Boolean(r.blocklist.vpn) },
        { key: 'blocklist.vpnExitNode', flagged: Boolean(r.blocklist.vpnExitNode) },
        { key: 'tor', flagged: Boolean(r.tor_detection.proxy || r.tor_detection.vpn) },
        {
            key: 'tcp',
            flagged: Boolean(r.tcp.proxy),
            extras: r.tcp.proxy ? { os: r.tcp.clientos, serverOs: r.tcp.ipos } : null,
        },
        {
            key: 'latencyVSPing',
            flagged: Boolean(r.latency_vs_ping.vpn),
            extras: r.latency_vs_ping.vpn ? { tcp: r.latency_vs_ping.tcpTime, ping: r.latency_vs_ping.pingTime } : null,
        },
        {
            key: 'latencyVSWS',
            flagged: Boolean(r.latency_vs_ws.proxy),
            extras: r.latency_vs_ws.proxy ? { tcp: r.latency_vs_ws.tcpTime, ws: r.latency_vs_ws.wsTime } : null,
        },
        {
            key: 'timezone',
            flagged: Boolean(r.timezone.proxy || r.timezone.vpn),
            extras: (r.timezone.proxy || r.timezone.vpn)
                ? { client: r.timezone.clienttimezone, server: r.timezone.iptimezone }
                : null,
        },
        { key: 'net', flagged: Boolean(r.net.proxy) },
        {
            key: 'webrtc',
            flagged: Boolean(r.webrtc.proxy),
            extras: r.webrtc.proxy ? { ips: [...(r.webrtc.allips || []), r.webrtc.ip].filter(Boolean) } : null,
        },
        { key: 'flow', flagged: Boolean(r.flow.proxy) },
        { key: 'highlatency', flagged: Boolean(r.highlatency.proxy) },
    ];
});

const generate28DigitString = () => {
    const unixTime = Date.now().toString();
    const fixedString = 'jason5ng32';
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
    // No script means no probe data server-side — polling for a result is
    // pointless, so abort the run and tell the user right away.
    script.onerror = () => {
        console.error('Script load error: proxy detect script failed to load');
        clearTimeout(resultTimer);
        removeScript();
        errorMsg.value = t('invisibilitytest.scriptLoadError');
        checkingStatus.value = 'idle';
        retryCount.value = 0;
    };
    document.head.appendChild(script);
};

const removeScript = () => {
    const scripts = document.querySelectorAll('script[data-tag="invisibilityTestScript"]');
    scripts.forEach(script => script.remove());
};

let resultTimer = null;

const onSubmit = () => {
    // Frontend first line: the store's quota snapshot already knows the month
    // is exhausted — skip the whole probe run (script load + 10s poll). The
    // backend independently enforces the same limit (429) as the real guard.
    if (store.quotaExceeded.invisibility_test) {
        quotaExceeded.value = true;
        return;
    }
    checkingStatus.value = 'running';
    userID.value = generate28DigitString();
    trackEvent('Section', 'StartClick', 'InvisibilityTest');
    errorMsg.value = '';
    quotaExceeded.value = false;
    testResults.value = {};
    loadScript();
    // Achievement rule (JustInCase) lives in data/achievement-rules.js.
    emitAppEvent('invisibility:started');
    resultTimer = setTimeout(() => { getResult(); }, 10000);
};

const getResult = async () => {
    try {
        const response = await authenticatedFetch(`/api/invisibility?id=${userID.value}`);
        const data = response;

        const isPending = data.message === 'Data not found' || data.status === 'pending';
        if (isPending && retryCount.value < 3) {
            setTimeout(() => {
                getResult();
                retryCount.value++;
            }, 10000);
            return;
        }

        // Still pending after every retry, or a body without scores: surface
        // the fetch error instead of rendering (and crashing on) a non-result.
        if (isPending || !data.score) {
            errorMsg.value = t('invisibilitytest.fetchError');
        } else {
            testResults.value = data;
            // Achievement rules (HiddenWell / SlipUp) live in data/achievement-rules.js;
            // the report collector consumes ip + the 14 detection flags.
            emitAppEvent('invisibility:result', {
                proxyScore: Math.floor(data.score.proxy),
                vpnScore: Math.floor(data.score.vpn),
                ip: data.ip,
                flags: detectionItems.value.map(({ key, flagged }) => ({ key, flagged })),
            });
        }
    } catch (error) {
        console.error('Error fetching InvisibilityTest results:', error);
        // 429 passed through by the backend: monthly quota exhausted —
        // retrying can't fix it, show the quota hint (with the sponsor path).
        if (error.message.includes('quota_exceeded')) {
            quotaExceeded.value = true;
            store.markQuotaExhausted('invisibility_test');
            checkingStatus.value = 'idle';
            retryCount.value = 0;
            return;
        }
        // 401/403 passed through by the backend: the visitor's sign-in state
        // is the problem — retrying can't fix it, so reset and bail.
        if (/Status: 40[13] /.test(error.message)) {
            errorMsg.value = error.message.includes('Invalid token')
                ? t('user.InvalidUserToken')
                : t('user.SignInToUse');
            checkingStatus.value = 'idle';
            retryCount.value = 0;
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
.fade-slide-enter-active {
    transition: all 0.4s ease-out;
}

.fade-slide-leave-active {
    transition: all 0.25s ease-out;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
    transform: translateY(16px);
    opacity: 0;
}

/* Make the selected color of the native checkbox consistent with the action theme color */
input[type='checkbox'].accent-action {
    accent-color: var(--action);
}
</style>
