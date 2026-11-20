<template>
    <!-- User account dialog: the Benefits list, plus the IPCheck.ing usage
         tab where the usage summary exists (store.usageAvailable) — without
         it there is no tab strip. Signed-in visitors land on Usage when it
         exists. Opens only when signing in adds something
         (userBenefitsView().entry). This component also loads and saves the
         account's achievements. -->
    <Dialog :open="isOpen" @update:open="isOpen = $event">
        <DialogContent :title="t(benefitsView.titleKey)" class="max-w-2xl">
            <DialogHeader :icon="HeartHandshake" :title="t(benefitsView.titleKey)" />

            <UserBenefits v-if="!benefitsView.usageTab" :groups="benefitsView.groups" :is-sponsor="isSponsor" />

            <Tabs v-else v-model="activeTab">
                <TabsList class="grid w-full grid-cols-2">
                    <TabsTrigger value="benefits" class="cursor-pointer">{{ t('user.Benefits.Benefit') }}</TabsTrigger>
                    <TabsTrigger value="usage" class="cursor-pointer">{{ t('user.Usage.Title') }}</TabsTrigger>
                </TabsList>

                <TabsContent value="benefits" class="pt-3">
                    <UserBenefits :groups="benefitsView.groups" :is-sponsor="isSponsor" />
                </TabsContent>

                <!-- Usage tab: the 24-hour limit (IP advanced data only, when the
                     backend sends it) above the monthly quota per advanced
                     feature — percentages only, the backend never sends raw
                     counts. Refetched on dialog open so the numbers are fresh. -->
                <TabsContent value="usage" class="space-y-4 pt-3">
                    <div v-if="!isSignedIn"
                        class="flex items-start gap-2 p-3 rounded-md border border-info/30 bg-info/10 text-sm text-info">
                        <Info class="size-4 mt-0.5 shrink-0" />
                        <span>{{ t('user.SignInToUse') }}</span>
                    </div>

                    <section v-else-if="usageRows.length" class="space-y-4">
                        <!-- 24-hour limit: one row; once it is used up, when the
                             next lookup becomes possible (the oldest target in the
                             window ages out — a rolling window never resets as a whole). -->
                        <section v-if="dailyRow" class="space-y-2">
                            <h4 class="text-sm font-semibold mb-0">{{ t('user.Usage.DailyTitle') }}</h4>
                            <ul class="rounded-lg border bg-card divide-y list-none mt-2">
                                <li class="p-3 space-y-1.5">
                                    <div class="flex items-baseline justify-between gap-2 text-sm">
                                        <span>{{ t('user.Usage.IpinfoFeature') }}</span>
                                        <span class="font-mono tabular-nums text-muted-foreground">
                                            {{ t('user.Usage.PercentUsed', { percent: dailyRow.percent }) }}
                                        </span>
                                    </div>
                                    <Progress :model-value="dailyRow.percent" class="h-1.5"
                                        :indicator-class="dotClass(dailyRow.tone)" />
                                    <p v-if="dailyRow.exhausted && dailyRow.availableAt" class="text-xs text-muted-foreground m-0">
                                        {{ t('user.Usage.AvailableAgainAt', { time: dailyRow.availableAt }) }}
                                    </p>
                                </li>
                            </ul>
                        </section>

                        <!-- Monthly quota: one row per advanced feature. -->
                        <section class="space-y-2">
                            <h4 class="text-sm font-semibold m-0">{{ t('user.Usage.MonthlyTitle') }}</h4>
                            <p class="text-sm text-muted-foreground leading-relaxed">{{ t('user.Usage.Note') }}</p>
                            <ul class="rounded-lg border bg-card divide-y list-none">
                                <li v-for="row in usageRows" :key="row.key" class="p-3 space-y-1.5">
                                    <div class="flex items-baseline justify-between gap-2 text-sm">
                                        <span>{{ t(row.labelKey) }}</span>
                                        <span class="font-mono tabular-nums text-muted-foreground">
                                            {{ t('user.Usage.PercentUsed', { percent: row.percent }) }}
                                        </span>
                                    </div>
                                    <Progress :model-value="row.percent" class="h-1.5"
                                        :indicator-class="dotClass(row.tone)" />
                                </li>
                            </ul>
                        </section>
                        <p class="text-xs text-muted-foreground leading-relaxed">
                            {{ t('user.Usage.SponsorNote') }}
                            <a href="https://github.com/sponsors/jason5ng32" target="_blank" rel="noopener"
                                class="underline underline-offset-2 hover:text-foreground">{{ t('user.QuotaSponsorCta')
                                }}</a>
                        </p>
                    </section>

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
import { formatClockTime } from '@/utils/time-utils.js';
import { ADVANCED_TOOLS } from '@/data/tools.js';
import { IP_DATABASES } from '@/data/ip-databases.js';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { isDocsConfigured } from '@/composables/use-docs-assistant.js';
import { isDocsAssistantAvailable } from '@/utils/docs-assistant-gate.js';
import { userBenefitsView } from '@/utils/features/user-benefits.js';
import UserBenefits from '@/components/UserBenefits.vue';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { HeartHandshake, Info } from '@lucide/vue';

