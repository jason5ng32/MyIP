<template>
    <!-- User Benefits Dialog -->
    <Dialog :open="isOpen" @update:open="isOpen = $event">
        <DialogContent :title="t('user.Benefits.Title')" class="max-w-2xl">
            <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-700">
                <h5 class="m-0 text-lg font-semibold" id="BenefitsTitle">
                    <i class="bi bi-person-hearts"></i> {{ t('user.Benefits.Title') }}
                </h5>
                <DialogClose />
            </div>
            <div class="pt-3 m-2">
                <p class="opacity-75">{{ t('user.Benefits.Note1') }}</p>
                <p class="opacity-75">{{ t('user.Benefits.Note2') }}</p>
                <div class="overflow-x-auto">
                    <table class="w-full border-collapse">
                        <thead>
                            <tr class="border-b border-neutral-200 dark:border-neutral-700">
                                <th scope="col" class="text-left p-2">#</th>
                                <th scope="col" class="text-left p-2">{{ t('user.Benefits.Benefit') }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="n in 4" :key="n" class="border-b border-neutral-200 dark:border-neutral-700">
                                <th scope="row" class="text-left p-2 font-semibold">{{ n }}</th>
                                <td class="p-2">{{ t('user.Benefits.Benefit' + n) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p class="opacity-75 mt-3">{{ t('user.Benefits.FootNote') }}</p>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';

const { t } = useI18n();

const store = useMainStore();

// 远程用户信息
const isSignedIn = computed(() => store.isSignedIn);
const remoteUserInfo = computed(() => store.remoteUserInfo);
const remoteUserInfoFetched = computed(() => store.remoteUserInfoFetched);

// 触发器
const triggerUserBenefits = computed(() => store.triggerUserBenefits);
const triggerRemoteUserInfo = computed(() => store.triggerRemoteUserInfo);

// 更新用户成就
const triggerUpdateAchievements = computed(() => store.triggerUpdateAchievements);
const achievementToUpdate = computed(() => store.achievementToUpdate);
const isUpdateAchievementsSuccess = ref(false);

// Dialog 开关
const isOpen = ref(false);

// 打开 Dialog
const openUserBenefits = () => {
    isOpen.value = true;
    store.triggerUserBenefits = false;
    trackEvent('Nav', 'NavClick', 'UserBenefits');
};

// 获取用户统计信息
const getUserInfo = async () => {
    if (remoteUserInfoFetched.value || !isSignedIn.value) {
        return;
    }
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

// 通过远程数据初始化本地成就数据，寻找相同的键值进行更新
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
}

// 本地更新成就
const updateLocalAchievementStatus = (achievementName) => {
    store.userAchievements[achievementName].achieved = true;
    store.userAchievements[achievementName].achievedTime = Date.now();
}

// 更新成就
const updateUserAchievement = async (achievementName) => {
    isUpdateAchievementsSuccess.value = false;
    updateLocalAchievementStatus(achievementName);
    
    // 发送通知
    const message = t('user.Achievements.CongratsMessage') + t('user.Achievements.NewAchievementIs') + t('user.Achievements.Type.' + achievementName + '.Title');
    store.setAlert(true, "text-success", message, t('user.Achievements.Congrats'), 5000);

    // 更新远程数据
    try {
        await authenticatedFetch(`/api/updateuserachievement`, 'PUT', { achievement: achievementName });
        isUpdateAchievementsSuccess.value = true;
    } catch (error) {
        console.error('Error updating user achievement', error);
    }
}

// 监听程序装载完毕后加载用户信息
watch(() => store.allHasLoaded, (newVal, oldVal) => {
    if (newVal) {
        getUserInfo();
    }
});

// 监听触发用户权益
watch(() => triggerUserBenefits.value, (newVal, oldVal) => {
    if (newVal) {
        openUserBenefits();
    }
})

// 监听触发远程用户信息
watch(() => triggerRemoteUserInfo.value, (newVal, oldVal) => {
    if (newVal) {
        getUserInfo();
    }
})

// 监听更新用户成就
watch(() => triggerUpdateAchievements.value, (newVal, oldVal) => {
    if (newVal) {
        updateUserAchievement(achievementToUpdate.value);
        store.triggerUpdateAchievements = false;
    }
})


</script>
<style scoped></style>