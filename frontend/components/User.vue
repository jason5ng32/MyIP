<template>
    <!-- User account dialog: Benefits + Usage merged behind Tabs. Signed-in
         visitors land on the Usage tab (their own numbers are what they came
         for); signed-out visitors land on Benefits. -->
    <Dialog :open="isOpen" @update:open="isOpen = $event">
        <DialogContent :title="t('user.Benefits.Title')" class="max-w-2xl">
            <DialogHeader :icon="HeartHandshake" :title="t('user.Benefits.Title')" />

            <Tabs v-model="activeTab">
                <TabsList class="grid w-full grid-cols-2">
                    <TabsTrigger value="benefits" class="cursor-pointer">{{ t('user.Benefits.Benefit') }}</TabsTrigger>
                    <TabsTrigger value="usage" class="cursor-pointer">{{ t('user.Usage.Title') }}</TabsTrigger>
                </TabsList>

                <!-- Benefits tab: one card per tier, stacked single-column on
                     every viewport. Each tier's first item is "everything in
                     the previous tier" so the lists stay short; the sponsor
                     CTA is a button under its card, not a feature row. -->
                <TabsContent value="benefits" class="space-y-3 pt-3">
                    <p class="text-sm text-muted-foreground leading-relaxed">
                        {{ t('user.Benefits.Note1') }} {{ t('user.Benefits.Note2') }}
                    </p>

                    <section v-for="tier in benefitTiers" :key="tier.key"
                        class="flex flex-col rounded-lg border bg-card p-3"
                        :class="tier.current && 'border-success/60'">
                        <header class="flex items-center gap-1.5 mb-2">
                            <component :is="tier.icon" class="size-4 text-muted-foreground shrink-0" />
                            <h4 class="text-sm font-semibold m-0 truncate">
                                {{ t(`user.Benefits.Tiers.${tier.key}.Name`) }}
                            </h4>
                            <Badge v-if="tier.current" variant="success"
                                class="ml-auto text-[10px] px-1.5 py-0 h-4 shrink-0">
                                {{ t('user.Benefits.Current') }}
                            </Badge>
                        </header>
                        <ul class="space-y-1.5 list-none p-0 m-0">
                            <li v-for="n in tier.count" :key="n"
                                class="flex items-start gap-1.5 text-xs leading-relaxed">
                                <!-- Item1 of the higher tiers = "everything in the
                                     previous tier" — rendered muted with a plus so
                                     real additions stand out. -->
                                <component :is="tier.key !== 'Visitor' && n === 1 ? Plus : Check"
                                    class="size-3.5 shrink-0 mt-0.5"
                                    :class="tier.key !== 'Visitor' && n === 1 ? 'text-muted-foreground' : 'text-success'" />
                                <span :class="tier.key !== 'Visitor' && n === 1 ? 'text-muted-foreground' : ''">
                                    {{ t(`user.Benefits.Tiers.${tier.key}.Item${n}`) }}
                                </span>
                            </li>
                        </ul>
                        <Button v-if="tier.key === 'Sponsor' && !isSponsor" as-child size="sm" variant="action"
                            class="mt-3 w-full">
                            <a href="https://github.com/sponsors/jason5ng32" target="_blank" rel="noopener">
                                <Heart class="size-3.5" />
                                {{ t('user.QuotaSponsorCta') }}
                            </a>
                        </Button>
                    </section>
                </TabsContent>

                <!-- Usage tab: current-month usage vs quota per advanced feature.
                     Refetched on dialog open so the numbers are fresh. -->
                <TabsContent value="usage" class="space-y-4 pt-3">
                    <div v-if="!isSignedIn"
                        class="flex items-start gap-2 p-3 rounded-md border border-info/30 bg-info/10 text-sm text-info">
                        <Info class="size-4 mt-0.5 shrink-0" />
                        <span>{{ t('user.SignInToUse') }}</span>
                    </div>

                    <template v-else-if="usageRows.length">
                        <p class="text-sm text-muted-foreground leading-relaxed">{{ t('user.Usage.Note') }}</p>

                        <ul class="rounded-lg border bg-card divide-y list-none">
                            <li v-for="row in usageRows" :key="row.key" class="p-3 space-y-1.5">
                                <div class="flex items-baseline justify-between gap-2 text-sm">
                                    <span>{{ t(row.labelKey) }}</span>
                                    <span class="font-mono tabular-nums text-muted-foreground">
                                        {{ row.used }} / {{ row.limit }}
                                    </span>
                                </div>
                                <Progress :model-value="row.percent" class="h-1.5"
                                    :indicator-class="dotClass(row.tone)" />
                            </li>
                        </ul>
                        <p class="text-xs text-muted-foreground leading-relaxed">
                            {{ t('user.Usage.SponsorNote') }}
                            <a href="https://github.com/sponsors/jason5ng32" target="_blank" rel="noopener"
                                class="underline underline-offset-2 hover:text-foreground">{{ t('user.QuotaSponsorCta')
                                }}</a>
                        </p>
                    </template>

                    <div v-else class="text-sm text-muted-foreground flex items-center justify-center gap-2 py-10">
                        <Spinner /> {{ t('user.Fields.Fetching') }}
                    </div>
                </TabsContent>
            </Tabs>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent } from '@/utils/app-events.js';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Check, Heart, HeartHandshake, Info, Plus, UserRound, UserRoundCheck } from '@lucide/vue';

