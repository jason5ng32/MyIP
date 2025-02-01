<template>

    <div v-if="isSignedIn" :data-bs-theme="isDarkMode ? 'dark' : 'light'"
        :class="[isMobile ? ' w-100' : 'jn-achievements-offcanvas']" class="offcanvas offcanvas-start h-100 border-0 mt-5"
        tabindex="-1" id="Achievements" aria-labelledby="AchievementsLabel">
        <div class="offcanvas-header mt-3">
            <h5 class="offcanvas-title"><i class="bi bi-award-fill"></i> {{
                t('user.Achievements.Title') }}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body pt-0">
            <div :data-bs-theme="isDarkMode ? 'dark' : ''" class="modal-body m-2">
                <p class="opacity-75">{{ t('user.Achievements.Note') }}</p>
                <p class="opacity-75 mt-3">{{ t('user.Achievements.FooterNote') }}</p>

                <ul class="nav nav-tabs" id="AchievementsList" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="home-tab" data-bs-toggle="tab"
                            data-bs-target="#get-tab-pane" type="button" role="tab" aria-controls="get-tab-pane"
                            aria-selected="true">{{
                            t('user.Achievements.Get') }}</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="not-get-tab" data-bs-toggle="tab"
                            data-bs-target="#not-get-tab-pane" type="button" role="tab" aria-controls="not-get-tab-pane"
                            aria-selected="false">{{ t('user.Achievements.NotGet')
                            }}</button>
                    </li>
                </ul>
                <div class="tab-content my-4 mx-1" id="AchievementsListContent">
                    <div class="tab-pane fade show active" id="get-tab-pane" role="tabpanel" aria-labelledby="get-tab"
                        tabindex="0">
                        <span :data-bs-theme="isDarkMode ? 'dark' : ''" class="alert alert-success d-flex"> <i
                                class="bi bi-check-circle"></i>&nbsp; {{t('user.Achievements.GetCount')}}: {{
                            achievedCount }}</span>
                        <div class="row">
                            <div class="col-lg-3 col-md-6 col-6 my-2"
                                v-for="(achievement,key) in Object.values(userAchievements).filter(achievement => achievement.achieved)"
                                :key="key">
                                <div class="card jn-card jn-achievements-card " :class="{ ' jn-achievements-card-dark': isDarkMode }">
                                    <div type="button"
                                        class="card-body d-flex flex-column align-items-center justify-content-around"
                                        :title="t(`user.Achievements.Type.${achievement.name}.Meet`)"
                                        @click="flipCard(achievement.name)">
                                        <img v-if="!achievement.showDetails" :src="achievement.img"
                                            class="jn-slide-in jn-achievements-img" height="120pt" width="120pt" />
                                        <h3 v-if="!achievement.showDetails" :class="{ 'text-light': isDarkMode }"
                                            class="text-secondary fs-6 mt-2 text-center jn-slide-in jn-achievements-h3">
                                            {{ t(`user.Achievements.Type.${achievement.name}.Title`) }}
                                        </h3>
                                        <div v-if="achievement.showDetails"
                                            class="text-secondary jn-slide-in d-flex flex-column align-items-center">
                                            <span class="text-center">
                                                {{t(`user.Achievements.Type.${achievement.name}.Meet`)}}
                                            </span>
                                        </div>
                                        <div v-if="achievement.showDetails" class="jn-achieved-time  jn-slide-in">
                                            <span class="mobile-h6 opacity-50">
                                                {{convertTime(achievement.achievedTime)}}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tab-pane fade" id="not-get-tab-pane" role="tabpanel" aria-labelledby="not-get-tab"
                        tabindex="0">
                        <span :data-bs-theme="isDarkMode ? 'dark' : ''" class="alert alert-warning d-flex"> <i
                                class="bi bi-x-circle"></i>&nbsp; {{t('user.Achievements.NotGetCount')}}: {{
                            notAchievedCount }}</span>
                        <div class="row">
                            <div class="col-lg-3 col-md-6 col-6 my-4 opacity-50"
                                v-for="(achievement,key) in Object.values(userAchievements).filter(achievement => !achievement.achieved)"
                                :key="key">
                                <div class="card jn-card jn-achievements-card" :class="{ ' jn-achievements-card-dark': isDarkMode }">
                                    <div class="card-body d-flex flex-column align-items-center justify-content-center jn-mosaic"
                                        @click="flipCard(achievement.name)">
                                        <img :src="achievement.img" class="jn-slide-in jn-blur jn-achievements-img"
                                            height="120pt" width="120pt" />
                                        <h3 class="text-secondary fs-6 mt-2 text-center jn-blur jn-achievements-h3"
                                            :class="{ 'text-light': isDarkMode }">
                                            {{ t(`user.Achievements.Type.${achievement.name}.Title`) }}
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div id="offcanvasPlaceholder mb-5" class="jn-placeholder mb-5">
        </div>

    </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useMainStore } from '@/store';
import { Offcanvas } from 'bootstrap';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import unixToDateTime from '@/utils/timestamp-to-date';

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

// 打开成就面板
const openAchievements = () => {
    const offcanvasElement = document.getElementById('Achievements');
    let offcanvas = Offcanvas.getInstance(offcanvasElement) || new Offcanvas(offcanvasElement);
    if (offcanvasElement.classList.contains('show')) {
        offcanvas.hide();
    } else {
        offcanvas.show();
    }

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
#Achievements {
    z-index: 1053;
}

.jn-achievements-offcanvas {
    min-width: 600pt;
}

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
    border: 3px solid transparent;
    background-image: linear-gradient(white, white), linear-gradient(45deg, #fad705, #f96e21, #01a294);
    background-origin: border-box;
    background-clip: content-box, border-box;

}

.jn-achievements-img {
    object-fit: contain;
}

.jn-achievements-h3 {
    min-height: 2pt;
}

.jn-achievements-card-dark {
    position: relative;
    min-height: 170pt;
    border: 3px solid transparent;
    background-image: linear-gradient(#171a1d, #171a1d), linear-gradient(45deg, #fad705, #f96e21, #01a294);
    background-origin: border-box;
    background-clip: content-box, border-box;

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
