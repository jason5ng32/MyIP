<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <!-- One fixed desktop width (Help.vue precedent); the custom-form tab
         centers its narrower content instead of resizing the dialog. -->
    <DialogContent class="md:max-w-2xl md:min-h-165">
      <DialogHeader :icon="CirclePlus" :title="t('connectivity.importDialog.Title')" />

      <Tabs v-model="tab" class="w-full">
        <TabsList class="grid w-full grid-cols-3 mb-3">
          <TabsTrigger value="import" class="cursor-pointer">
            {{ t('connectivity.importDialog.ImportOption') }}</TabsTrigger>
          <TabsTrigger value="custom" class="cursor-pointer">
            {{ t('connectivity.importDialog.CustomOption') }}</TabsTrigger>
          <TabsTrigger value="lists" class="cursor-pointer">
            {{ t('connectivity.lists.Tab') }}</TabsTrigger>
        </TabsList>

        <!-- Curated lists; the system defaults close the grid as a recovery
             entry. Each row's + opens a destination menu: any existing list
             (inert once fully present) or a fresh list named after the
             curated one. -->
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
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button size="icon" variant="outline" class="size-8 shrink-0 cursor-pointer"
                    :title="t('connectivity.importDialog.Import')"
                    :aria-label="t('connectivity.importDialog.Import')">
                    <Plus class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem v-for="dest in lists" :key="dest.id" class="cursor-pointer"
                    :disabled="isListFullyPresent(list, dest)" @select="importIntoExisting(list, dest.id)">
                    <Check class="size-4" :class="isListFullyPresent(list, dest) ? 'text-success' : 'invisible'" />
                    <span class="min-w-0 max-w-64 truncate">{{ listName(dest) }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="cursor-pointer" :disabled="lists.length >= CONNECTIVITY_LIST_LIMIT"
                    @select="importToNewList(list)">
                    <Plus class="size-4" />
                    <span>{{ t('connectivity.importDialog.ImportAsNew') }}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          </ul>
          <!-- Success stays quiet; only cap / list-limit errors show here. -->
          <div class="flex items-center justify-end min-h-4 text-xs">
            <span aria-live="polite" class="text-destructive">{{ importResult || '&nbsp;' }}</span>
          </div>
        </TabsContent>

        <!-- Custom add: single-site form; the destination row only appears
             once a second list exists. -->
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
            <div v-if="lists.length > 1" class="space-y-1.5">
              <Label>{{ t('connectivity.importDialog.Destination') }}</Label>
              <Select v-model="destListId">
                <SelectTrigger class="w-full shadow-none">
                  <SelectValue><span class="truncate">{{ destList ? listName(destList) : '—' }}</span></SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="list in lists" :key="list.id" :value="list.id">
                    <span class="block max-w-96 truncate">{{ listName(list) }}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="mb-2 space-y-1 text-xs text-muted-foreground leading-relaxed">
              <p>{{ t('connectivity.addCustom.Hint') }}</p>
              <p>{{ t('connectivity.addCustom.ProbeBlockedNote') }}</p>
            </div>
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

        <!-- List management: create, rename, reorder, delete. Guards live
             in utils/connectivity-lists.js. -->
        <TabsContent value="lists" class="space-y-3">
          <div class="flex items-center gap-2">
            <Input id="new-conn-list" v-model="newListName"
              :placeholder="t('connectivity.lists.NewListPlaceholder')" autocomplete="off" autocorrect="off"
              autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true"
              @keyup.enter="handleCreateList" :maxlength="CONNECTIVITY_LIST_NAME_LIMIT" />
            <Button variant="action" type="button" class="shrink-0 cursor-pointer" @click="handleCreateList"
              :disabled="newListName.trim().length === 0 || lists.length >= CONNECTIVITY_LIST_LIMIT">
              {{ t('connectivity.lists.Create') }}
            </Button>
          </div>
          <ul class="rounded-lg border bg-card divide-y max-h-[48vh] overflow-y-auto">
            <li v-for="(list, index) in lists" :key="list.id" class="flex items-center gap-2 p-3">
              <template v-if="renamingId === list.id">
                <Input v-model="renameDraft" class="h-9 flex-1" autocomplete="off" data-1p-ignore
                  data-lpignore="true" :maxlength="CONNECTIVITY_LIST_NAME_LIMIT" @keyup.enter="confirmRename(list)"
                  @keyup.esc="renamingId = null" />
                <Button size="icon" variant="outline" class="size-8 shrink-0 cursor-pointer"
                  @click="confirmRename(list)" :title="t('connectivity.lists.Save')"
                  :aria-label="t('connectivity.lists.Save')">
                  <Check class="size-4" />
                </Button>
                <Button size="icon" variant="ghost" class="size-8 shrink-0 cursor-pointer"
                  @click="renamingId = null" :title="t('connectivity.lists.Cancel')"
                  :aria-label="t('connectivity.lists.Cancel')">
                  <X class="size-4" />
                </Button>
              </template>
              <template v-else>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-sm font-medium">{{ listName(list) }}</span>
                  <span class="text-xs text-muted-foreground">
                    {{ t('connectivity.importDialog.SiteCount', { n: list.members.length }) }}</span>
                </span>
                <Button size="icon" variant="ghost" class="size-8 shrink-0 cursor-pointer"
                  :disabled="index === 0" @click="handleMove(list, -1)" :title="t('connectivity.lists.MoveUp')"
                  :aria-label="t('connectivity.lists.MoveUp')">
                  <ChevronUp class="size-4" />
                </Button>
                <Button size="icon" variant="ghost" class="size-8 shrink-0 cursor-pointer"
                  :disabled="index === lists.length - 1" @click="handleMove(list, 1)"
                  :title="t('connectivity.lists.MoveDown')" :aria-label="t('connectivity.lists.MoveDown')">
                  <ChevronDown class="size-4" />
                </Button>
                <Button v-if="list.id !== MINE_LIST_ID" size="icon" variant="ghost"
                  class="size-8 shrink-0 cursor-pointer" @click="startRename(list)"
                  :title="t('connectivity.lists.Rename')" :aria-label="t('connectivity.lists.Rename')">
                  <Pencil class="size-4" />
                </Button>
                <Button size="icon" variant="ghost"
                  class="size-8 shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                  :disabled="list.id === MINE_LIST_ID || list.members.length > 0" @click="handleDelete(list)"
                  :title="deleteHint(list)" :aria-label="t('connectivity.lists.Delete')">
                  <Trash2 class="size-4" />
                </Button>
              </template>
            </li>
          </ul>
          <div class="flex items-center justify-between gap-2 min-h-4 text-xs text-muted-foreground">
            <span aria-live="polite" class="text-destructive">{{ listError || '&nbsp;' }}</span>
            <span class="tabular-nums shrink-0">{{ lists.length }}/{{ CONNECTIVITY_LIST_LIMIT }}</span>
          </div>
          <p class="text-xs text-muted-foreground leading-relaxed">{{ t('connectivity.lists.Hint') }}</p>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>

<script setup>
// Tabbed dialog behind the Connectivity "Add Test" tile and the header
// menu's manage entry: import a curated list, hand-add a custom target, or
// manage the lists themselves. All mutations go through the pure ops in
// utils/connectivity-lists.js and persist into connectivityLists.
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent } from '@/utils/app-events';
import {
  IMPORT_LISTS, SYSTEM_IMPORT_LIST, CONNECTIVITY_LIST_LIMIT, CONNECTIVITY_LIST_NAME_LIMIT, MINE_LIST_ID, faviconPath,
} from '@/data/connectivity-import-lists.js';
import {
  isListFullyPresent, importIntoList, importAsNewList, addMember, createList, renameList, moveList, deleteList,
} from '@/utils/connectivity-lists.js';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Check, ChevronDown, ChevronUp, CirclePlus, Pencil, Plus, Trash2, X,
} from '@lucide/vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  // Which tab to open on ('import' | 'custom' | 'lists').
  initialTab: { type: String, default: 'import' },
  // The list currently shown in the grid — the custom form's default destination.
  activeListId: { type: String, default: MINE_LIST_ID },
});
const emit = defineEmits(['update:open']);

