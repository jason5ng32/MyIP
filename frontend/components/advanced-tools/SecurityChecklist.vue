<template>
    <!-- security checklist -->
    <div class="security-checklist-section my-4">
        <div class="text-neutral-500">
            <p>{{ t('securitychecklist.Note') }}</p>
            <p>{{ t('securitychecklist.Note2') }}</p>
        </div>

        <!-- 数据面板 -->
        <div v-if="fullList" class="mb-3">
            <div class="jn-card rounded-lg border bg-card text-card-foreground">
                <div class="p-4">
                    <div class="jn-title2 mb-3">
                        <h3 class="text-xl font-semibold"><i class="bi bi-card-checklist"></i> {{ t('securitychecklist.Progress') }}</h3>
                        <JnTooltip :text="t('securitychecklist.Reset')" side="left">
                            <Button size="icon" variant="outline"
                                @click="resetAllslugs()" aria-label="Reset Security Checklist">
                                <i class="bi bi-arrow-clockwise"></i>
                            </Button>
                        </JnTooltip>
                    </div>
                    <!-- 数据统计 -->
                    <div class="px-3 py-2 rounded-md border bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200 mb-3">
                        {{ t('securitychecklist.alert-total') }} {{ totalItems }} {{ t('securitychecklist.Items') }},
                        {{ t('securitychecklist.alert-checked') }} {{ checkedItems }} {{ t('securitychecklist.Items') }},
                        {{ ignoredItems }} {{ t('securitychecklist.Items') }}{{ t('securitychecklist.alert-ignored') }},
                        {{ uncheckedItems }} {{ t('securitychecklist.alert-unchecked') }}
                        <br />
                    </div>
                    <div class="flex flex-wrap justify-around">
                        <!-- 整体进度条 -->
                        <div class="w-full md:w-2/3" :class="isMobile ? 'mb-3' : ''">
                            <div class="jn-checklist-progress flex justify-between items-center mb-1"
                                v-for="item in categories" :key="item">
                                <span class="text-base shrink">{{ fullList[item].title }}</span>&nbsp;&nbsp;
                                <span class="flex h-2 grow overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                                    <div class="h-full bg-green-600"
                                        :style="getProgressStyle(item)('checked')"
                                        :title="t('securitychecklist.Checked')"></div>
                                    <div class="h-full bg-sky-500"
                                        :style="getProgressStyle(item)('ignored')"
                                        :title="t('securitychecklist.Ignored')"></div>
                                </span>
                            </div>
                        </div>
                        <!-- 按级别分的饼图 -->
                        <div class="w-full md:w-1/3 flex flex-wrap">
                            <div class="w-1/2" v-for="item in priorities" :key="item">
                                <div v-if="countItems({ action: 'total', category: 'all', priority: item }) - countItems({ action: 'ignored', category: 'all', priority: item }) !== 0">
                                    <CircleProgressBar
                                        :value="countItems({ action: 'checked', category: 'all', priority: item })"
                                        :max="countItems({ action: 'total', category: 'all', priority: item }) - countItems({ action: 'ignored', category: 'all', priority: item })"
                                        :colorFilled="'#198754'" :colorUnfilled="'#198754'"
                                        :colorBack="isDarkMode ? '#343a40' : '#e9ecef'" :size="'110pt'"
                                        :percentage="true" :strokeWidth="'10pt'">
                                        {{ t('securitychecklist.' + item) }}<br />
                                    </CircleProgressBar>
                                </div>
                                <div v-else>
                                    <CircleProgressBar :value="1" :max="1" :colorFilled="'#0dcaf0'"
                                        :colorUnfilled="'#198754'" :colorBack="isDarkMode ? '#343a40' : '#e9ecef'"
                                        :size="'110pt'" :strokeWidth="'10pt'">
                                        {{ t('securitychecklist.' + item) }}<br />{{ t('securitychecklist.Ignored') }}
                                    </CircleProgressBar>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div v-else class="mb-3">
            <div class="jn-card rounded-lg border bg-card text-card-foreground">
                <div class="p-4">
                    <div class="jn-placeholder">
                        <span>
                            <span class="inline-block h-3 w-3 rounded-full bg-green-600 animate-pulse" aria-hidden="true"></span>
                            <span class="text-green-600">&nbsp;{{ t('securitychecklist.Loading') }}</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 检查清单区域 -->
        <div v-if="fullList" class="flex flex-wrap -mx-2">
            <!-- 检查清单分类列表 -->
            <div class="w-full md:w-1/3 px-2 mb-3 jn-height">
                <div class="jn-card rounded-lg border bg-card text-card-foreground mb-2"
                    :class="{ 'jn-checklist-cat-card': item === currentList }"
                    v-for="(item, index) in categories" :key="item">
                    <div class="p-1">
                        <div @click="changeList(item, true)"
                            class="jn-btn flex justify-between items-center text-start"
                            :class="{ 'text-green-600 font-bold': item === currentList }">
                            <span :class="[isMobile ? 'mobile-h3' : 'text-base']">
                                <i class="bi" :class="fullList[item].icon"></i> {{ fullList[item].title }}&nbsp;({{
                                    countItems({ action: 'checked', category: item }) }}/{{
                                    countItems({ action: 'total', category: item }) - countItems({ action: 'ignored', category: item }) }})
                            </span>
                            <span class="jn-bi-font" v-if="countItems({ action: 'percentage', category: item }) === 100">
                                <i class="bi bi-check-circle-fill text-green-600"></i>
                            </span>
                            <span v-else>
                                <CircleProgressBar
                                    :value="countItems({ action: 'checked', category: item })"
                                    :max="countItems({ action: 'total', category: item }) - countItems({ action: 'ignored', category: item })"
                                    :size="'18pt'"
                                    :colorFilled="'#0dcaf0'" :colorUnfilled="'#198754'"
                                    :colorBack="isDarkMode ? '#343a40' : '#e9ecef'" :strokeWidth="'10pt'" />
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <!-- 检查清单分类详情 -->
            <div id="checklist" class="w-full md:w-2/3 px-2 mb-3 jn-checklist-card">
                <div class="jn-card rounded-lg border bg-card text-card-foreground">
                    <div class="p-4">
                        <h2 class="text-2xl font-semibold">
                            <i class="bi" :class="fullList[currentList].icon"></i> {{ fullList[currentList].title }}
                        </h2>
                        <Collapsible :open="isCategoryIntroOpen" @update:open="isCategoryIntroOpen = $event">
                            <p>{{ fullList[currentList].description }}
                                <CollapsibleTrigger v-if="fullList[currentList].intro" as-child>
                                    <i class="bi bi-info-circle"
                                        :aria-expanded="isCategoryIntroOpen" role="button"
                                        :aria-label="'Display Info of ' + fullList[currentList].title">
                                    </i>
                                </CollapsibleTrigger>
                            </p>
                            <CollapsibleContent class="leading-relaxed p-1">
                                <span class="opacity-75 text-sm">
                                    <vue-markdown :source="fullList[currentList].intro" />
                                </span>
                            </CollapsibleContent>
                        </Collapsible>
                        <div class="flex justify-between items-center">
                            <div class="flex-grow h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden"
                                role="progressbar"
                                :aria-label="'Progress for ' + fullList[currentList].title"
                                aria-valuemin="0" aria-valuemax="100">
                                <div class="h-full bg-green-600 transition-all"
                                    :style="'width: ' + countItems({ action: 'percentage', category: currentList }) + '%;'">
                                </div>
                            </div>
                            <div class="my-2 ms-3 opacity-75 shrink">
                                {{ countItems({ action: 'checked', category: currentList }) }}/{{
                                    countItems({ action: 'total', category: currentList }) - countItems({ action: 'ignored', category: currentList }) }}
                                ( {{ t('securitychecklist.Ignored') }}: {{ countItems({ action: 'ignored', category: currentList }) }})
                            </div>
                        </div>
                        <!-- Filter toggles -->
                        <div class="my-3 flex justify-start">
                            <ToggleGroup v-model="filterTag" type="single" @update:model-value="(v) => v && filterChecklist(v)">
                                <ToggleGroupItem value="all" :aria-label="t('securitychecklist.ShowAll')">
                                    <i class="bi bi-list-check"></i>
                                </ToggleGroupItem>
                                <ToggleGroupItem value="unchecked" :aria-label="t('securitychecklist.ShowUnchecked')">
                                    <i class="bi bi-circle"></i>
                                </ToggleGroupItem>
                                <ToggleGroupItem value="checked" :aria-label="t('securitychecklist.ShowChecked')">
                                    <i class="bi bi-check-circle"></i>
                                </ToggleGroupItem>
                                <ToggleGroupItem value="ignored" :aria-label="t('securitychecklist.ShowIgnored')">
                                    <i class="bi bi-pause-circle"></i>
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>

                        <!-- Checklist table -->
                        <div class="overflow-x-auto whitespace-nowrap">
                            <table class="w-full border-collapse">
                                <thead>
                                    <tr class="border-b border-neutral-200 dark:border-neutral-700">
                                        <th scope="col" class="text-left p-2">{{ t('securitychecklist.Item') }}</th>
                                        <th scope="col" class="text-left p-2">{{ t('securitychecklist.Priority') }}</th>
                                        <th scope="col" class="text-left p-2">{{ t('securitychecklist.Ignore') }}</th>
                                    </tr>
                                </thead>
                                <tbody v-for="(item, index) in filterList" :key="item">
                                    <tr>
                                        <td class="p-2" :class="{
                                            'jn-checked-item-light': item.checked,
                                            'jn-checked-item-dark': item.checked && isDarkMode
                                        }">
                                            <div class="flex items-center">
                                                <span @click="checkItem(item)">
                                                    <i class="bi text-lg cursor-pointer" :class="{
                                                        'bi-check-circle-fill text-green-600': item.checked,
                                                        'bi-pause-circle text-neutral-500': item.ignored,
                                                        'bi-circle': !item.checked && !item.ignored
                                                    }"></i>&nbsp;
                                                </span>
                                                <span :class="{ 'line-through opacity-50': item.ignored }">
                                                    {{ item.point }}
                                                    <i class="bi bi-info-circle cursor-pointer"
                                                        @click="toggleChecklistInfo(index)"
                                                        :aria-expanded="!!checklistInfoOpen[index]" role="button"
                                                        :aria-label="'Display Info of ' + item.point">
                                                    </i>
                                                </span>
                                            </div>
                                        </td>
                                        <td class="p-2" :class="{
                                            'jn-checked-item-light': item.checked,
                                            'jn-checked-item-dark': item.checked && isDarkMode
                                        }">
                                            <Badge class="rounded-full font-normal" :class="{
                                                'bg-neutral-900 text-white border-transparent': item.priority === 'Advanced',
                                                'bg-sky-500 text-white border-transparent': item.priority === 'Optional',
                                                'bg-green-600 text-white border-transparent': item.priority === 'Essential',
                                                'bg-blue-600 text-white border-transparent': item.priority === 'Basic'
                                            }">
                                                {{ t('securitychecklist.' + item.priority) }}
                                            </Badge>
                                        </td>
                                        <td class="p-2" :class="{
                                            'jn-checked-item-light': item.checked,
                                            'jn-checked-item-dark': item.checked && isDarkMode
                                        }">
                                            <Switch :model-value="item.ignored" @update:model-value="() => ignoreItem(item)" />
                                        </td>
                                    </tr>
                                    <tr v-show="checklistInfoOpen[index]">
                                        <td colspan="4" class="border-0 p-0">
                                            <div class="leading-relaxed p-1" :class="[isMobile ? 'jn-vw-m' : 'jn-vw']">
                                                <div class="p-3">
                                                    <span class="jn-info text-sm opacity-75">
                                                        <vue-markdown :source="item.details" />
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { CircleProgressBar } from 'circle-progress.vue';
import VueMarkdown from 'vue-markdown-render';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { JnTooltip } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// refactor/01 阶段 C：两处 Bootstrap collapse 迁移
const isCategoryIntroOpen = ref(false);
const checklistInfoOpen = ref({});
const toggleChecklistInfo = (index) => {
    checklistInfoOpen.value[index] = !checklistInfoOpen.value[index];
};

