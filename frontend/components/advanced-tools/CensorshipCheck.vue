<template>
    <div class="censorship-check-section my-4 space-y-4">
        <!-- Top note -->
        <p class="text-sm text-muted-foreground leading-relaxed">{{ t('censorshipcheck.Note') }}</p>

        <!-- Input area -->
        <div class="space-y-2">
                <Label for="queryURL">{{ t('censorshipcheck.Note2') }}</Label>
            <div class="flex items-center gap-2">
                <Input type="text" id="queryURL" name="queryURL" data-1p-ignore data-lpignore="true"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    :disabled="censorshipCheckStatus === 'running'"
                    :placeholder="t('censorshipcheck.Placeholder')"
                    v-model="queryURL" @keyup.enter="onSubmit" :aria-invalid="errorMsg !== ''" />
                <Button variant="action"
                    :disabled="censorshipCheckStatus === 'running' || !queryURL"
                    @click="onSubmit">
                    <Spinner v-if="censorshipCheckStatus === 'running'" />
                    <template v-else>
                        <Play class="size-4 shrink-0" />
                    </template>
                </Button>
            </div>
            <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>
        </div>

        <!-- Result tables -->
        <div v-if="censorshipResults.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Test Group (high-risk countries) -->
            <Card>
                <CardContent class="p-0">
                    <header class="flex items-center gap-2 px-4 py-3 border-b">
                        <ShieldAlert class="size-4 text-warning" />
                        <h3 class="text-sm font-semibold m-0">{{ t('censorshipcheck.TestGroup') }}</h3>
                    </header>
                    <CensorshipTable :rows="testGroupResults" />
                </CardContent>
            </Card>

            <!-- Control Group (control countries) -->
            <Card>
                <CardContent class="p-0">
                    <header class="flex items-center gap-2 px-4 py-3 border-b">
                        <Shield class="size-4 text-success" />
                        <h3 class="text-sm font-semibold m-0">{{ t('censorshipcheck.ControlGroup') }}</h3>
                    </header>
                    <CensorshipTable :rows="controlGroupResults" />
                </CardContent>
            </Card>
        </div>

        <!-- Bottom conclusion banner (3 states: isBlocked / isDown / notBlocked) —— with fade-slide entrance -->
        <Transition name="fade-slide">
            <div v-if="censorshipCheckStatus === 'finished'"
                class="flex items-start gap-2 p-3 rounded-md border text-sm"
                :class="bannerClass">
                <component :is="bannerIcon" class="size-4 mt-0.5 shrink-0" />
                <div class="leading-relaxed">
                    {{ bannerText }}
                    <span class="opacity-70 italic">( {{ t('censorshipcheck.Note3') }} )</span>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, h } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { useGlobalpingMeasurement } from '@/composables/use-globalping-measurement';
import getCountryName from '@/data/country-name.js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@iconify/vue';
import { CircleCheck, CircleX, Frown, Meh, Shield, ShieldAlert, Smile, Play } from 'lucide-vue-next';
import { Label } from '@/components/ui/label';

const { t } = useI18n();

const store = useMainStore();
const lang = computed(() => store.lang);
const isSignedIn = computed(() => store.isSignedIn);

const highRiskCountries = ['CN', 'RU', 'TR', 'SA'];
const censorshipResults = ref([]);
// status: 'idle' | 'running' | 'finished' | 'error' — driven by the composable
const { status: censorshipCheckStatus, start: runMeasurement } = useGlobalpingMeasurement({
    pollInterval: 3000,
    maxRetries: 5,
});
const isBlocked = ref(false);
const isDown = ref(false);
const blockedCountries = ref([]);
const queryURL = ref('');
const errorMsg = ref('');

// Filtered group results, use computed to avoid two calls to .filter in template
const testGroupResults = computed(() =>
    censorshipResults.value.filter(r => highRiskCountries.includes(r.country))
);
const controlGroupResults = computed(() =>
    censorshipResults.value.filter(r => !highRiskCountries.includes(r.country))
);

// Conclusion banner 3 states
const bannerClass = computed(() => {
    if (isBlocked.value) return 'border-destructive/30 bg-destructive/10 text-destructive';
    if (isDown.value) return 'border-warning/30 bg-warning/10 text-warning';
    return 'border-success/30 bg-success/10 text-success';
});
const bannerIcon = computed(() => {
    if (isBlocked.value) return Frown;
    if (isDown.value) return Meh;
    return Smile;
});
const bannerText = computed(() => {
    if (isBlocked.value) return t('censorshipcheck.isBlocked');
    if (isDown.value) return t('censorshipcheck.isDown');
    return t('censorshipcheck.notBlocked');
});

// ——— Shared row rendering for double tables: use inline functional components to avoid template repetition ———
const CensorshipTable = (props) => h('div', { class: 'overflow-x-auto' },
    h('table', { class: 'w-full text-sm' }, [
        h('thead', {},
            h('tr', { class: 'border-b' },
                ['Country', 'Status', 'City', 'Network'].map(key =>
                    h('th', {
                        scope: 'col',
                        class: 'text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide',
                    }, t('censorshipcheck.' + key))
                )
            )
        ),
        h('tbody', { class: 'divide-y' },
            props.rows.map((result, idx) => h('tr', {
                key: result.country + '-' + result.city + '-' + idx,
                class: 'hover:bg-muted/50 transition-colors',
            }, [
                h('td', { class: 'px-3 py-2 whitespace-nowrap' }, h('div', { class: 'flex items-center gap-1.5' }, [
                    h(Icon, { icon: 'circle-flags:' + result.country.toLowerCase(), class: 'shrink-0 size-4' }),
                    h('span', {}, result.country_name),
                ])),
                h('td', { class: 'px-3 py-2' }, renderStatus(result.status)),
                h('td', { class: 'px-3 py-2 text-muted-foreground' }, result.city),
                h('td', { class: 'px-3 py-2 text-muted-foreground truncate max-w-[160px]', title: result.network }, result.network),
            ]))
        ),
    ])
);
CensorshipTable.props = ['rows'];