const { t } = useI18n();
const store = useMainStore();
const lists = computed(() => store.userPreferences.connectivityLists?.lists || []);

const updateLists = (nextLists) => {
  store.updatePreference('connectivityLists', {
    ...store.userPreferences.connectivityLists,
    lists: nextLists,
  });
};

// Mine's stored name is null — its display name is localized.
const listName = (list) => (list.id === MINE_LIST_ID ? t('connectivity.lists.Mine') : list.name);

// System defaults last — a recovery entry, not a suggestion.
const importableLists = [...IMPORT_LISTS, SYSTEM_IMPORT_LIST];

const tab = ref('import');
const importResult = ref('');
const listError = ref('');

// The custom form's destination. Falls back to Mine when the selected list
// disappears (deleted from the lists tab while open).
const destListId = ref(MINE_LIST_ID);
const destList = computed(() => lists.value.find((l) => l.id === destListId.value));
watch(lists, () => {
  if (!destList.value) destListId.value = MINE_LIST_ID;
});

// Fresh state each time the dialog opens; focus the name field whenever the
// custom tab shows.
watch(() => props.open, (v) => {
  if (!v) return;
  tab.value = props.initialTab;
  destListId.value = lists.value.some((l) => l.id === props.activeListId) ? props.activeListId : MINE_LIST_ID;
  importResult.value = '';
  listError.value = '';
  addName.value = '';
  addUrl.value = '';
  addError.value = '';
  newListName.value = '';
  renamingId.value = null;
});
watch(tab, (v) => {
  if (v !== 'custom') return;
  nextTick(() => document.getElementById('custom-conn-name')?.focus());
});

