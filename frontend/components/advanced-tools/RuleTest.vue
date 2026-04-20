<template>
    <div class="rule-test-section my-4 space-y-4">
        <!-- Top note -->
        <p class="text-sm text-muted-foreground">{{ t('ruletest.Note') }}</p>

        <!-- Card grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card v-for="test in ruleTests" :key="test.id"
                class="keyboard-shortcut-card jn-card transition-transform duration-300 ease-out hover:-translate-y-1.5">
                <CardContent class="p-4">
                    <!-- Top: icon + name + #id -->
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <div class="flex items-center gap-2 min-w-0">
                            <Waypoints class="size-6 text-muted-foreground shrink-0" />
                            <span class="text-base font-medium truncate">{{ test.name }}</span>
                            <span class="font-mono text-muted-foreground">#{{ test.id }}</span>
                        </div>

                    </div>

                    <!-- URL (secondary information) -->
                    <p class="text-xs font-mono text-muted-foreground mb-3 break-all" :title="test.url">
                        {{ test.url }}
                    </p>

                    <!-- IP row: status light + IP -->
                    <div class="flex items-center gap-1.5 text-base mb-3 min-w-0 min-h-6">
                        <span class="relative flex shrink-0">
                            <span v-if="toneOf(test) === 'wait'"
                                class="absolute inline-flex size-2 rounded-full bg-info opacity-75 animate-ping"></span>
                            <span class="relative inline-flex size-2 rounded-full"
                                :class="dotClass(toneOf(test))"></span>
                        </span>
                        <FitText :text="test.ip" :tiers="INLINE_TIERS" :title="test.ip"
                            class="font-mono min-w-0"
                            :class="textClass(toneOf(test))" />
                    </div>

                    <!-- Country sub-block -->
                    <dl class="rounded-md bg-muted/50 p-3 text-sm">
                        <div>
                            <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                <MapPin class="size-3.5" />
                                <span>{{ t('ruletest.Country') }}</span>
                            </dt>
                            <dd class="font-medium flex items-center gap-1.5 flex-wrap">
                                <template v-if="!isFieldPending(test.country)">
                                    <Icon v-if="test.country_code"
                                        :icon="'circle-flags:' + test.country_code.toLowerCase()"
                                        class="shrink-0 size-4" />
                                    <span class="wrap-break-word">{{ test.country }}</span>
                                </template>
                                <span v-else class="text-muted-foreground font-normal">—</span>
                            </dd>
                        </div>
                    </dl>
                </CardContent>
            </Card>
        </div>

        <!-- Bottom RefreshAll button (action color + Spinner standard) -->
        <div class="flex justify-center pt-2">
            <Button variant="action" :disabled="!finishAll" class="cursor-pointer"
                :class="[isMobile ? 'w-full' : 'w-64']" @click="checkAllRuleTest(true)">
                <Spinner v-if="!finishAll" />
                <RotateCw v-else />
                {{ t('ruletest.RefreshAll') }}
            </Button>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import getCountryName from '@/data/country-name.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { Icon } from '@iconify/vue';
import { MapPin, RotateCw, Waypoints, SignpostBig } from 'lucide-vue-next';
import FitText from '@/components/widgets/FitText.vue';
import { INLINE_TIERS } from '@/composables/use-fit-text.js';

const { t } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);
const isSignedIn = computed(() => store.isSignedIn);
const { dotClass, textClass } = useStatusTone();

const createDefaultCard = () => ({
    name: t('ruletest.Name'),
    ip: t('ruletest.StatusWait'),
    country_code: '',
    country: t('ruletest.StatusWait'),
});

const ruleTests = ref(Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    url: `ptest-${index + 1}.ipcheck.ing`,
    ...createDefaultCard(),
})));

const IPArray = ref([]);
const testCount = ref(ruleTests.value.length);
const finishAll = ref(false);

// Business status → 4 tone levels
const toneOf = (test) => {
    if (test.ip === t('ruletest.StatusWait')) return 'wait';
    if (test.ip === t('ruletest.StatusError')) return 'fail';
    if (test.ip.includes('.') || test.ip.includes(':')) return 'ok-fast';
    return 'wait';
};

const isFieldPending = (value) => {
    return !value || value === t('ruletest.StatusWait') || value === t('ruletest.StatusError');
};


const fetchTrace = async (id, url) => {
    try {
        const response = await fetch(`https://${url}/cdn-cgi/trace`);
        const data = await response.text();
        const lines = data.split('\n');
        const ipLine = lines.find((line) => line.startsWith('ip='));
        const countryLine = lines.find((line) => line.startsWith('loc='));
        if (ipLine) {
            const ip = ipLine.split('=')[1];
            ruleTests.value[id].ip = ip;
            IPArray.value = [...IPArray.value, ip];
        }
        if (countryLine) {
            const country = countryLine.split('=')[1];
            ruleTests.value[id].country_code = country;
            ruleTests.value[id].country = getCountryName(country, lang.value);
        }
    } catch (error) {
        ruleTests.value[id].ip = t('ruletest.StatusError');
        ruleTests.value[id].country_code = '';
        ruleTests.value[id].country = t('ruletest.StatusError');
        console.error('Error fetching Data:', error);
    }
};

const checkAllRuleTest = async (refresh = false) => {
    finishAll.value = false;
    if (refresh) {
        ruleTests.value.forEach((test) => {
            test.ip = t('ruletest.StatusWait');
            test.country = t('ruletest.StatusWait');
            test.country_code = '';
        });
    }

    const processTest = async (index) => {
        if (index < testCount.value) {
            try {
                await fetchTrace(index, ruleTests.value[index].url);
            } catch (error) {
                console.error('Error fetching Data:', error);
            } finally {
                processTest(index + 1);
                if (index === testCount.value - 1) {
                    finishAll.value = true;
                    if (isSignedIn.value) checkAchievements();
                }
            }
        }
    };

    processTest(0);
};

const checkAchievements = () => {
    const allIPs = ruleTests.value.map((test) => test.ip);
    const uniqueIPs = [...new Set(allIPs)];
    if (uniqueIPs.length === 8 && !store.userAchievements.CrossingTheWall.achieved) {
        store.setTriggerUpdateAchievements('CrossingTheWall');
    }
};

onMounted(() => {
    setTimeout(() => { checkAllRuleTest(); }, 1000);
});

watch(IPArray, () => {
    store.updateAllIPs(IPArray.value);
}, { deep: true });
</script>