// Status icon rendering: finished → success check; failed → failure cross; in-progress → Spinner
const renderStatus = (status) => {
    if (status === 'finished') return h(CircleCheck, { class: 'size-4 text-success' });
    if (status === 'failed') return h(CircleX, { class: 'size-4 text-destructive' });
    return h(Spinner, { class: 'size-4 text-info' });
};

const validateInput = (input) => {
    if (!input.match(/^https?:\/\//)) input = 'http://' + input;
    try {
        const url = new URL(input);
        const hostname = url.hostname;
        if (hostname.match(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i)) return hostname;
    } catch { /* noop */ }
    errorMsg.value = t('censorshipcheck.invalidURL');
    return null;
};

const onSubmit = () => {
    trackEvent('Section', 'StartClick', 'CensorshipCheck');
    errorMsg.value = '';
    censorshipResults.value = [];
    censorshipCheckStatus.value = 'idle';
    isBlocked.value = false;
    isDown.value = false;
    blockedCountries.value = [];
    const hostname = validateInput(queryURL.value);
    if (hostname) startHttpCheck(hostname);
};

const startHttpCheck = (hostname) => {
    runMeasurement({
        locations: [
            { country: 'CN', limit: 2 }, { country: 'RU', limit: 2 },
            { country: 'TR', limit: 2 }, { country: 'SA', limit: 2 },
            { country: 'JP' }, { country: 'US' }, { country: 'CA' }, { country: 'IT' },
            { country: 'FI' }, { country: 'AU' }, { country: 'FR' }, { country: 'DE' },
        ],
        target: hostname,
        type: 'http',
        measurementOptions: {
            request: { host: hostname, path: '/', method: 'HEAD' },
            port: 443,
            protocol: 'HTTPS',
        },
    }, {
        onResults: (data) => {
            processHttpResults(data);
            return censorshipResults.value.length > 0;
        },
        onFinish: () => {
            correctResult();
            calResult(censorshipResults.value);
        },
        // POST error surfaces as 'invalidURL' (preserves pre-refactor copy);
        // poll failure / empty result surface as 'fetchError'.
        onError: (reason) => {
            errorMsg.value = reason === 'create'
                ? t('censorshipcheck.invalidURL')
                : t('censorshipcheck.fetchError');
        },
    });
};

const processHttpResults = (data) => {
    censorshipResults.value = data.results
        .filter(item => ['finished', 'failed', 'in-progress'].includes(item.result.status))
        .filter(item => item.result.rawOutput !== null)
        .map(item => ({
            country: item.probe.country,
            country_name: getCountryName(item.probe.country, lang.value),
            city: item.probe.city,
            network: item.probe.network,
            status: item.result.status,
            headers: item.result.rawHeaders ? 'OK' : '',
        }));
};

const correctResult = () => {
    censorshipResults.value.forEach(result => {
        if (result.status === 'in-progress') result.status = 'failed';
    });

    censorshipResults.value = [...censorshipResults.value.sort((a, b) => {
        const priorityIndexA = highRiskCountries.indexOf(a.country);
        const priorityIndexB = highRiskCountries.indexOf(b.country);
        if (priorityIndexA !== -1 && priorityIndexB !== -1) return priorityIndexA - priorityIndexB;
        if (priorityIndexA !== -1) return -1;
        if (priorityIndexB !== -1) return 1;
        return a.country.localeCompare(b.country);
    })];
};

const calResult = (testResults) => {
    blockedCountries.value = [];
    isBlocked.value = false;
    isDown.value = false;

    const isFailedResult = result => result.status === 'failed' && result.headers === '';

    const blockedHighRiskCountries = highRiskCountries.filter(country => {
        const countryResults = testResults.filter(result => result.country === country);
        return countryResults.length > 0 && countryResults.every(isFailedResult);
    });

    const otherResults = testResults.filter(result => !highRiskCountries.includes(result.country));
    const failedOtherResultsCount = otherResults.filter(isFailedResult).length;
    const failureRate = otherResults.length ? failedOtherResultsCount / otherResults.length : 0;

    if (failureRate > 0.5) {
        isDown.value = true;
    } else {
        blockedCountries.value = blockedHighRiskCountries;
        isBlocked.value = blockedHighRiskCountries.length > 0;
    }
    if (isSignedIn.value) checkAchievements();
};

const checkAchievements = () => {
    if (isBlocked.value && !store.userAchievements.ItIsOpen.achieved) {
        store.setTriggerUpdateAchievements('ItIsOpen');
    }
};
</script>

<style scoped>
.fade-slide-enter-active {
    transition: all 0.3s ease-out;
}
.fade-slide-leave-active {
    transition: all 0.2s ease-out;
}
.fade-slide-enter-from {
    transform: translateY(10px);
    opacity: 0;
}
.fade-slide-leave-to {
    opacity: 0;
}
</style>