// ── Curated-list import ────────────────────────────────────────────────────
const importIntoExisting = (curated, listId) => {
  const result = importIntoList(lists.value, listId, curated);
  if (result.error === 'capacity') {
    importResult.value = t('connectivity.importDialog.NotEnoughCapacity', {
      need: result.plan.freshCount,
      free: result.plan.capacity,
    });
    return;
  }
  if (result.error) return;
  updateLists(result.lists);
  importResult.value = '';
  trackEvent('Section', 'ImportList', curated.id);
};

const importToNewList = (curated) => {
  const result = importAsNewList(lists.value, curated, t('connectivity.importLists.' + curated.id));
  if (result.error === 'list-limit') {
    importResult.value = t('connectivity.lists.LimitReached', { limit: CONNECTIVITY_LIST_LIMIT });
    return;
  }
  if (result.error) return;
  updateLists(result.lists);
  importResult.value = '';
  trackEvent('Section', 'ImportList', curated.id);
  trackEvent('Section', 'CreateConnectivityList', 'Connectivity');
};

// ── Custom add ─────────────────────────────────────────────────────────────
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

  const newTarget = {
    id: `custom-${Date.now()}`,
    name: name.slice(0, 20),
    url,
  };
  const result = addMember(lists.value, destListId.value, newTarget);
  if (result.error) {
    addError.value = t('connectivity.addCustom.LimitReached');
    return;
  }
  updateLists(result.lists);
  trackEvent('Section', 'AddCustomTarget', 'Connectivity');
  // Hand-add only — the import paths deliberately don't emit this.
  emitAppEvent('connectivity:custom-added', { name: newTarget.name, url: newTarget.url });
  emit('update:open', false);
};

// ── List management ────────────────────────────────────────────────────────
const newListName = ref('');
const renamingId = ref(null);
const renameDraft = ref('');

// Op error code → localized message (only the codes the buttons can't
// prevent).
const listErrorMessage = (code) => {
  if (code === 'list-limit') return t('connectivity.lists.LimitReached', { limit: CONNECTIVITY_LIST_LIMIT });
  if (code === 'name-required') return t('connectivity.addCustom.NameRequired');
  return '';
};

const applyListOp = (result) => {
  if (result.error) {
    listError.value = listErrorMessage(result.error);
    return false;
  }
  listError.value = '';
  updateLists(result.lists);
  return true;
};

const handleCreateList = () => {
  if (applyListOp(createList(lists.value, newListName.value))) {
    newListName.value = '';
    trackEvent('Section', 'CreateConnectivityList', 'Connectivity');
  }
};

const startRename = (list) => {
  renamingId.value = list.id;
  renameDraft.value = list.name || '';
};

const confirmRename = (list) => {
  if (applyListOp(renameList(lists.value, list.id, renameDraft.value))) {
    renamingId.value = null;
    trackEvent('Section', 'RenameConnectivityList', 'Connectivity');
  }
};

const handleMove = (list, direction) => {
  applyListOp(moveList(lists.value, list.id, direction));
};

const handleDelete = (list) => {
  if (applyListOp(deleteList(lists.value, list.id))) {
    trackEvent('Section', 'DeleteConnectivityList', 'Connectivity');
  }
};

// Disabled-delete tooltip says why: Mine is permanent, others must be empty.
const deleteHint = (list) => {
  if (list.id === MINE_LIST_ID) return t('connectivity.lists.MineUndeletable');
  if (list.members.length > 0) return t('connectivity.lists.DeleteNotEmpty');
  return t('connectivity.lists.Delete');
};
</script>