const { t, locale } = useI18n();

const store = useMainStore();
const route = useRoute();
const { dotClass } = useStatusTone();

// `matched` is empty until the first navigation resolves the route.
const isOffHome = computed(() => route.matched.length > 0 && route.name !== 'home');

const isSignedIn = computed(() => store.isSignedIn);
const usageAvailable = computed(() => store.usageAvailable);
const achievementsAvailable = computed(() => store.achievementsAvailable);
const remoteUserInfo = computed(() => store.remoteUserInfo);
const remoteUserInfoFetched = computed(() => store.remoteUserInfoFetched);

const triggerUserBenefits = computed(() => store.triggerUserBenefits);
const triggerRemoteUserInfo = computed(() => store.triggerRemoteUserInfo);

const triggerUpdateAchievements = computed(() => store.triggerUpdateAchievements);
const achievementToUpdate = computed(() => store.achievementToUpdate);
const isUpdateAchievementsSuccess = ref(false);

const isOpen = ref(false);
const activeTab = ref('benefits');

// Sponsor status comes from the backend's quota snapshot.
const isSponsor = computed(() => remoteUserInfo.value?.quota?.isSponsor === true);
const benefitsView = computed(() => userBenefitsView({
    capabilities: store.capabilities,
    achievements: achievementsAvailable.value,
    accountSync: store.accountSyncAvailable,
    usage: usageAvailable.value,
    docsAssistant: isDocsAssistantAvailable(isDocsConfigured, store.capabilities),
}, { signedIn: isSignedIn.value, sponsor: isSponsor.value }));

const openUserBenefits = () => {
    store.triggerUserBenefits = false;
    if (!benefitsView.value.entry) return;
    // Signed-in visitors open straight onto their usage numbers.
    activeTab.value = isSignedIn.value && benefitsView.value.usageTab ? 'usage' : 'benefits';
    isOpen.value = true;
    if (isSignedIn.value) refreshUserInfo();
    trackEvent('Nav', 'NavClick', 'UserBenefits');
};

// Quota key → display label, from the registries' `quotaKey`. Tools reuse
// their page titles; the IP data source's advanced-data feature has no tool
// page, so it gets its own key.
const USAGE_LABEL_KEYS = Object.fromEntries([
    ...IP_DATABASES.filter((db) => db.quotaKey).map((db) => [db.quotaKey, 'user.Usage.IpinfoFeature']),
    ...ADVANCED_TOOLS.filter((tool) => tool.quotaKey).map((tool) => [tool.quotaKey, tool.titleKey]),
]);

// The metered IP data source: its quotaKey carries the 24-hour limit.
const DAILY_QUOTA_KEY = IP_DATABASES.find((db) => db.quotaKey)?.quotaKey;

// Rows for the usage dialog. Empty until the (re)fetched user info lands or
// when the backend predates the quota field — the template then shows the
// fetching placeholder instead of a broken table.
const usageTone = (percent, exhausted) => exhausted ? 'fail' : percent >= 80 ? 'ok-slow' : 'ok-fast';

const usageRows = computed(() => {
    const features = remoteUserInfo.value?.quota?.features;
    if (!features) return [];
    return Object.entries(features).map(([key, { percent, exhausted }]) => ({
        key, labelKey: USAGE_LABEL_KEYS[key] || key, percent, tone: usageTone(percent, exhausted),
    }));
});

// The IP advanced data 24-hour limit; null when the backend doesn't send it.
// `availableAt` is when the next lookup frees up, shown only while used up; a
// null or unparseable `resetsAt` formats to '', which hides that line.
const dailyRow = computed(() => {
    const daily = remoteUserInfo.value?.quota?.features?.[DAILY_QUOTA_KEY]?.daily;
    if (!daily) return null;
    const { percent, exhausted, resetsAt } = daily;
    return {
        percent,
        exhausted,
        tone: usageTone(percent, exhausted),
        availableAt: formatClockTime(resetsAt, locale.value),
    };
});

