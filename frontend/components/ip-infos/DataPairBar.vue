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
        <div class="labels-container">
            <span class="fw-normal fs-7">
                {{ t('ipInfos.ASNInfo.' + leftLabel) }}
                {{ leftValue }}%
            </span>
            <span class="fw-normal fs-7">
                {{ t('ipInfos.ASNInfo.' + rightLabel) }}
                {{ rightValue }}%
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
    margin: 10px 0;
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
    margin-top: 6px;
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
