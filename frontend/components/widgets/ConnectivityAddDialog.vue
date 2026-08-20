<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <!-- One fixed desktop width (Help.vue precedent); the custom-form tab
         centers its narrower content instead of resizing the dialog. -->
    <DialogContent class="md:max-w-2xl md:min-h-165">
      <DialogHeader :icon="CirclePlus" :title="t('connectivity.importDialog.Title')" />

      <Tabs v-model="tab" class="w-full">
        <TabsList class="grid w-full grid-cols-2  mb-3">
          <TabsTrigger value="import" class="cursor-pointer">
            {{ t('connectivity.importDialog.ImportOption') }}</TabsTrigger>
          <TabsTrigger value="custom" class="cursor-pointer">
            {{ t('connectivity.importDialog.CustomOption') }}</TabsTrigger>
        </TabsList>

        <!-- Curated lists, two columns on desktop; the system defaults
             close the grid as a recovery entry. Lists may overlap —
             hostname dedupe on import keeps cards unique. -->
        <TabsContent value="import" class="space-y-3">
          <ul class="grid gap-2 md:grid-cols-2 max-h-[55vh] overflow-y-auto pr-1">
            <li v-for="list in importableLists" :key="list.id"
              class="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <span class="size-6 shrink-0 inline-flex items-center justify-center text-lg leading-none">
                {{ list.emoji }}</span>
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="truncate min-w-0" :title="t('connectivity.importLists.' + list.id)">
                  {{ t('connectivity.importLists.' + list.id) }}</span>
                <span class="flex items-center gap-2">
                  <span class="flex -space-x-1.5">
                    <img v-for="m in list.members.slice(0, 4)" :key="m.id" :src="faviconPath(m.id)" alt=""
                      class="size-4 rounded-full ring-1 ring-background bg-background" />
                  </span>
                  <span class="text-xs text-muted-foreground">
                    {{ t('connectivity.importDialog.SiteCount', { n: list.members.length }) }}</span>
                </span>
              </span>
              <!-- Fully present → the import button itself becomes an inert
                   green check, so the action column never goes empty. -->
              <Button v-if="!isListFullyPresent(list, targets)" size="icon" variant="outline"
                class="size-8 shrink-0 cursor-pointer" @click="importList(list)"
                :title="t('connectivity.importDialog.Import')" :aria-label="t('connectivity.importDialog.Import')">
                <Plus class="size-4" />
              </Button>
              <Button v-else size="icon" variant="ghost" disabled
                class="size-8 shrink-0 text-success disabled:opacity-100">
                <Check class="size-4" />
              </Button>
            </li>
          </ul>
          <!-- Success stays quiet (the button turning into a check is the
               confirmation); only a cap overflow surfaces a message here. -->
          <div class="flex flex-col items-end justify-end gap-1 min-h-4 text-xs text-muted-foreground">
            <span aria-live="polite" class="text-destructive">{{ importResult || '&nbsp;' }}</span>
            <span class="tabular-nums shrink-0">
              {{ t('connectivity.importDialog.Capacity', { used: targets.length, limit: CONNECTIVITY_TARGET_LIMIT
              }) }}
            </span>
          </div>
        </TabsContent>

        <!-- Custom add: the pre-existing single-site form, unchanged behavior. -->
        <TabsContent value="custom">
          <div class="space-y-4 w-full">
            <div class="space-y-1.5">
              <Label for="custom-conn-name">{{ t('connectivity.addCustom.NameLabel') }}</Label>
              <Input id="custom-conn-name" v-model="addName" :placeholder="t('connectivity.addCustom.NamePlaceholder')"
                :aria-invalid="isNameError ? 'true' : undefined" autocomplete="off" autocorrect="off"
                autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true" @keyup.enter="handleAdd"
                maxlength="20" />
            </div>
            <div class="space-y-1.5">
              <Label for="custom-conn-url">{{ t('connectivity.addCustom.UrlLabel') }}</Label>
              <Input id="custom-conn-url" v-model="addUrl" :placeholder="t('connectivity.addCustom.UrlPlaceholder')"
                :aria-invalid="isUrlError ? 'true' : undefined" autocomplete="off" autocorrect="off"
                autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true" @keyup.enter="handleAdd" />
            </div>
            <p class="mb-2 text-xs text-muted-foreground leading-relaxed">{{ t('connectivity.addCustom.Hint') }}</p>
            <!-- min-h-4 reserves space so the dialog height doesn't jump -->
            <p class="text-xs text-destructive min-h-4" aria-live="polite">{{ addError }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <Button variant="action" type="button" @click="handleAdd"
                :disabled="addName.length === 0 || addUrl.length === 0" class="cursor-pointer">
                {{ t('connectivity.addCustom.Add') }}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>

<script setup>
// Tabbed dialog behind the Connectivity grid's "Add Test" tile: import a
// curated country/theme list (default tab, matching the tile's stacked-icon
// cue), or hand-add a single custom target (migrated from
// ConnectivityTest.vue). Imports materialize list members into the
// connectivityTargets preference — imported cards then behave exactly like
// hand-added ones (individually removable in the grid).
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent } from '@/utils/app-events';
import {
  IMPORT_LISTS, SYSTEM_IMPORT_LIST, CONNECTIVITY_TARGET_LIMIT, faviconPath,
} from '@/data/connectivity-import-lists.js';
import { planImport, isListFullyPresent } from '@/utils/connectivity-import.js';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, CirclePlus, Plus } from '@lucide/vue';