const { t } = useI18n();

const store = useMainStore();
const route = useRoute();
const { dotClass } = useStatusTone();

// Mounted on a /tools/:slug standalone page (vs the homepage) — these pages
// skip the homepage loading pipeline, which changes when user info can load.
const isStandalonePage = computed(() => route.path.startsWith('/tools/'));

const isSignedIn = computed(() => store.isSignedIn);
const remoteUserInfo = computed(() => store.remoteUserInfo);
const remoteUserInfoFetched = computed(() => store.remoteUserInfoFetched);

const triggerUserBenefits = computed(() => store.triggerUserBenefits);
const triggerRemoteUserInfo = computed(() => store.triggerRemoteUserInfo);

const triggerUpdateAchievements = computed(() => store.triggerUpdateAchievements);
const achievementToUpdate = computed(() => store.achievementToUpdate);
const isUpdateAchievementsSuccess = ref(false);

const isOpen = ref(false);
const activeTab = ref('benefits');

// Three user tiers shown on the Benefits tab. `count` = number of ItemN keys
// in the locale pack; `current` badges the visitor's own tier (sponsor is
// detected from the quota multiplier the backend reports).
const isSponsor = computed(() => (remoteUserInfo.value?.quota?.multiplier ?? 1) > 1);
const benefitTiers = computed(() => [
    { key: 'Visitor', icon: UserRound, count: 6, current: !isSignedIn.value },
    { key: 'SignedIn', icon: UserRoundCheck, count: 7, current: isSignedIn.value && !isSponsor.value },
    { key: 'Sponsor', icon: HeartHandshake, count: 3, current: isSignedIn.value && isSponsor.value },
]);

const openUserBenefits = () => {
    // Signed-in visitors open straight onto their usage numbers.
    activeTab.value = isSignedIn.value ? 'usage' : 'benefits';
    isOpen.value = true;
    store.triggerUserBenefits = false;
    if (isSignedIn.value) refreshUserInfo();
    trackEvent('Nav', 'NavClick', 'UserBenefits');
};

// Feature key → display label. Tool features reuse their page titles; the
// ipinfo advanced-data feature has no tool page, so it gets its own key.
const USAGE_LABEL_KEYS = {
    ipinfo: 'user.Usage.IpinfoFeature',
    invisibility_test: 'invisibilitytest.Title',
    dns_leak_test: 'enhanceddnsleaktest.Title',
    persona_check: 'personacheck.Title',
};

