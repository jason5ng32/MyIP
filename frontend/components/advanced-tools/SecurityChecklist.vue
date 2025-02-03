<template>
    <!-- security checklist -->
    <div class="security-checklist-section my-4">
        <div class="text-secondary">
            <p>{{ t('securitychecklist.Note') }}</p>
            <p>{{ t('securitychecklist.Note2') }}</p>
        </div>

        <!-- 数据面板 -->
        <div v-if="fullList" class="row">
            <div class="col-12 mb-3">
                <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body">
                        <div class="jn-title2 mb-3">
                            <h3><i class="bi bi-card-checklist"></i> {{ t('securitychecklist.Progress') }}</h3>
                            <button :title="t('securitychecklist.Reset')" @click="resetAllslugs()"
                                :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']"
                                aria-label="Reset Security Checklist"><i class="bi bi-arrow-clockwise"></i></button>
                        </div>
                        <!-- 数据统计 -->
                        <div class="alert alert-success">
                            {{ t('securitychecklist.alert-total') }} {{ totalItems }} {{ t('securitychecklist.Items')
                            }},
                            {{ t('securitychecklist.alert-checked') }} {{ checkedItems }} {{
                            t('securitychecklist.Items') }},
                            {{ ignoredItems }} {{ t('securitychecklist.Items') }}{{ t('securitychecklist.alert-ignored')
                            }},
                            {{ uncheckedItems }} {{ t('securitychecklist.alert-unchecked') }}
                            <br />
                        </div>
                        <div class="row justify-content-around">
                            <!-- 整体进度条 -->
                            <div class="col-lg-8 col-md-8 col-12" :class="isMobile ? 'mb-3' : ''">
                                <div class="jn-checklist-progress d-flex justify-content-between align-items-center"
                                    v-for="item in categories" :key="item">
                                    <span class="fs-6 flex-shrink-1">{{ fullList[item].title }}</span>&nbsp;&nbsp;
                                    <span class="progress-stacked flex-grow-1">
                                        <div class="progress" role="progre  ssbar" aria-label="Segment One"
                                            :style="getProgressStyle(item)('checked')">
                                            <div class="progress-bar bg-success"> {{ t('securitychecklist.Checked') }}
                                            </div>
                                        </div>

                                        <div class="progress" role="progressbar" aria-label="Segment two"
                                            :style="getProgressStyle(item)('ignored')">
                                            <div class="progress-bar bg-info"> {{ t('securitychecklist.Ignored') }}
                                            </div>
                                        </div>
                                    </span>
                                </div>

                            </div>
                            <!-- 按级别分的饼图 -->
                            <div class="col-lg-4 col-md-4 col-12 row">
                                <div class="col-6" v-for="item in priorities" :key="item">
                                    <div
                                        v-if=" countItems({ action: 'total', category: 'all', priority: item }) - countItems({ action: 'ignored', category: 'all', priority: item }) !== 0">
                                        <CircleProgressBar
                                            :value="countItems({ action: 'checked', category: 'all', priority: item }) "
                                            :max="countItems({ action: 'total', category: 'all', priority: item }) - countItems({ action: 'ignored', category: 'all', priority: item })"
                                            :colorFilled="'#198754'" :colorUnfilled="'#198754'"
                                            :colorBack="isDarkMode ? '#343a40':'#e9ecef'" :size="'110pt'"
                                            :percentage=true :strokeWidth="'10pt'">
                                            {{t('securitychecklist.'+ item)}}<br />
                                        </CircleProgressBar>
                                    </div>
                                    <div v-else>
                                        <CircleProgressBar :value="1" :max="1" :colorFilled="'#0dcaf0'"
                                            :colorUnfilled="'#198754'" :colorBack="isDarkMode ? '#343a40':'#e9ecef'"
                                            :size="'110pt'" :strokeWidth="'10pt'">
                                            {{t('securitychecklist.'+ item)}}<br />{{ t('securitychecklist.Ignored') }}
                                        </CircleProgressBar>
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>
                </div>
            </div>
        </div>
        <div v-else class="row">
            <div class="col-12 mb-3">
                <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body">
                        <div class="jn-placeholder ">
                            <span>
                                <span class="spinner-grow spinner-grow-sm text-success" aria-hidden="true"></span>
                                <span class="text-success">&nbsp;{{ t('securitychecklist.Loading') }}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- 检查清单区域 -->
        <div v-if="fullList" class="row">
            <!-- 检查清单分类列表 -->
            <div class="col-lg-4 col-md-4 col-12 mb-3 jn-height">
                <div class="card jn-card mb-2" :class="{ 
                    'dark-mode dark-mode-border': isDarkMode,
                    'jn-checklist-cat-card': item === currentList
                    }" v-for="(item, index) in categories">
                    <div class="card-body p-1">

                        <div @click="changeList(item,true)"
                            class="col-12 jn-btn d-flex justify-content-between align-items-center text-start" :class="{
                            'text-success fw-bold': item === currentList,
                        }">
                            <span :class="[isMobile ? 'mobile-h3' : 'fs-6']" class="jn-adv-title">
                                <i class="bi" :class="fullList[item].icon"></i> {{fullList[item].title}}&nbsp;({{
                                countItems({ action: 'checked', category: item }) }}/{{ countItems({ action:
                                'total', category: item }) -
                                countItems({ action: 'ignored', category: item }) }})
                            </span>
                            <span class="jn-bi-font"
                                v-if=" countItems({ action: 'percentage', category: item }) === 100 ">
                                <i class=" bi bi-check-circle-fill text-success"></i>
                            </span>
                            <span v-else>
                                <CircleProgressBar :value="countItems({ action: 'checked', category: item }) " :max="countItems({ action:
                                'total', category: item }) -
                                countItems({ action: 'ignored', category: item })" :size="'18pt'"
                                    :colorFilled="'#0dcaf0'" :colorUnfilled="'#198754'"
                                    :colorBack="isDarkMode ? '#343a40':'#e9ecef'" :strokeWidth="'10pt'" />
                            </span>

                        </div>

                    </div>
                </div>
            </div>
            <!-- 检查清单分类详情 -->
            <div id="checklist" class="col-lg-8 col-md-8 col-12 mb-3 jn-checklist-card">
                <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body">
                        <!-- 检查清单分类描述 -->
                        <h2> <i class="bi" :class="fullList[currentList].icon"></i> {{fullList[currentList].title}}</h2>
                        <p>{{fullList[currentList].description}}
                            <i v-if="fullList[currentList].intro" class="bi bi-info-circle" data-bs-toggle="collapse"
                                :data-bs-target="'#collapseCategoryIntro'" aria-expanded="false"
                                :aria-controls="'collapseCategoryIntro'" role="button"
                                :aria-label="'Display Info of ' + fullList[currentList].title">
                            </i>
                        </p>
                        <div class="collapse lh-lg p-1" :id="'collapseCategoryIntro'"
                            :data-bs-theme="isDarkMode ? 'dark' : ''">
                            <span class="opacity-75 fs-7">
                                <vue-markdown :source="fullList[currentList].intro" />
                            </span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="progress flex-grow-1" role="progressbar"
                                :aria-label="'Progress for ' + fullList[currentList].title" aria-valuemin="0"
                                aria-valuemax="100">
                                <div class="progress-bar bg-success"
                                    :style="'width: ' + countItems({ action: 'percentage', category: currentList }) + '%;'">
                                </div>
                            </div>
                            <div class="my-2 ms-3 opacity-75 flex-shrink-1">
                                {{ countItems({ action: 'checked', category: currentList }) }}/{{ countItems({ action:
                                'total', category: currentList }) -
                                countItems({ action: 'ignored', category: currentList }) }}
                                ( {{ t('securitychecklist.Ignored') }}: {{ countItems({ action: 'ignored', category:
                                currentList }) }})
                            </div>
                        </div>
                        <!-- 检查清单完成度切换按钮 -->
                        <div class="row my-3 justify-content-start">

                            <div class="btn-group col-3" role="group" aria-label="Checklist Filter">
                                <button :title="t('securitychecklist.ShowAll')" type="button"
                                    class="btn btn-outline-secondary"
                                    :class="{ 'btn-secondary text-white': filterTag === 'all' }"
                                    @click="filterChecklist('all')"><i class="bi bi-list-check"></i></button>
                                <button :title="t('securitychecklist.ShowUnchecked')" type="button"
                                    class="btn btn-outline-secondary"
                                    :class="{ 'btn-secondary text-white': filterTag === 'unchecked' }"
                                    @click="filterChecklist('unchecked')"><i class="bi bi-circle"></i></button>
                                <button :title="t('securitychecklist.ShowChecked')" type="button"
                                    class="btn btn-outline-secondary"
                                    :class="{ 'btn-secondary text-white': filterTag === 'checked' }"
                                    @click="filterChecklist('checked')"><i class="bi bi-check-circle"></i></button>
                                <button :title="t('securitychecklist.ShowIgnored')" type="button"
                                    class="btn btn-outline-secondary"
                                    :class="{ 'btn-secondary text-white': filterTag === 'ignored' }"
                                    @click="filterChecklist('ignored')"><i class="bi bi-pause-circle"></i></button>
                            </div>
                        </div>

                        <!-- 检查清单表格 -->
                        <div class="table-responsive text-nowrap">
                            <table class="table table-hover" :class="{ 'table-dark': isDarkMode }">
                                <thead>
                                    <tr>
                                        <th scope="col">{{ t('securitychecklist.Item') }}</th>
                                        <th scope="col">{{ t('securitychecklist.Priority') }}</th>
                                        <th scope="col">{{ t('securitychecklist.Ignore') }}</th>
                                    </tr>
                                </thead>
                                <tbody v-for="(item, index) in filterList" :key="item">
                                    <tr>
                                        <td :class="{ 
                                            'jn-checked-item-light': item.checked,
                                            'jn-checked-item-dark': item.checked && isDarkMode
                                            }" class="col-12">
                                            <div class="jn-row">
                                                <span @click="checkItem(item)">
                                                    <i class="bi fs-5" :class="{
                                                        'bi-check-circle-fill text-success jn-cursor': item.checked,
                                                        'bi-pause-circle text-secondary': item.ignored,
                                                        'bi-circle jn-cursor': !item.checked && !item.ignored
                                                    }"></i>&nbsp;
                                                </span>
                                                <span :class="{ 
                                        'text-decoration-line-through opacity-50': item.ignored
                                        }">
                                                    {{ item.point }}
                                                    <i class="bi bi-info-circle" data-bs-toggle="collapse"
                                                        :data-bs-target="'#collapseChecklistInfo-' + index"
                                                        aria-expanded="false"
                                                        :aria-controls="'collapseChecklistInfo-' + index" role="button"
                                                        :aria-label="'Display Info of ' + item.point">
                                                    </i>
                                                </span>
                                            </div>
                                        </td>
                                        <td :class="{ 
                                            'jn-checked-item-light': item.checked,
                                            'jn-checked-item-dark': item.checked && isDarkMode
                                            }">
                                            <span class="badge rounded-pill fw-light" :class="{
                                                    'bg-dark': item.priority === 'Advanced',
                                                    'bg-info': item.priority === 'Optional',
                                                    'bg-success': item.priority === 'Essential',
                                                    'bg-primary': item.priority === 'Basic'
                                                }">
                                                {{ t('securitychecklist.' + item.priority) }}
                                            </span>
                                        </td>
                                        <td :class="{ 
                                            'jn-checked-item-light': item.checked,
                                            'jn-checked-item-dark': item.checked && isDarkMode
                                            }" @click="ignoreItem(item)">
                                            <div class="form-check form-switch">
                                                <input class="form-check-input"
                                                    :class="[isDarkMode ? 'jn-check-dark' : 'jn-check-light']"
                                                    type="checkbox" role="switch" :checked="item.ignored">
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colspan="4" class="border-0 p-0 ">
                                            <div class="collapse lh-lg p-1" :class="[isMobile ? 'jn-vw-m' : 'jn-vw']"
                                                :id="'collapseChecklistInfo-' + index"
                                                :data-bs-theme="isDarkMode ? 'dark' : ''">
                                                <div class="p-3 ">
                                                    <span class="jn-info fs-7 opacity-75">
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
import VueMarkdown from 'vue-markdown-render'

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

