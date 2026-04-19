<template>
    <div class="security-checklist-section my-4 space-y-4">
        <!-- Top note -->
        <div class="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
            <p>{{ t('securitychecklist.Note') }}</p>
            <p>{{ t('securitychecklist.Note2') }}</p>
        </div>

        <!-- Loading state -->
        <div v-if="!fullList" class="flex items-center justify-center gap-2 py-8 text-sm">
            <Spinner class="text-info" />
            <span class="text-muted-foreground">{{ t('securitychecklist.Loading') }}</span>
        </div>

        <template v-else>
            <!-- Top progress panel -->
            <Card>
                <CardContent class="p-4 md:p-6 space-y-4">
                    <!-- Title bar -->
                    <header class="flex items-center justify-between gap-2">
                        <h3 class="flex items-center gap-2 text-base font-semibold m-0">
                            <ClipboardList class="size-4 text-muted-foreground" />
                            {{ t('securitychecklist.Progress') }}
                        </h3>
                        <JnTooltip :text="t('securitychecklist.Reset')" side="left">
                            <Button size="icon" variant="outline" @click="resetAllslugs()"
                                aria-label="Reset Security Checklist">
                                <RotateCw />
                            </Button>
                        </JnTooltip>
                    </header>

                    <!-- Statistical numbers -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div class="flex flex-col items-start p-3 rounded-md bg-muted/50">
                            <span class="text-xs text-muted-foreground">{{ t('securitychecklist.alert-total') }}</span>
                            <span class="text-xl font-semibold tabular-nums">{{ totalItems }}</span>
                        </div>
                        <div class="flex flex-col items-start p-3 rounded-md bg-success/10">
                            <span class="text-xs text-success">{{ t('securitychecklist.Checked') }}</span>
                            <span class="text-xl font-semibold tabular-nums text-success">{{ checkedItems }}</span>
                        </div>
                        <div class="flex flex-col items-start p-3 rounded-md bg-info/10">
                            <span class="text-xs text-info">{{ t('securitychecklist.Ignored') }}</span>
                            <span class="text-xl font-semibold tabular-nums text-info">{{ ignoredItems }}</span>
                        </div>
                        <div class="flex flex-col items-start p-3 rounded-md bg-muted/50">
                            <span class="text-xs text-muted-foreground">{{ t('securitychecklist.Unchecked') }}</span>
                            <span class="text-xl font-semibold tabular-nums">{{ uncheckedItems }}</span>
                        </div>
                    </div>

                    <!-- Left 2/3 category progress bar + right 1/3 priority circular chart -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <!-- Each category progress bar stacked (checked + ignored two segments) -->
                        <div class="md:col-span-2 space-y-2">
                            <div v-for="item in categories" :key="item" class="flex items-center gap-3 text-sm">
                                <span class="shrink-0 text-foreground/85 min-w-20 truncate">{{ fullList[item].title
                                    }}</span>
                                <span class="flex h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar">
                                    <div class="h-full bg-success transition-all"
                                        :style="getProgressStyle(item)('checked')"
                                        :title="t('securitychecklist.Checked')"></div>
                                    <div class="h-full bg-info transition-all"
                                        :style="getProgressStyle(item)('ignored')"
                                        :title="t('securitychecklist.Ignored')"></div>
                                </span>
                            </div>
                        </div>

                        <!-- 4 circular progress by priority -->
                        <div class="grid grid-cols-2 gap-2">
                            <div v-for="item in priorities" :key="item" class="flex justify-center">
                                <CircleProgressBar v-if="priorityDenom(item) !== 0"
                                    :value="countItems({ action: 'checked', category: 'all', priority: item })"
                                    :max="priorityDenom(item)" :colorFilled="progressColors.filled"
                                    :colorUnfilled="progressColors.filled" :colorBack="progressColors.back"
                                    :size="'90pt'" :percentage="true" :strokeWidth="'10pt'">
                                    <span class="text-xs">{{ t('securitychecklist.' + item) }}</span>
                                </CircleProgressBar>
                                <CircleProgressBar v-else :value="1" :max="1" :colorFilled="progressColors.info"
                                    :colorUnfilled="progressColors.filled" :colorBack="progressColors.back"
                                    :size="'90pt'" :strokeWidth="'10pt'">
                                    <span class="text-xs">{{ t('securitychecklist.' + item) }}</span>
                                    <br />
                                    <span class="text-[10px] text-muted-foreground">{{ t('securitychecklist.Ignored')
                                        }}</span>
                                </CircleProgressBar>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- Main body: left category navigation + right details -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Left 1/3: category navigation -->
                <nav class="space-y-1.5">
                    <button v-for="item in categories" :key="item" type="button" @click="changeList(item, true)"
                        class="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-sm text-left transition-colors border cursor-pointer"
                        :class="item === currentList
                            ? 'bg-success/10 border-success/40 text-success font-medium'
                            : 'bg-card border-border hover:bg-muted/50'">
                        <span class="flex items-center gap-2 min-w-0">
                            <component :is="getChecklistIcon(item)" class="size-4 shrink-0" />
                            <span class="truncate">{{ fullList[item].title }}</span>
                        </span>
                        <span class="shrink-0 flex items-center gap-1.5">
                            <!-- Right: completed 100% display ✓, otherwise display checked/total -->
                            <CircleCheck v-if="countItems({ action: 'percentage', category: item }) === 100"
                                class="size-4 text-success" />
                            <span v-else class="text-xs tabular-nums text-muted-foreground">
                                {{ countItems({ action: 'checked', category: item }) }}/{{
                                countItems({ action: 'total', category: item }) -
                                countItems({ action: 'ignored', category: item })
                                }}
                            </span>
                        </span>
                    </button>
                </nav>

                <!-- Right 2/3: current category details -->
                <div id="checklist" class="md:col-span-2">
                    <Card>
                        <CardContent class="p-4 md:p-6 space-y-4">
                            <!-- Category title + description + expandable intro -->
                            <header>
                                <h2 class="flex items-center gap-2 text-xl font-semibold tracking-tight m-0 mb-2">
                                    <component :is="getChecklistIcon(currentList)"
                                        class="size-5 text-muted-foreground" />
                                    {{ fullList[currentList].title }}
                                </h2>
                                <Collapsible :open="isCategoryIntroOpen" @update:open="isCategoryIntroOpen = $event">
                                    <p class="text-sm text-muted-foreground leading-relaxed">
                                        {{ fullList[currentList].description }}
                                        <CollapsibleTrigger v-if="fullList[currentList].intro" as-child>
                                            <button type="button"
                                                class="inline-flex items-center ml-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                :aria-expanded="isCategoryIntroOpen"
                                                :aria-label="'Display Info of ' + fullList[currentList].title">
                                                <Info class="size-3.5" />
                                            </button>
                                        </CollapsibleTrigger>
                                    </p>
                                    <CollapsibleContent>
                                        <div
                                            class="mt-2 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground leading-relaxed">
                                            <vue-markdown :source="fullList[currentList].intro" />
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </header>

                            <!-- Category progress bar + count -->
                            <div class="flex items-center gap-3">
                                <span class="flex h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar"
                                    :aria-label="'Progress for ' + fullList[currentList].title">
                                    <span class="h-full bg-success transition-all"
                                        :style="'width: ' + countItems({ action: 'percentage', category: currentList }) + '%'"></span>
                                </span>
                                <span class="text-xs text-muted-foreground tabular-nums shrink-0">
                                    {{ countItems({ action: 'checked', category: currentList }) }}/{{
                                    countItems({ action: 'total', category: currentList }) -
                                    countItems({ action: 'ignored', category: currentList })
                                    }}
                                    <span class="opacity-70">(ignored: {{ countItems({ action: 'ignored', category:
                                        currentList }) }})</span>
                                </span>
                            </div>

                            <!-- Filter Toggle -->
                            <div class="flex justify-start">
                                <ToggleGroup v-model="filterTag" type="single"
                                    @update:model-value="(v) => v && filterChecklist(v)">
                                    <ToggleGroupItem value="all" :aria-label="t('securitychecklist.ShowAll')">
                                        <ListChecks class="size-4" />
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="unchecked"
                                        :aria-label="t('securitychecklist.ShowUnchecked')">
                                        <Circle class="size-4" />
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="checked" :aria-label="t('securitychecklist.ShowChecked')">
                                        <CircleCheck class="size-4" />
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="ignored" :aria-label="t('securitychecklist.ShowIgnored')">
                                        <CirclePause class="size-4" />
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </div>

                            <!-- Item list -->
                            <ul class="rounded-lg border bg-card divide-y list-none p-0 m-0">
                                <li v-for="(item, index) in filterList" :key="item.slug" class="transition-colors"
                                    :class="item.checked ? 'bg-success/10' : 'hover:bg-muted/30'">
                                    <div class="flex items-start gap-3 px-3 py-2.5">
                                        <!-- Status switch button -->
                                        <button type="button" @click="checkItem(item)"
                                            class="shrink-0 mt-0.5 text-muted-foreground  cursor-pointer"
                                            :class="{ 'text-success': item.checked, 'text-muted-foreground/60 cursor-not-allowed': item.ignored }"
                                            :disabled="item.ignored" :aria-label="item.checked ? 'Uncheck' : 'Check'">
                                            <component
                                                :is="item.checked ? CircleCheck : item.ignored ? CirclePause : Circle"
                                                class="size-5" />
                                        </button>

                                        <!-- Item name + Info expand -->
                                        <div class="flex-1 min-w-0 text-sm">
                                            <div class="flex items-center gap-1.5"
                                                :class="{ 'line-through opacity-50': item.ignored }">
                                                <span>{{ item.point }}</span>
                                                <button type="button" @click="toggleChecklistInfo(index)"
                                                    class="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                                    :aria-expanded="!!checklistInfoOpen[index]"
                                                    :aria-label="'Display Info of ' + item.point">
                                                    <Info class="size-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <!-- Priority Badge -->
                                        <Badge class="shrink-0 rounded-full font-normal shadow-none"
                                            :class="priorityBadgeClass(item.priority)">
                                            {{ t('securitychecklist.' + item.priority) }}
                                        </Badge>

                                        <!-- Ignore Switch -->
                                        <Switch class="shrink-0" :model-value="item.ignored"
                                            @update:model-value="() => ignoreItem(item)"
                                            :aria-label="t('securitychecklist.Ignore')" />
                                    </div>

                                    <!-- Info details expand -->
                                    <div v-show="checklistInfoOpen[index]" class="px-3 pb-3 pt-1">
                                        <div class="p-3 rounded-md text-xs text-muted-foreground leading-relaxed">
                                            <vue-markdown :source="item.details" />
                                        </div>
                                    </div>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { CircleProgressBar } from 'circle-progress.vue';
