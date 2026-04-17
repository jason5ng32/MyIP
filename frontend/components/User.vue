<template>
    <!-- User Benefits Dialog -->
    <Dialog :open="isOpen" @update:open="isOpen = $event">
        <DialogContent :title="t('user.Benefits.Title')" class="max-w-2xl">
            <DialogHeader :icon="HeartHandshake" :title="t('user.Benefits.Title')" />

            <div class="space-y-4">
                <p class="text-sm text-muted-foreground leading-relaxed">{{ t('user.Benefits.Note1') }}</p>
                <p class="text-sm text-muted-foreground leading-relaxed">{{ t('user.Benefits.Note2') }}</p>

                <!-- Benefits 列表：数字徽章 + Check 图标 + 文本；比原版 <table> 更现代 -->
                <ul class="rounded-lg border bg-card divide-y">
                    <li v-for="n in 4" :key="n" class="flex items-start gap-3 p-3 text-sm">
                        <span
                            class="shrink-0 inline-flex items-center justify-center size-5 rounded-full bg-success/15 text-success mt-0.5">
                            <CircleCheck class="size-3.5" />
                        </span>
                        <span class="leading-relaxed">{{ t('user.Benefits.Benefit' + n) }}</span>
                    </li>
                </ul>

                <p class="text-xs text-muted-foreground leading-relaxed">{{ t('user.Benefits.FootNote') }}</p>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
// refactor/02：User Benefits 弹窗用 DialogHeader primitive
// - 表格 → 列表（4 条好处，table 太重，list + 数字/Check 徽章更友好）
// - opacity-75 硬编码 → text-muted-foreground 语义
import { ref, computed, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { CircleCheck, HeartHandshake } from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();

const isSignedIn = computed(() => store.isSignedIn);
const remoteUserInfo = computed(() => store.remoteUserInfo);
const remoteUserInfoFetched = computed(() => store.remoteUserInfoFetched);

const triggerUserBenefits = computed(() => store.triggerUserBenefits);
const triggerRemoteUserInfo = computed(() => store.triggerRemoteUserInfo);

const triggerUpdateAchievements = computed(() => store.triggerUpdateAchievements);
const achievementToUpdate = computed(() => store.achievementToUpdate);
const isUpdateAchievementsSuccess = ref(false);

const isOpen = ref(false);

const openUserBenefits = () => {
    isOpen.value = true;
    store.triggerUserBenefits = false;
    trackEvent('Nav', 'NavClick', 'UserBenefits');
};

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

const initUserAchievements = () => {
    if (!remoteUserInfo.value) return;

    const { achievements, functionUses } = remoteUserInfo.value;
    Object.entries(achievements).forEach(([key, value]) => {
        if (store.userAchievements[key]) {
            store.userAchievements[key].achieved = value.achieved;
            store.userAchievements[key].achievedTime = value.achievedTime;
        }
    });

    if (isSignedIn.value) {
        if (!store.userAchievements.IAmHuman.achieved) {
            store.setTriggerUpdateAchievements('IAmHuman');
        }
        if (!store.userAchievements.MakingBigNews.achieved && functionUses.total > 1000) {
            store.setTriggerUpdateAchievements('MakingBigNews');
        }
    }
};

const updateLocalAchievementStatus = (achievementName) => {
    store.userAchievements[achievementName].achieved = true;
    store.userAchievements[achievementName].achievedTime = Date.now();
};

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
