<template>
    <!-- Achievements panel -->
    <Sheet v-if="isSignedIn" :open="isOpen" @update:open="onOpenChange">
        <SheetContent side="left" :title="t('user.Achievements.Title')"
            :class="['flex flex-col p-0 gap-0', isMobile ? 'w-full max-w-full' : 'w-[640px] max-w-[80vw]']">
            <!-- Header -->
            <header class="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
                <h2 class="flex items-center gap-2 text-base font-semibold m-0">
                    <Award class="size-4 text-muted-foreground" />
                    {{ t('user.Achievements.Title') }}
                </h2>
                <SheetClose
                    class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
            </header>

            <!-- Content (scrollable) -->
            <div class="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                <!-- Top note -->
                <p class="text-sm text-muted-foreground leading-relaxed">{{ t('user.Achievements.Note') }}</p>

                <Tabs default-value="get" class="space-y-4">
                    <TabsList>
                        <TabsTrigger value="get">{{ t('user.Achievements.Get') }}</TabsTrigger>
                        <TabsTrigger value="notGet">{{ t('user.Achievements.NotGet') }}</TabsTrigger>
                    </TabsList>

                    <!-- Achieved -->
                    <TabsContent value="get" class="mt-0 space-y-4">
                        <div
                            class="flex items-center gap-2 px-3 py-2 rounded-md bg-success/10 text-success text-sm font-medium">
                            <CircleCheck class="size-4" />
                            <span>{{ t('user.Achievements.GetCount') }}: {{ achievedCount }}</span>
                        </div>

                        <div v-if="achievedCount === 0"
                            class="text-center text-sm text-muted-foreground py-8">
                            —
                        </div>
                        <div v-else
                            class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            <button v-for="achievement in achievedList" :key="achievement.name"
                                type="button"
                                class="jn-achievement-card cursor-pointer text-left"
                                :title="t(`user.Achievements.Type.${achievement.name}.Meet`)"
                                @click="flipCard(achievement.name)">
                                <div class="p-3 flex flex-col items-center justify-center min-h-[200px] relative">
                                    <!-- Default face: image + title -->
                                    <template v-if="!achievement.showDetails">
                                        <img :src="achievement.img" alt=""
                                            class="jn-slide-in size-[120px] object-contain" />
                                        <h3 class="jn-slide-in mt-2 text-sm font-medium text-center text-foreground">
                                            {{ t(`user.Achievements.Type.${achievement.name}.Title`) }}
                                        </h3>
                                    </template>
                                    <!-- Flipped face: meet condition + achieved time -->
                                    <template v-else>
                                        <p class="jn-slide-in text-sm text-center text-foreground/85 leading-relaxed">
                                            {{ t(`user.Achievements.Type.${achievement.name}.Meet`) }}
                                        </p>
                                        <span class="jn-slide-in absolute bottom-3 text-xs text-muted-foreground tabular-nums">
                                            {{ convertTime(achievement.achievedTime) }}
                                        </span>
                                    </template>
                                </div>
                            </button>
                        </div>
                    </TabsContent>

                    <!-- Not achieved -->
                    <TabsContent value="notGet" class="mt-0 space-y-4">
                        <div
                            class="flex items-center gap-2 px-3 py-2 rounded-md bg-warning/10 text-warning text-sm font-medium">
                            <CircleX class="size-4" />
                            <span>{{ t('user.Achievements.NotGetCount') }}: {{ notAchievedCount }}</span>
                        </div>

                        <div v-if="notAchievedCount === 0"
                            class="text-center text-sm text-muted-foreground py-8">
                            🏆
                        </div>
                        <div v-else
                            class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            <div v-for="achievement in notAchievedList" :key="achievement.name"
                                class="jn-achievement-card opacity-50 cursor-not-allowed">
                                <div class="p-3 flex flex-col items-center justify-center min-h-[200px]">
                                    <img :src="achievement.img" alt=""
                                        class="jn-slide-in size-[120px] object-contain grayscale blur-[4px]" />
                                    <h3 class="mt-2 text-sm font-medium text-center text-muted-foreground grayscale blur-[4px]">
                                        {{ t(`user.Achievements.Type.${achievement.name}.Title`) }}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <!-- Bottom note -->
                <p class="text-xs text-muted-foreground leading-relaxed pt-2">
                    {{ t('user.Achievements.FooterNote') }}
                </p>
            </div>
        </SheetContent>
    </Sheet>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import unixToDateTime from '@/utils/timestamp-to-date';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Award, CircleCheck, CircleX } from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const triggerAchievements = computed(() => store.triggerAchievements);

const isSignedIn = computed(() => store.isSignedIn);
const remoteUserInfoFetched = computed(() => store.remoteUserInfoFetched);

const userAchievements = computed(() => store.userAchievements);
const achievedList = computed(() =>
    Object.values(userAchievements.value).filter(a => a.achieved)
);
const notAchievedList = computed(() =>
    Object.values(userAchievements.value).filter(a => !a.achieved)
);
const achievedCount = computed(() => achievedList.value.length);
const notAchievedCount = computed(() => notAchievedList.value.length);

const convertTime = (timestamp) => timestamp == null ? '' : unixToDateTime(timestamp);

const isOpen = computed(() => store.openSheet === 'achievements');
const onOpenChange = (val) => {
    store.setOpenSheet(val ? 'achievements' : null);
};

const openAchievements = () => {
    store.toggleSheet('achievements');
    store.setTriggerAchievements(false);
    trackEvent('Nav', 'NavClick', 'Achievements');
};

const flipCard = (achievementName) => {
    if (Object.prototype.hasOwnProperty.call(userAchievements.value, achievementName)) {
        userAchievements.value[achievementName].showDetails = !userAchievements.value[achievementName].showDetails;
    }
};

watch(() => triggerAchievements.value, (newVal) => {
    if (newVal) openAchievements();
    if (!remoteUserInfoFetched.value) {
        store.setTriggerRemoteUserInfo(true);
    }
});
</script>

<style scoped>
.jn-achievement-card {
    position: relative;
    border-radius: 8px;
    border: 3px solid transparent;
    background-image:
        linear-gradient(var(--card), var(--card)),
        linear-gradient(45deg, #fad705, #f96e21, #01a294);
    background-origin: border-box;
    background-clip: content-box, border-box;
    width: 100%;
}

/* Flipped face fade-up animation */
.jn-slide-in {
    animation: slide-in 0.2s ease-in forwards;
}
@keyframes slide-in {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
</style>