import VueMarkdown from 'vue-markdown-render';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { JnTooltip } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Spinner } from '@/components/ui/spinner';
import {
    Banknote,
    Circle,
    CircleCheck,
    CirclePause,
    ClipboardList,
    Compass,
    FileWarning,
    HousePlus,
    Info,
    KeyRound,
    Laptop,
    ListChecks,
    Mail,
    MessageCircle,
    RotateCw,
    ScanFace,
    ShieldHalf,
    Smartphone,
    Users,
} from 'lucide-vue-next';

// Security checklist icon mapping: directly use slug as key (slug itself is a semantic category name)
const checklistIconMap = {
    'authentication': KeyRound,
    'web-browsing': Compass,
    'email': Mail,
    'messaging': MessageCircle,
    'social-media': Users,
    'networks': ShieldHalf,
    'mobile-devices': Smartphone,
    'personal-computers': Laptop,
    'smart-home': HousePlus,
    'personal-finance': Banknote,
    'human-aspect': ScanFace,
    'physical-security': FileWarning,
};
const getChecklistIcon = (slug) => checklistIconMap[slug] || Info;

const isCategoryIntroOpen = ref(false);
const checklistInfoOpen = ref({});
const toggleChecklistInfo = (index) => {
    checklistInfoOpen.value[index] = !checklistInfoOpen.value[index];
};

