<template>
    <Sheet v-if="isSignedIn" :open="isOpen" @update:open="onOpenChange">
        <SheetContent
            side="left"
            :title="t('user.Achievements.Title')"
            :class="cn('overflow-y-auto pt-3', isMobile ? 'w-full max-w-full' : 'w-[600pt] max-w-[80vw]')"
        >
            <div class="mt-3 flex items-center justify-between px-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                <h5 class="m-0 text-lg font-semibold">
                    <Award class="inline size-[1em] align-[-0.125em]" /> {{ t('user.Achievements.Title') }}
                </h5>
                <SheetClose />
            </div>
            <div class="pt-3 m-2">
                <p class="opacity-75">{{ t('user.Achievements.Note') }}</p>
                <p class="opacity-75 mt-3">{{ t('user.Achievements.FooterNote') }}</p>

                <Tabs default-value="get">
                    <TabsList>
                        <TabsTrigger value="get">{{ t('user.Achievements.Get') }}</TabsTrigger>
                        <TabsTrigger value="notGet">{{ t('user.Achievements.NotGet') }}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="get" class="my-4 mx-1">
                        <span class="flex items-center px-3 py-2 rounded-md border bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200">
                            <CircleCheck class="inline size-[1em] align-[-0.125em]" />&nbsp;
                            {{ t('user.Achievements.GetCount') }}: {{ achievedCount }}
                        </span>
                        <div class="flex flex-wrap -mx-2">
                            <div class="w-1/2 md:w-1/3 lg:w-1/4 px-2 my-2"
                                v-for="(achievement, key) in Object.values(userAchievements).filter(a => a.achieved)"
                                :key="key">
                                <div class="jn-achievements-card">
                                    <div type="button" role="button"
                                        class="p-3 flex flex-col items-center justify-around cursor-pointer"
                                        :title="t(`user.Achievements.Type.${achievement.name}.Meet`)"
                                        @click="flipCard(achievement.name)">
                                        <img v-if="!achievement.showDetails" :src="achievement.img"
                                            class="jn-slide-in jn-achievements-img" height="120pt" width="120pt" />
                                        <h3 v-if="!achievement.showDetails"
                                            class="text-neutral-500 dark:text-neutral-100 text-base mt-2 text-center jn-slide-in jn-achievements-h3">
                                            {{ t(`user.Achievements.Type.${achievement.name}.Title`) }}
                                        </h3>
                                        <div v-if="achievement.showDetails"
                                            class="text-neutral-500 jn-slide-in flex flex-col items-center">
                                            <span class="text-center">
                                                {{ t(`user.Achievements.Type.${achievement.name}.Meet`) }}
                                            </span>
                                        </div>
                                        <div v-if="achievement.showDetails" class="jn-achieved-time jn-slide-in">
                                            <span class="text-sm opacity-50">{{ convertTime(achievement.achievedTime) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="notGet" class="my-4 mx-1">
                        <span class="flex items-center px-3 py-2 rounded-md border bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200">
                            <CircleX class="inline size-[1em] align-[-0.125em]" />&nbsp;
                            {{ t('user.Achievements.NotGetCount') }}: {{ notAchievedCount }}
                        </span>
                        <div class="flex flex-wrap -mx-2">
                            <div class="w-1/2 md:w-1/3 lg:w-1/4 px-2 my-4 opacity-50"
                                v-for="(achievement, key) in Object.values(userAchievements).filter(a => !a.achieved)"
                                :key="key">
                                <div class="jn-achievements-card">
                                    <div class="p-3 flex flex-col items-center justify-center jn-mosaic cursor-pointer"
                                        @click="flipCard(achievement.name)">
                                        <img :src="achievement.img" class="jn-slide-in jn-blur jn-achievements-img"
                                            height="120pt" width="120pt" />
                                        <h3 class="text-neutral-500 dark:text-neutral-100 text-base mt-2 text-center jn-blur jn-achievements-h3">
                                            {{ t(`user.Achievements.Type.${achievement.name}.Title`) }}
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <div class="jn-placeholder mb-5"></div>
        </SheetContent>
    </Sheet>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import unixToDateTime from '@/utils/timestamp-to-date';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Award, CircleCheck, CircleX } from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const triggerAchievements = computed(() => store.triggerAchievements);

const isSignedIn = computed(() => store.isSignedIn);
const remoteUserInfoFetched = computed(() => store.remoteUserInfoFetched);

// 用户成就
const userAchievements = computed(() => store.userAchievements);
const achievedCount = computed(() => {
    return Object.values(userAchievements.value).filter(achievement => achievement.achieved).length;
});
const notAchievedCount = computed(() => {
    return Object.values(userAchievements.value).filter(achievement => !achievement.achieved).length;
});


// 转换时间
const convertTime = (timestamp) => {
    if (timestamp === null) {
        return '';
    }
    return unixToDateTime(timestamp);
}

// Sheet 开关与 store.openSheet 双向绑定（refactor/01）
const isOpen = computed(() => store.openSheet === 'achievements');
const onOpenChange = (val) => {
    store.setOpenSheet(val ? 'achievements' : null);
};

// 打开成就面板（外部触发：通过 store.triggerAchievements）
const openAchievements = () => {
    store.toggleSheet('achievements');
    // 重置
    store.setTriggerAchievements(false);
    trackEvent('Nav', 'NavClick', 'Achievements');
};


// 翻转卡片
const flipCard = (achievementName) => {
    if (userAchievements.value.hasOwnProperty(achievementName)) {
        userAchievements.value[achievementName].showDetails = !userAchievements.value[achievementName].showDetails;
    }
};

// 监听打开成就
watch(() => triggerAchievements.value, (newVal, oldVal) => {
    if (newVal) {
        openAchievements();
    }
    // 获取一次用户信息，以防没有
    if (!remoteUserInfoFetched.value) {
        store.setTriggerRemoteUserInfo(true);
    }
})

</script>

<style scoped>
.jn-slide-in {
    animation: slide-in 0.2s ease-in forwards;
}

@keyframes slide-in {
    from {
        transform: translateY(20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.jn-achievements-card {
    position: relative;
    min-height: 170pt;
    border-radius: 8px;
    border: 3px solid transparent;
    background-image: linear-gradient(white, white), linear-gradient(45deg, #fad705, #f96e21, #01a294);
    background-origin: border-box;
    background-clip: content-box, border-box;
}

:global(.dark) .jn-achievements-card {
    background-image: linear-gradient(#171a1d, #171a1d), linear-gradient(45deg, #fad705, #f96e21, #01a294);
}

.jn-achievements-img {
    object-fit: contain;
}

.jn-achievements-h3 {
    min-height: 2pt;
}

.jn-blur {
    filter: grayscale(1);
}

.jn-achieved-time {
    position: absolute;
    bottom: 10pt;
}

.jn-mosaic {
    filter: blur(4px);
    cursor: not-allowed;
}

.jn-placeholder {
    height: 20pt;
}
</style>