const priorities = [
    'Basic',
    'Optional',
    'Essential',
    'Advanced'
]

// 本地存储
const setLocalSlugs = () => {
    localStorage.setItem('securityChecklistSlugs', JSON.stringify(slugs.value));
}

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
}

// 初始化列表
const initSecurityList = (securityChecklist) => {
    // 首先加载本地 slugs
    loadLocalSlugs();

    const transformedObject = {};
    // 遍历并重组对象
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

                // 检查本地 slugs 是否已包含此 slug，若没有，则添加
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

    // 更新本地存储
    setLocalSlugs();
    return transformedObject;
};

const fullList = ref(null);

// 重置
const resetAllslugs = () => {
    trackEvent('SecurityChecklist', 'SecurityChecklist', 'Reset');
    for (const slug in slugs.value) {
        slugs.value[slug] = '';
    }

    setLocalSlugs();
    fullList.value = initSecurityList(securityChecklist.value); // 4. 使用 securityChecklist.value
    listToShow.value = fullList.value[currentList.value];
    filterList.value = listToShow.value.checklist;
    filterTag.value = 'all';
}

// 切换列表
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

}

// 滚动 Offcanvas 的特定位置
const scrollToElementInOffcanvas = (el, offset = 0) => {
    const element = typeof el === "string" ? document.getElementById(el) : el;
    if (element) {
        let scrollContainer = element.closest('.offcanvas-body');
        if (!scrollContainer) {
            scrollContainer = window;
        }
        const elementRect = element.getBoundingClientRect();
        const scrollContainerRect = scrollContainer.getBoundingClientRect();
        const y = elementRect.top - scrollContainerRect.top + scrollContainer.scrollTop - offset;
        if (scrollContainer === window) {
            window.scrollTo({ top: y, behavior: "smooth" });
        } else {
            scrollContainer.scrollTo({ top: y, behavior: "smooth" });
        }
    }
};