const { t, tm } = useI18n();

const securityChecklist = ref(tm('securitychecklistdata'));

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isSignedIn = computed(() => store.isSignedIn);

const categories = ref([]);
const currentList = ref('authentication');
const slugs = ref({});

const priorities = ['Basic', 'Optional', 'Essential', 'Advanced'];

// Priority Badge color: Basic → action (blue); Essential → success (green);
// Optional → info (sky); Advanced → secondary (neutral);
const priorityBadgeClass = (priority) => {
    const map = {
        Basic: 'bg-action text-action-foreground border-transparent',
        Essential: 'bg-success text-success-foreground border-transparent',
        Optional: 'bg-info text-info-foreground border-transparent',
        Advanced: 'bg-secondary text-secondary-foreground border-transparent',
    };
    return map[priority] || '';
};

// CircleProgressBar color: third-party library takes hex string, keep semantic color intention consistent:
// filled use green-500, info (incomplete state) use sky-500, background has neutral value in light/dark mode
const progressColors = computed(() => ({
    filled: '#22c55e', // green-500
    info: '#0ea5e9', // sky-500
    back: isDarkMode.value ? '#262626' : '#e5e5e5', // neutral-800 / neutral-200
}));

// Denominator by priority (total items - ignored)
const priorityDenom = (priority) =>
    countItems({ action: 'total', category: 'all', priority }) -
    countItems({ action: 'ignored', category: 'all', priority });

