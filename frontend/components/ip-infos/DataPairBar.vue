<template>
    <div class="data-pair-bar-wrapper">
        <!-- 进度条 -->
        <div class="progress border" :class="[isDarkMode ? 'border-light bg-dark' : 'border-secondary']"
            role="progressbar" :aria-label="`${leftLabel} ${leftValue}% vs ${rightLabel} ${rightValue}%`">
            <div class="progress-bar" :class="[isDarkMode ? 'bg-light' : 'bg-secondary']"
                :style="{ width: leftValue + '%' }"></div>
            <div class="progress-bar" :class="[isDarkMode ? 'bg-secondary' : 'bg-light']"
                :style="{ width: rightValue + '%' }"></div>
        </div>

        <!-- 文字标签 -->
        <div class="labels-container fs-7">
            <span class="d-flex align-items-center">
                <span class="fw-light badge rounded-pill border me-1"
                    :class="isDarkMode ? 'text-bg-dark' : 'text-bg-light'">{{ t('ipInfos.ASNInfo.' + leftLabel)
                    }}</span>
                <span class="fw-bold">{{ leftValue }}%</span>
            </span>
            <span class="d-flex align-items-center">
                <span class="fw-light badge rounded-pill border me-1"
                    :class="isDarkMode ? 'text-bg-dark' : 'text-bg-light'">{{ t('ipInfos.ASNInfo.' + rightLabel)
                    }}</span>
                <span class="fw-bold">{{ rightValue }}%</span>
            </span>
        </div>
    </div>
</template>

<script setup>
defineProps({
    leftLabel: {
        type: String,
        required: true
    },
    leftValue: {
        type: Number,
        required: true
    },
    rightLabel: {
        type: String,
        required: true
    },
    rightValue: {
        type: Number,
        required: true
    },
    isDarkMode: {
        type: Boolean,
        required: true
    }
});

import { useI18n } from 'vue-i18n';
const { t } = useI18n();

</script>

<style scoped>
.data-pair-bar-wrapper {
    margin: 14px 0;
}

.bar-left {
    background-color: #75b798;
}

.bar-right {
    background-color: #de5c9d;
}

.bar-text-left {
    color: #75b798;
}

.bar-text-right {
    color: #de5c9d;
}

.progress {
    height: 16px;
    border-radius: 8px;
}

.labels-container {
    display: flex;
    justify-content: space-between;
    margin-top: 2px;
}

.label-item {
    color: #6c757d;
}

.label-left {
    text-align: left;
}

.label-right {
    text-align: right;
}

.dark-mode-text {
    color: #adb5bd;
}
</style>