// Rows for the usage dialog. Empty until the (re)fetched user info lands or
// when the backend predates the quota field — the template then shows the
// fetching placeholder instead of a broken table.
const usageRows = computed(() => {
    const features = remoteUserInfo.value?.quota?.features;
    if (!features) return [];
    return Object.entries(features).map(([key, { used, limit }]) => {
        const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
        const tone = percent >= 100 ? 'fail' : percent >= 80 ? 'ok-slow' : 'ok-fast';
        return { key, labelKey: USAGE_LABEL_KEYS[key] || key, used, limit, percent, tone };
    });
});

// Refetch on every open (bypassing the one-shot page-load guard) so the
// numbers reflect what the visitor just consumed in this session.
const refreshUserInfo = async () => {
    if (!isSignedIn.value) return;
    try {
        store.remoteUserInfo = await authenticatedFetch(`/api/getuserinfo`);
    } catch (error) {
        console.error('Error refreshing user info:', error);
    }
};

// Fetch user info
const getUserInfo = async () => {
    if (remoteUserInfoFetched.value || !isSignedIn.value) return;
    try {
        const response = await authenticatedFetch(`/api/getuserinfo`);
        const data = response;
        store.remoteUserInfo = data;
        initUserAchievements();
    } catch (error) {
        console.error('Error fetching user info:', error);
    }
    store.remoteUserInfoFetched = true;
};

// Initialize user achievements
const initUserAchievements = () => {
    if (!remoteUserInfo.value) return;

    // A brand-new account may come back with no achievements payload yet.
    const { achievements, functionUses } = remoteUserInfo.value;
    Object.entries(achievements ?? {}).forEach(([key, value]) => {
        if (store.userAchievements[key]) {
            store.userAchievements[key].achieved = value.achieved;
            store.userAchievements[key].achievedTime = value.achievedTime;
        }
    });

    // Snapshot applied — release the achievement engine's evaluation gate
    // before emitting anything, so the event below already sees synced state.
    store.userAchievementsSynced = true;

    // Unlock rules (IAmHuman / MakingBigNews) live in data/achievement-rules.js.
    emitAppEvent('user:info-loaded', { totalFunctionUses: functionUses?.total ?? 0 });
};

// Update local achievement status
const updateLocalAchievementStatus = (achievementName) => {
    store.userAchievements[achievementName].achieved = true;
    store.userAchievements[achievementName].achievedTime = Date.now();
};

// Update user achievement
const updateUserAchievement = async (achievementName) => {
    isUpdateAchievementsSuccess.value = false;
    updateLocalAchievementStatus(achievementName);

    const message = t('user.Achievements.CongratsMessage') + t('user.Achievements.NewAchievementIs') + t('user.Achievements.Type.' + achievementName + '.Title');
    store.setAlert(true, 'text-success', message, t('user.Achievements.Congrats'), 5000);

    try {
        await authenticatedFetch(`/api/updateuserachievement`, 'PUT', { achievement: achievementName });
        isUpdateAchievementsSuccess.value = true;
    } catch (error) {
        console.error('Error updating user achievement', error);
    }
};

watch(() => store.allHasLoaded, (newVal) => {
    if (newVal) getUserInfo();
});

// The unknown-auth-hint boot resolves sign-in AFTER allHasLoaded (background
// probe in main.js), so the watcher above already ran and skipped; retry when
// the signed-in state lands. getUserInfo self-guards against double fetches.
// Standalone tool pages never run the homepage loading pipeline (allHasLoaded
// stays false there), so sign-in alone is enough to fetch; immediate covers
// auth having resolved before this component mounted.
watch(isSignedIn, (signed) => {
    if (signed && (store.allHasLoaded || isStandalonePage.value)) getUserInfo();
}, { immediate: true });

watch(() => triggerUserBenefits.value, (newVal) => {
    if (newVal) openUserBenefits();
});

watch(() => triggerRemoteUserInfo.value, (newVal) => {
    if (newVal) getUserInfo();
});

watch(() => triggerUpdateAchievements.value, (newVal) => {
    if (newVal) {
        updateUserAchievement(achievementToUpdate.value);
        store.triggerUpdateAchievements = false;
    }
});
</script>