// Local persistence
const setLocalSlugs = () => {
    localStorage.setItem('securityChecklistSlugs', JSON.stringify(slugs.value));
};

const loadLocalSlugs = () => {
    const storedSlugs = localStorage.getItem('securityChecklistSlugs');
    if (storedSlugs) {
        const parsedSlugs = JSON.parse(storedSlugs);
        Object.keys(parsedSlugs).forEach(key => { slugs.value[key] = parsedSlugs[key]; });
    }
};

const updateSlugs = (slug, value) => {
    slugs.value[slug] = value;
    setLocalSlugs();
};

const initSecurityList = (securityChecklist) => {
    loadLocalSlugs();
    const transformedObject = {};
    securityChecklist.forEach(item => {
        if (!categories.value.includes(item.slug)) categories.value.push(item.slug);
        transformedObject[item.slug] = {
            title: item.title,
            description: item.description,
            intro: item.intro,
            checklist: item.checklist.map(checkItem => {
                const checkItemSlug = checkItem.slug;
                if (slugs.value[checkItemSlug] === undefined) slugs.value[checkItemSlug] = '';
                return {
                    ...checkItem,
                    checked: slugs.value[checkItemSlug] === 'checked',
                    ignored: slugs.value[checkItemSlug] === 'ignored',
                    slug: checkItemSlug,
                };
            }),
        };
    });
    setLocalSlugs();
    return transformedObject;
};

const fullList = ref(null);

const resetAllslugs = () => {
    trackEvent('SecurityChecklist', 'SecurityChecklist', 'Reset');
    for (const slug in slugs.value) slugs.value[slug] = '';
    setLocalSlugs();
    fullList.value = initSecurityList(securityChecklist.value);
    listToShow.value = fullList.value[currentList.value];
    filterList.value = listToShow.value.checklist;
    filterTag.value = 'all';
};

const filterList = ref({});
const listToShow = ref([]);
const filterTag = ref('all');