const { t, tm } = useI18n();

const securityChecklist = ref(tm('securitychecklistdata'));

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);
const isSignedIn = computed(() => store.isSignedIn);

const categories = ref([]);
const currentList = ref('authentication');
const slugs = ref({});

const priorities = ['Basic', 'Optional', 'Essential', 'Advanced'];

const setLocalSlugs = () => {
    localStorage.setItem('securityChecklistSlugs', JSON.stringify(slugs.value));
};

const loadLocalSlugs = () => {
    const storedSlugs = localStorage.getItem('securityChecklistSlugs');
    if (storedSlugs) {
        const parsedSlugs = JSON.parse(storedSlugs);
        Object.keys(parsedSlugs).forEach(key => {
            slugs.value[key] = parsedSlugs[key];
        });
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
        if (!categories.value.includes(item.slug)) {
            categories.value.push(item.slug);
        }
        transformedObject[item.slug] = {
            title: item.title,
            description: item.description,
            icon: item.icon,
            intro: item.intro,
            checklist: item.checklist.map(checkItem => {
                const checkItemSlug = checkItem.slug;
                if (slugs.value[checkItemSlug] === undefined) {
                    slugs.value[checkItemSlug] = '';
                }
                return {
                    ...checkItem,
                    checked: slugs.value[checkItemSlug] === 'checked',
                    ignored: slugs.value[checkItemSlug] === 'ignored',
                    slug: checkItemSlug
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
    for (const slug in slugs.value) {
        slugs.value[slug] = '';
    }
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
        scrollToElementInOffcanvas('checklist', 10);
    }
};

const filterChecklist = (filter) => {
    if (filter === 'all') {
        filterList.value = listToShow.value.checklist;
        filterTag.value = 'all';
    } else if (filter === 'ignored') {
        filterList.value = listToShow.value.checklist.filter(item => item.ignored);
        filterTag.value = 'ignored';
    } else if (filter === 'checked') {
        filterList.value = listToShow.value.checklist.filter(item => item.checked);
        filterTag.value = 'checked';
    } else if (filter === 'unchecked') {
        filterList.value = listToShow.value.checklist.filter(item => !item.checked && !item.ignored);
        filterTag.value = 'unchecked';
    }
};

const scrollToElementInOffcanvas = (el, offset = 0) => {
    const element = typeof el === "string" ? document.getElementById(el) : el;
    if (element) {
        let scrollContainer = element.closest('[data-state]') || window;
        const elementRect = element.getBoundingClientRect();
        if (scrollContainer === window) {
            window.scrollTo({ top: elementRect.top + window.scrollY - offset, behavior: "smooth" });
        } else {
            const scrollContainerRect = scrollContainer.getBoundingClientRect();
            const y = elementRect.top - scrollContainerRect.top + scrollContainer.scrollTop - offset;
            scrollContainer.scrollTo({ top: y, behavior: "smooth" });
        }
    }
};

const ignoreItem = (item) => {
    item.ignored = !item.ignored;
    item.checked = false;
    item.ignored ? updateSlugs(item.slug, 'ignored') : updateSlugs(item.slug, '');
};

const checkItem = (item) => {
    if (item.ignored) return;
    item.checked = !item.checked;
    item.checked ? updateSlugs(item.slug, 'checked') : updateSlugs(item.slug, '');
    if (isSignedIn.value) {
        updateAchievement();
    }
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
    return (action) => {
        return `width: ${countItems({ action, category }) / countItems({ action: 'total', category }) * 100}%`;
    };
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
    setTimeout(() => {
        changeList('authentication', false);
    }, 300);
});
</script>

<style scoped>
.jn-info {
    word-wrap: break-word;
    white-space: normal;
}

.jn-height {
    height: fit-content;
}

.jn-checked-item-light {
    background-color: #d1e7dd;
}

.jn-checked-item-dark {
    background-color: #042f1b !important;
}

.jn-btn {
    padding: 10pt;
    cursor: pointer;
}

.jn-checklist-card {
    min-height: 900pt;
}

.jn-bi-font {
    font-size: 18pt;
    height: 18pt;
    display: flex;
    align-items: center;
}

.jn-checklist-progress {
    margin-bottom: 5pt;
}

.jn-vw-m {
    max-width: 85vw;
}

.jn-vw {
    max-width: 576pt;
}

.jn-checklist-cat-card {
    position: relative;
    border: 1px solid #198754;
}
</style>
