<template>
    <button v-if="isInfosLoaded" class="btn position-fixed"
        :class="infoMaskLevel === 0 ? 'btn-success' : infoMaskLevel === 1 ? 'btn-warning' : 'btn-secondary'"
        style="bottom: 66px; right: 20px; z-index: 1050;" @click="toggleInfoMask" aria-label="Toggle Info Mask"
        v-tooltip="$t('Tooltips.InfoMask')">
        <i :class="infoMaskLevel === 0 ? 'bi bi-eye' : 'bi bi-eye-slash'"></i>
    </button>
</template>

<script setup>

const { isInfosLoaded, infoMaskLevel, toggleInfoMask } = defineProps({
    isInfosLoaded: Boolean,
    infoMaskLevel: Number,
    toggleInfoMask: Function,
});

</script>

<style scoped></style>