const changeList = (listName, shouldScroll = true) => {
    const previousList = currentList.value;
    listToShow.value = fullList.value[listName];
    filterList.value = listToShow.value.checklist;
    currentList.value = listName;
    filterTag.value = 'all';
    if (shouldScroll) {
        if (previousList !== currentList.value) {
            trackEvent('SecurityChecklist', 'SecurityChecklist', 'ChangeList');
        }
        // Use scrollIntoView({ block: 'nearest' }) to let the browser decide whether to scroll:
        // - Desktop navigation and details side by side visible → no-op
        // - Mobile vertical stack → automatically scroll to details
        // The original scrollToElementInOffcanvas uses .closest('[data-state]') to find the container,
        // which will incorrectly match the DrawerContent root (overflow:hidden cannot be scrolled), causing scroll exceptions
        nextTick(() => {
            const el = document.getElementById('checklist');
            el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    }
};

const filterChecklist = (filter) => {
    filterTag.value = filter;
    if (filter === 'all') filterList.value = listToShow.value.checklist;
    else if (filter === 'ignored') filterList.value = listToShow.value.checklist.filter(item => item.ignored);
    else if (filter === 'checked') filterList.value = listToShow.value.checklist.filter(item => item.checked);
    else if (filter === 'unchecked') filterList.value = listToShow.value.checklist.filter(item => !item.checked && !item.ignored);
};

const ignoreItem = (item) => {
    item.ignored = !item.ignored;
    item.checked = false;
    updateSlugs(item.slug, item.ignored ? 'ignored' : '');
};

const checkItem = (item) => {
    if (item.ignored) return;
    item.checked = !item.checked;
    updateSlugs(item.slug, item.checked ? 'checked' : '');
    if (isSignedIn.value) updateAchievement();
};

const countItems = ({ action, category, priority }) => {
    const categoriesArr = category === 'all' ? Object.keys(fullList.value) : [category];
    const actionMap = {
        total: (items) => items.length,
        ignored: (items) => items.filter(item => item.ignored).length,
        checked: (items) => items.filter(item => item.checked).length,
        percentage: (items) => {
            const total = items.length;
            const ignored = items.filter(item => item.ignored).length;
            const checked = items.filter(item => item.checked).length;
            const denominator = total - ignored;
            return denominator === 0 ? 100 : Math.round((checked / denominator) * 100);
        },
    };
    return categoriesArr.reduce((sum, cat) => {
        const checklist = fullList.value[cat]?.checklist;
        if (!checklist) return sum;
        const filteredItems = priority ? checklist.filter(item => item.priority === priority) : checklist;
        return sum + (actionMap[action] || (() => 0))(filteredItems);
    }, 0);
};

const totalItems = computed(() => countItems({ action: 'total', category: 'all' }));
const checkedItems = computed(() => countItems({ action: 'checked', category: 'all' }));
const ignoredItems = computed(() => countItems({ action: 'ignored', category: 'all' }));
const uncheckedItems = computed(() => totalItems.value - checkedItems.value - ignoredItems.value);

const getProgressStyle = (category) => {
    return (action) =>
        `width: ${countItems({ action, category }) / countItems({ action: 'total', category }) * 100}%`;
};

const updateAchievement = () => {
    if (!store.userAchievements.SurfaceCheck.achieved && checkedItems.value) {
        store.setTriggerUpdateAchievements('SurfaceCheck');
    } else if (!store.userAchievements.HalfwayThere.achieved && checkedItems.value / totalItems.value > 0.5) {
        store.setTriggerUpdateAchievements('HalfwayThere');
    } else if (!store.userAchievements.FullySecured.achieved && checkedItems.value === totalItems.value) {
        store.setTriggerUpdateAchievements('FullySecured');
    }
};

onMounted(() => {
    fullList.value = initSecurityList(securityChecklist.value);
    setTimeout(() => { changeList('authentication', false); }, 300);
});
</script>