const props = defineProps({
  open: { type: Boolean, default: false },
});
const emit = defineEmits(['update:open']);

const { t } = useI18n();
const store = useMainStore();
const targets = computed(() => store.userPreferences.connectivityTargets || []);

// System defaults last — a recovery entry, not a suggestion.
const importableLists = [...IMPORT_LISTS, SYSTEM_IMPORT_LIST];

const tab = ref('import');
const importResult = ref('');

// Fresh state each time the dialog opens; focus the name field whenever the
// custom tab shows.
watch(() => props.open, (v) => {
  if (!v) return;
  tab.value = 'import';
  importResult.value = '';
  addName.value = '';
  addUrl.value = '';
  addError.value = '';
});
watch(tab, (v) => {
  if (v !== 'custom') return;
  nextTick(() => document.getElementById('custom-conn-name')?.focus());
});

// ── Curated lists ──────────────────────────────────────────────────────────
const importList = (list) => {
  const plan = planImport(list, targets.value);
  // All-or-nothing (enforced in planImport): a capacity shortfall stores
  // nothing, so the list is never half-imported behind a complete-looking ✓.
  if (plan.overflowCount) {
    importResult.value = t('connectivity.importDialog.NotEnoughCapacity', {
      need: plan.freshCount,
      free: plan.capacity,
    });
    return;
  }
  store.updatePreference('connectivityTargets', [...targets.value, ...plan.additions]);
  // Quiet on success — the button flips to a check.
  importResult.value = '';
  trackEvent('Section', 'ImportList', list.id);
};

// ── Custom add (migrated intact from ConnectivityTest.vue) ────────────────
const addName = ref('');
const addUrl = ref('');
const addError = ref('');

// Map the shared addError back to its field so aria-invalid only flags the
// offending Input (shadcn-vue's Input paints the red ring from that attr).
const isNameError = computed(() => addError.value === t('connectivity.addCustom.NameRequired'));
const isUrlError = computed(() => {
  const err = addError.value;
  return err === t('connectivity.addCustom.UrlRequired')
    || err === t('connectivity.addCustom.InvalidUrl');
});

// Bare domain → /favicon.ico (CDN-cached, fast & meaningful RTT).
// Explicit paths preserved so users can probe specific endpoints.
const normalizeTestUrl = (input) => {
  const raw = (input || '').trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withScheme);
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    if (parsed.pathname === '/' && !parsed.search) {
      return `${parsed.origin}/favicon.ico`;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const handleAdd = () => {
  addError.value = '';
  const name = addName.value.trim();
  const rawUrl = addUrl.value.trim();

  if (!name) {
    addError.value = t('connectivity.addCustom.NameRequired');
    return;
  }
  if (!rawUrl) {
    addError.value = t('connectivity.addCustom.UrlRequired');
    return;
  }
  const url = normalizeTestUrl(rawUrl);
  if (!url) {
    addError.value = t('connectivity.addCustom.InvalidUrl');
    return;
  }

  if (targets.value.length >= CONNECTIVITY_TARGET_LIMIT) {
    addError.value = t('connectivity.addCustom.LimitReached');
    return;
  }

  const newTarget = {
    id: `custom-${Date.now()}`,
    name: name.slice(0, 20),
    url,
  };
  store.updatePreference('connectivityTargets', [...targets.value, newTarget]);
  trackEvent('Section', 'AddCustomTarget', 'Connectivity');
  // Hand-add only — importList() deliberately doesn't emit this.
  emitAppEvent('connectivity:custom-added', { name: newTarget.name, url: newTarget.url });
  emit('update:open', false);
};
</script>
