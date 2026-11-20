<template>
    <!-- Benefits list of the account dialog (User.vue): the groups → tiers →
         items that utils/features/user-benefits.js resolved for this
         deployment, one card per tier, stacked single-column. -->
    <div class="space-y-5">
        <p class="text-sm text-muted-foreground leading-relaxed mb-2">{{ t('user.Benefits.Intro') }}</p>

        <section v-for="group in groups" :key="group.id" class="space-y-3">
            <h3 v-if="groups.length > 1" class="text-base font-semibold my-2">{{ t(group.titleKey) }}</h3>

            <section v-for="tier in group.tiers" :key="tier.id"
                class="flex flex-col rounded-lg border bg-card p-3"
                :class="tier.current && 'border-success/60'">
                <header class="flex items-center gap-1.5 mb-2">
                    <component :is="TIER_ICONS[tier.id]" class="size-4 text-muted-foreground shrink-0" />
                    <h4 class="text-sm font-semibold m-0 truncate">{{ t(tier.nameKey) }}</h4>
                    <Badge v-if="tier.current" variant="success"
                        class="ml-auto text-[10px] px-1.5 py-0 h-4 shrink-0">
                        {{ t('user.Benefits.Current') }}
                    </Badge>
                </header>
                <ul class="space-y-1.5 list-none p-0 m-0">
                    <!-- "Everything in the previous tier": muted with a plus so
                         the real additions stand out. -->
                    <li v-if="tier.includesKey" class="flex items-start gap-1.5 text-xs leading-relaxed">
                        <Plus class="size-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                        <span class="text-muted-foreground">{{ t(tier.includesKey) }}</span>
                    </li>
                    <li v-for="item in tier.items" :key="item.id"
                        class="flex items-start gap-1.5 text-xs leading-relaxed">
                        <Check class="size-3.5 shrink-0 mt-0.5 text-success" />
                        <span>{{ t(item.key) }}</span>
                    </li>
                </ul>
                <Button v-if="tier.sponsorCta && !isSponsor" as-child size="sm" variant="action" class="mt-3 w-full">
                    <a href="https://github.com/sponsors/jason5ng32" target="_blank" rel="noopener">
                        <Heart class="size-3.5" />
                        {{ t('user.QuotaSponsorCta') }}
                    </a>
                </Button>
            </section>
        </section>
    </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Heart, HeartHandshake, Plus, UserRound, UserRoundCheck } from '@lucide/vue';

defineProps({
    groups: { type: Array, required: true },
    isSponsor: { type: Boolean, default: false },
});

const { t } = useI18n();

const TIER_ICONS = { visitor: UserRound, signedIn: UserRoundCheck, sponsor: HeartHandshake };
</script>
