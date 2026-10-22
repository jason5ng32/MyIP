<template>
    <div>
        <!-- Scores headline -->
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-xs border-b">
            <span v-if="section.ip" class="text-muted-foreground">
                {{ t('reportPage.Col.IP') }}: <span class="font-mono text-foreground">{{ section.ip }}</span>
            </span>
            <span>
                {{ t('invisibilitytest.proxyScore') }}:
                <span class="font-mono font-semibold" :class="scoreTone(section.scores.proxy)">{{ section.scores.proxy }}</span>
            </span>
            <span>
                {{ t('invisibilitytest.VPNScore') }}:
                <span class="font-mono font-semibold" :class="scoreTone(section.scores.vpn)">{{ section.scores.vpn }}</span>
            </span>
        </div>
        <!-- One row per detection signal -->
        <ul class="divide-y text-xs">
            <li v-for="flag in section.flags" :key="flag.key" class="flex items-center justify-between gap-4 px-4 py-2">
                <span>{{ t(`invisibilitytest.${flag.key}.title`) }}</span>
                <span :class="flag.flagged ? 'text-warning' : 'text-muted-foreground'">
                    {{ t(`invisibilitytest.${flag.key}.${flag.flagged ? 'positive' : 'negative'}`) }}
                </span>
            </li>
        </ul>
    </div>
</template>

<script setup>
// Read-only renderer for the invisibility report section: proxy/VPN scores
// plus each detection signal's verdict, reusing the tool's own i18n entries
// (flag keys are the tool's nested i18n paths, e.g. "blocklist.proxy").
import { useI18n } from 'vue-i18n';

defineProps({ section: { type: Object, required: true } });
const { t } = useI18n();

// Same thresholds as the live tool: calm below 30, warning below 70, loud above.
const scoreTone = (score) => {
    if (score < 30) return 'text-success';
    if (score < 70) return 'text-warning';
    return 'text-destructive';
};
</script>
