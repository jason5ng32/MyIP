<template>
    <div class="invisibilitytest-section my-4 space-y-4">
        <!-- 顶部说明 -->
        <div class="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
            <p>{{ t('invisibilitytest.Note') }}</p>
            <p>{{ t('invisibilitytest.Note2') }}</p>
        </div>

        <!-- 输入区：同意勾选 + Run -->
        <div class="space-y-2">
            <div class="flex items-stretch gap-0">
                <!-- 勾选框（扁平容器跟 Button 拼成一体） -->
                <label for="collectingDatas"
                    class="flex items-center gap-2 px-3 border border-input border-r-0 bg-background rounded-l-md text-sm cursor-pointer select-none"
                    :class="{ 'opacity-50 cursor-not-allowed': !store.user }">
                    <input type="checkbox" id="collectingDatas" name="collectingDatas"
                        class="size-4 cursor-pointer accent-action" aria-label="Checkbox for Collecting datas"
                        v-model="isAgreed" :disabled="!store.user" />
                    <span>{{ t('invisibilitytest.agreement') }}</span>
                </label>
                <Button variant="action" class="rounded-l-none"
                    :disabled="checkingStatus === 'running' || !isAgreed || !store.user" @click="onSubmit">
                    <Spinner v-if="checkingStatus === 'running'" />
                    {{ t('invisibilitytest.Run') }}
                </Button>
            </div>

            <!-- 登录提示（未登录时） -->
            <div v-if="!store.user"
                class="flex items-start gap-2 p-3 rounded-md border border-info/30 bg-info/10 text-sm text-info">
                <Info class="size-4 mt-0.5 shrink-0" />
                <span>{{ t('user.SignInToUse') }}</span>
            </div>

            <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>
        </div>

        <!-- 结果：总结卡 + 明细列表 -->
        <template v-if="Object.keys(testResults).length > 0 && store.user">
            <!-- 总结 Card：IP + 两个分数 + 判定 -->
            <Transition name="fade-slide">
                <Card>
                    <CardContent class="p-4 md:p-6 space-y-4">
                        <!-- IP 显示 -->
                        <div>
                            <div class="text-xs text-muted-foreground mb-1">{{ t('invisibilitytest.yourIP') }}</div>
                            <div class="font-mono font-semibold text-lg wrap-break-word">{{ testResults.ip }}</div>
                        </div>

                        <!-- 两个分数 -->
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

                        <!-- 判定 -->
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

            <!-- 明细列表：14 项检测，divide-y 列表 -->
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
                                <!-- 状态图标 -->
                                <component :is="item.flagged ? CircleX : CircleCheck" class="size-4 mt-0.5 shrink-0"
                                    :class="item.flagged ? 'text-destructive' : 'text-success'" />
                                <!-- 条目名 + 描述 -->
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-medium mb-0.5">{{ t(`invisibilitytest.${item.key}.title`)
                                        }}</div>
                                    <div class="text-xs text-muted-foreground leading-relaxed">
                                        {{ t(`invisibilitytest.${item.key}.${item.flagged ? 'positive' : 'negative'}`)
                                        }}
                                        <!-- 条目额外信息：根据 key 各自渲染 -->
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
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { CircleCheck, CircleX, Info, ListChecks, Lock, Shield } from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();
const isSignedIn = computed(() => store.isSignedIn);

const checkingStatus = ref('idle');
const errorMsg = ref('');
const testResults = ref({});
const userID = ref('');
const isAgreed = ref(false);
const retryCount = ref(0);

// 分数 → 语义色：<30 clean / 30-70 warning / ≥70 danger
const scoreToneClass = (score) => {
    if (score < 30) return 'text-success';
    if (score < 70) return 'text-warning';
    return 'text-destructive';
};

// 14 项检测数据化：label 走 i18n {key}.title；positive/negative 文字也是
// key 确定后会被模板用来拉 t(`invisibilitytest.${key}.title|positive|negative`)
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
    script.onerror = (error) => { console.error('Script load error:', error); };
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
    setTimeout(() => { getResult(); }, 10000);
};

const getResult = async () => {
    try {
        const response = await authenticatedFetch(`/api/invisibility?id=${userID.value}`);
        const data = response;

        if ((data.message === 'Data not found' || data.status === 'pending') && retryCount.value < 3) {
            setTimeout(() => {
                getResult();
                retryCount.value++;
            }, 10000);
            return;
        }
        testResults.value = data;

        const proxyScore = Math.floor(testResults.value.score.proxy);
        const vpnScore = Math.floor(testResults.value.score.vpn);
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

/* 让 native checkbox 的选中色跟 action 主题色一致 */
input[type='checkbox'].accent-action {
    accent-color: var(--action);
}
</style>
