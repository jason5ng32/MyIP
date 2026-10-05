<template>
  <!-- Tools menu: every listed Advanced Tool, grouped by category, as one
       dropdown that works the same on desktop and mobile. The trigger reads
       "Advanced Tools ▾" from `sm` up and collapses to an icon below it (the
       label stays as its accessible name). Picking a tool emits `select`; the
       caller decides how to open it. -->
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="h-8 shrink-0 gap-1 px-2 cursor-pointer">
        <LayoutGrid class="sm:hidden" />
        <span class="sr-only sm:not-sr-only">{{ t('advancedtools.Title') }}</span>
        <ChevronDown class="opacity-60 max-sm:hidden" />
      </Button>
    </DropdownMenuTrigger>

    <!-- Scrolls inside the room the viewport leaves below the trigger. -->
    <DropdownMenuContent :align="align"
      class="w-64 max-h-[var(--reka-dropdown-menu-content-available-height)] overflow-y-auto">
      <template v-for="(group, index) in groups" :key="group.id">
        <DropdownMenuSeparator v-if="index > 0" />
        <DropdownMenuLabel class="text-xs font-medium text-muted-foreground">
          {{ t(group.titleKey) }}
        </DropdownMenuLabel>
        <DropdownMenuItem v-for="tool in group.tools" :key="tool.slug" class="cursor-pointer"
          :class="tool.slug === current && 'bg-accent/60 font-medium'"
          :aria-current="tool.slug === current ? 'page' : undefined" @select="emit('select', tool.slug)">
          <span aria-hidden="true" class="w-5 shrink-0 text-center">{{ tool.emoji }}</span>
          <span class="min-w-0 truncate">{{ t(tool.titleKey) }}</span>
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup>
// Grouped Advanced Tools dropdown. Lists what the deployment's gates allow
// (utils/tool-availability.js), in TOOL_CATEGORIES order (data/tools.js).
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { ADVANCED_TOOLS, groupToolsByCategory } from '@/data/tools.js';
import { listedTools } from '@/utils/tool-availability.js';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, LayoutGrid } from '@lucide/vue';

defineProps({
  // Slug of the tool on screen, marked in the list.
  current: { type: String, default: '' },
  // Menu alignment against the trigger.
  align: { type: String, default: 'start' },
});

const emit = defineEmits(['select']);

const { t } = useI18n();
const store = useMainStore();

const groups = computed(() => groupToolsByCategory(
  listedTools(ADVANCED_TOOLS, store.configs),
));
</script>