// 忽略某一项
const ignoreItem = (item) => {
    item.ignored = !item.ignored;
    item.checked = false;
    item.ignored ? updateSlugs(item.slug, 'ignored') : updateSlugs(item.slug, '');
};

// 打勾某一项
const checkItem = (item) => {
    if (item.ignored) return;
    item.checked = !item.checked;
    item.checked ? updateSlugs(item.slug, 'checked') : updateSlugs(item.slug, '');
    if (isSignedIn.value) {
        updateAchievement();
    }

};

// 计数器
const countItems = ({ action, category, priority }) => {
    const categories = category === 'all' ? Object.keys(fullList.value) : [category];

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

    return categories.reduce((sum, cat) => {
        const checklist = fullList.value[cat]?.checklist;
        if (!checklist) return sum;

        const filteredItems = priority
            ? checklist.filter(item => item.priority === priority)
            : checklist;

        return sum + (actionMap[action] || (() => 0))(filteredItems);
    }, 0);
}

// 便利调用
const totalItems = computed(() => countItems({ action: 'total', category: 'all' }));
const checkedItems = computed(() => countItems({ action: 'checked', category: 'all' }));
const ignoredItems = computed(() => countItems({ action: 'ignored', category: 'all' }));
const uncheckedItems = computed(() => totalItems.value - checkedItems.value - ignoredItems.value);

// 便利调用百分比
const getProgressStyle = (category) => {
    return (action) => {
        return `width: ${countItems({ action, category }) / countItems({ action: 'total', category }) * 100}%`;
    };
};

// 更新成就
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

.jn-cursor:hover {
    cursor: pointer;
}

.jn-checked-item-light {
    background-color: #d1e7dd;
}

.jn-checked-item-dark {
    background-color: #042f1b !important;
}

.jn-row {
    display: flex;
    align-items: center;
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
    display: flex;
    flex-direction: row;
    align-content: center;
    align-items: center;
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