// Refetch on every open (bypassing the one-shot page-load guard) so the
// numbers reflect what the visitor just consumed in this session.
const refreshUserInfo = async () => {
    if (!isSignedIn.value || !usageAvailable.value) return;
    try {
        store.remoteUserInfo = await authenticatedFetch(`/api/getuserinfo`);
    } catch (error) {
        console.error('Error refreshing user info:', error);
    }
};

// Fetch the usage summary ({ userLevel, quota }). `remoteUserInfoFetched`
// flips only on success, so a failed round stays refetchable from the menu.
const getUserInfo = async () => {
    if (remoteUserInfoFetched.value || !isSignedIn.value || !usageAvailable.value) return;
    try {
        store.remoteUserInfo = await authenticatedFetch(`/api/getuserinfo`);
        store.remoteUserInfoFetched = true;
    } catch (error) {
        console.error('Error fetching user info:', error);
    }
};

// Apply the achievements snapshot, then release the achievement engine's
// evaluation gate before emitting, so the event already sees synced state.
const applyAchievements = ({ achievements, totalUses }) => {
    Object.entries(achievements ?? {}).forEach(([key, value]) => {
        if (store.userAchievements[key]) {
            store.userAchievements[key].achieved = value.achieved;
            store.userAchievements[key].achievedTime = value.achievedTime;
        }
    });
    store.userAchievementsSynced = true;
    // Unlock rules (IAmHuman / MakingBigNews) live in data/achievement-rules.js.
    emitAppEvent('user:info-loaded', { totalFunctionUses: totalUses ?? 0 });
};

// Fetch the achievements snapshot once; a failed round stays refetchable.
let achievementsLoading = null;
const getAchievements = async () => {
    if (store.userAchievementsSynced || achievementsLoading || !isSignedIn.value || !achievementsAvailable.value) return;
    achievementsLoading = authenticatedFetch(`/api/achievements`);
    try {
        applyAchievements(await achievementsLoading);
    } catch (error) {
        console.error('Error fetching achievements:', error);
    } finally {
        achievementsLoading = null;
    }
};

// Update local achievement status
const updateLocalAchievementStatus = (achievementName) => {
    store.userAchievements[achievementName].achieved = true;
    store.userAchievements[achievementName].achievedTime = Date.now();
};

// Unlock: shown at once, then saved; the stored time replaces the local one.
const updateUserAchievement = async (achievementName) => {
    isUpdateAchievementsSuccess.value = false;
    updateLocalAchievementStatus(achievementName);

    const message = t('user.Achievements.CongratsMessage') + t('user.Achievements.NewAchievementIs') + t('user.Achievements.Type.' + achievementName + '.Title');
    store.setAlert(true, 'text-success', message, t('user.Achievements.Congrats'), 5000);

    try {
        const saved = await authenticatedFetch(`/api/achievements`, 'PUT', { name: achievementName });
        if (Number.isFinite(saved?.achievedTime)) store.userAchievements[achievementName].achievedTime = saved.achievedTime;
        isUpdateAchievementsSuccess.value = true;
    } catch (error) {
        console.error('Error updating user achievement', error);
    }
};

// Account data loads once signed in and, on Home, after its tests
// (allHasLoaded); other pages never run them. Usage and achievements load
// independently, each once its capability is known; both self-guard.
const accountDataReady = computed(() => isSignedIn.value && (store.allHasLoaded || isOffHome.value));
watch(() => accountDataReady.value && usageAvailable.value, (ready) => {
    if (ready) getUserInfo();
}, { immediate: true });
watch(() => accountDataReady.value && achievementsAvailable.value, (ready) => {
    if (ready) getAchievements();
}, { immediate: true });

watch(() => triggerUserBenefits.value, (newVal) => {
    if (newVal) openUserBenefits();
});

// A page change closes the dialog.
watch(() => route.path, () => {
    isOpen.value = false;
});

// One-shot trigger: cleared here so the next request from UserMenu / Achievements
// is a fresh false → true edge rather than a no-op write.
watch(() => triggerRemoteUserInfo.value, (newVal) => {
    if (!newVal) return;
    store.triggerRemoteUserInfo = false;
    getUserInfo();
    getAchievements();
});

watch(() => triggerUpdateAchievements.value, (newVal) => {
    if (newVal) {
        updateUserAchievement(achievementToUpdate.value);
        store.triggerUpdateAchievements = false;
    }
});
</script>
