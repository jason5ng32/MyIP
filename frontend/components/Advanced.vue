<template>
    <!-- Advanced Tools -->
    <section class="advanced-tools-section mb-10">
        <!-- Header -->
        <header class="mb-2 flex flex-col items-start justify-between gap-4">
            <div class="flex flex-row items-center justify-between gap-4 w-full">
            <h2 id="AdvancedTools" class="m-0 flex min-w-0 flex-1 items-center gap-2 text-xl md:text-3xl font-semibold tracking-tight leading-tight">
                🧰 {{ t('advancedtools.Title') }}
            </h2>
            </div>
            <div class="text-base text-muted-foreground">
                <p v-if="!isSimpleMode">{{ t('advancedtools.Note') }}</p>
            </div>
        </header>

        <!-- Card groups, one per category (data/tools.js TOOL_CATEGORIES). Each
             card is a real <a> to the tool's /tools/:slug page, so ⌘/Ctrl-click,
             middle-click and "open in new tab" stay with the browser; a plain
             left-click (or Enter / Space) is routed in-app instead, which keeps
             this page alive behind the tool. -->
        <div class="mt-4 space-y-6">
            <div v-for="group in cardGroups" :key="group.id">
                <h3 class="mb-3 text-sm font-medium tracking-wide text-muted-foreground">
                    {{ t(group.titleKey) }}
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Card v-for="card in group.tools" :key="card.slug"
                        :data-adv-slug="card.slug"
                        class="keyboard-shortcut-card jn-card jn-adv-card group relative overflow-visible transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50">
                        <a :href="`/tools/${card.slug}`"
                            class="block cursor-pointer no-underline text-inherit"
                            @click="onCardClick($event, card.slug)"
                            @keydown.enter.prevent="openTool(card.slug)"
                            @keydown.space.prevent="openTool(card.slug)">
                            <CardContent class="p-4">
                                <h4 class="text-xl font-medium text-primary mb-2 pr-10">
                                    <ArrowRight
                                        class="inline size-[1em] align-[-0.15em] mr-1.5 transition-colors duration-300" />
                                    {{ t(card.titleKey) }}
                                </h4>
                                <!-- Description -->
                                <p class="text-base text-muted-foreground line-clamp-2 min-h-10">
                                    {{ t(card.noteKey) }}
                                </p>
                                <!-- Top right emoji -->
                                <span class="jn-emoji" aria-hidden="true">{{ card.emoji }}</span>
                            </CardContent>
                        </a>

                    </Card>
                </div>
            </div>
        </div>

        <!-- Section banner slot (data-driven; see InfoBanner.vue) -->
        <InfoBanner section="advanced" />
    </section>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { ADVANCED_TOOLS, groupToolsByCategory } from '@/data/tools.js';
import { isToolAvailable } from '@/utils/tool-availability.js';
import { Card, CardContent } from '@/components/ui/card';
import InfoBanner from '@/components/widgets/InfoBanner.vue';
import { ArrowRight } from '@lucide/vue';

const { t } = useI18n();

const store = useMainStore();
const configs = computed(() => store.configs);
const userPreferences = computed(() => store.userPreferences);
const isSimpleMode = computed(() => userPreferences.value.simpleMode);
const router = useRouter();

// Card groups behind the deployment gates (original site / configs flag, see
// utils/tool-availability.js). Reactive on configs, so gated cards appear the
// moment configs land.
const cardGroups = computed(() => groupToolsByCategory(
    ADVANCED_TOOLS.filter((tool) => isToolAvailable(tool, configs.value)),
));

// Open a tool's page. Also the keyboard shortcuts' entry point (exposed below).
const openTool = (slug) => {
    router.push(`/tools/${slug}`);
    const name = slug.charAt(0).toUpperCase() + slug.slice(1);
    trackEvent('Nav', 'NavClick', name);
};

// Card left-click: route in-app. Modifier / middle clicks fall through to the
// <a href> default so the browser opens the page in a new tab.
const onCardClick = (e, slug) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    e.preventDefault();
    openTool(slug);
};

onMounted(() => {
    store.setMountingStatus('AdvancedTools', true);
});

defineExpose({
    openTool,
});

</script>

<style scoped>
.jn-emoji {
    position: absolute;
    top: 0.5rem;
    right: 0.75rem;
    font-size: 1.6rem;
    line-height: 1;
    transition: transform 0.4s ease, text-shadow 0.4s ease;
    pointer-events: none;
}

.jn-adv-card:hover .jn-emoji {
    transform: translateY(-10pt) scale(1.8);
    text-shadow: 0 0 10pt rgb(0 0 0 / 0.38);
}

:global(.dark) .jn-adv-card:hover .jn-emoji {
    text-shadow: 0 0 10pt rgb(255 255 255 / 0.15);
}
</style>
