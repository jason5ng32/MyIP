<template>
    <!-- security checklist -->
    <div class="security-checklist-section my-4">
        <div class="text-secondary">
            <p>{{ t('securitychecklist.Note') }}</p>
            <p v-if="!isMobile">{{ t('securitychecklist.Note2') }}</p>
        </div>

        <div class="row">
            <div class="col-12 mb-3">
                <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body">
                        <div class="jn-title2 mb-3">
                            <h3>{{ t('securitychecklist.Progress') }}</h3>
                            <button @click="resetAllslugs()"
                                :class="['btn', isDarkMode ? 'btn-dark dark-mode-refresh' : 'btn-light']"
                                aria-label="Reset Security Checklist"><i class="bi bi-arrow-clockwise"></i></button>
                        </div>
                        <div class="alert alert-success">
                            {{ t('securitychecklist.alert-total') }} {{ countItems({ action: 'total', category: 'all' })
                            }} {{ t('securitychecklist.Items') }},
                            {{ t('securitychecklist.alert-checked') }} {{ countItems({ action: 'checked', category:
                            'all' }) }} {{ t('securitychecklist.Items') }},
                            {{ countItems({ action: 'ignored', category: 'all' }) }} {{ t('securitychecklist.Items')
                            }}{{ t('securitychecklist.alert-ignored') }}, {{ countItems({ action:
                            'total', category: 'all' }) - countItems({ action: 'checked', category: 'all' }) -
                            countItems({ action: 'ignored', category: 'all' }) }} {{
                            t('securitychecklist.alert-unchecked') }}
                            <br />
                        </div>
                        <div class="row">
                            <div class="col-lg-8 col-md-8 col-12" :class="isMobile ? 'mb-3' : ''">
                                <div class="jn-checklist-progress d-flex justify-content-between align-items-center"
                                    v-for="(item, index) in categories" :key="index">
                                    <span class="fs-6 flex-shrink-1">{{ fullList[item].title }}</span>&nbsp;&nbsp;
                                    <span class="progress-stacked flex-grow-1">
                                        <div class="progress" role="progressbar" aria-label="Segment One"
                                            :style="'width: '+ countItems({ action: 'checked', category: item }) / countItems({ action: 'total', category: item }) * 100 + '%'">
                                            <div class="progress-bar bg-success"> {{ t('securitychecklist.Checked') }}
                                            </div>
                                        </div>

                                        <div class="progress" role="progressbar" aria-label="Segment two"
                                            :style="'width: '+ countItems({ action: 'ignored', category: item }) / countItems({ action: 'total', category: item }) * 100 + '%'">
                                            <div class="progress-bar bg-info"> {{ t('securitychecklist.Ignored') }}
                                            </div>
                                        </div>
                                    </span>
                                </div>

                            </div>

                            <div class="col-lg-4 col-md-4 col-12 row">
                                <div class="col-6" v-for="(item, index) in priorities" :key="index">
                                    <div
                                        v-if=" countItems({ action: 'total', category: 'all', priority: item }) - countItems({ action: 'ignored', category: 'all', priority: item }) !== 0">
                                        <CircleProgressBar
                                            :value="countItems({ action: 'checked', category: 'all', priority: item }) "
                                            :max="countItems({ action: 'total', category: 'all', priority: item }) - countItems({ action: 'ignored', category: 'all', priority: item })"
                                            :colorFilled="'#198754'" :colorUnfilled="'#198754'"
                                            :colorBack="isDarkMode ? '#343a40':'#e9ecef'" :size="'100pt'"
                                            :percentage=true :strokeWidth="'10pt'">
                                            {{t('securitychecklist.'+ item)}}<br />
                                        </CircleProgressBar>
                                    </div>
                                    <div v-else>
                                        <CircleProgressBar :value="1" :max="1" :colorFilled="'#0dcaf0'"
                                            :colorUnfilled="'#198754'" :colorBack="isDarkMode ? '#343a40':'#e9ecef'"
                                            :size="'100pt'" :strokeWidth="'10pt'">
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

        <div class="row">
            <div class="col-lg-4 col-md-4 col-12 mb-3 jn-height">
                <div class="card jn-card mb-2" :class="{ 'dark-mode dark-mode-border': isDarkMode }"
                    v-for="(item, index) in categories">
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
                                v-if=" countItems({ action: 'percentage', category: item }) === '100' ">
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

            <div id="checklist" class="col-lg-8 col-md-8 col-12 mb-3 jn-checklist-card">
                <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body">
                        <h2> <i class="bi" :class="fullList[currentList].icon"></i> {{fullList[currentList].title}}</h2>
                        <p>{{fullList[currentList].description}}
                            <i class="bi bi-info-circle" data-bs-toggle="collapse"
                                :data-bs-target="'#collapseCategoryIntro'" aria-expanded="false"
                                :aria-controls="'collapseCategoryIntro'" role="button"
                                :aria-label="'Display Info of ' + fullList[currentList].title">
                            </i>
                        </p>
                        <div class="collapse lh-lg p-1" :id="'collapseCategoryIntro'"
                            :data-bs-theme="isDarkMode ? 'dark' : ''">
                            <span class="opacity-75">
                                <vue-markdown :source="fullList[currentList].intro" />
                            </span>
                        </div>

                        <div class="progress" role="progressbar"
                            :aria-label="'Progress for ' + fullList[currentList].title" aria-valuemin="0"
                            aria-valuemax="100">
                            <div class="progress-bar bg-success"
                                :style="'width: ' + countItems({ action: 'percentage', category: currentList }) + '%;'">
                            </div>
                        </div>
                        <div class="my-2 opacity-75">
                            {{ countItems({ action: 'checked', category: currentList }) }}/{{ countItems({ action:
                            'total', category: currentList }) -
                            countItems({ action: 'ignored', category: currentList }) }}
                            ( {{ t('securitychecklist.Ignored') }}: {{ countItems({ action: 'ignored', category:
                            currentList }) }})
                        </div>

                        <div class="table-responsive text-nowrap">
                            <table class="table table-hover" :class="{ 'table-dark': isDarkMode }">
                                <thead>
                                    <tr>
                                        <th scope="col">{{ t('securitychecklist.Item') }}</th>
                                        <th scope="col">{{ t('securitychecklist.Priority') }}</th>
                                        <th scope="col">{{ t('securitychecklist.Ignore') }}</th>
                                    </tr>
                                </thead>
                                <tbody v-for="(item, index) in listToShow.checklist" :key="index">
                                    <tr :class="{ 
                                        'text-decoration-line-through opacity-50': item.ignored
                                        }">
                                        <td :class="{ 
                                            'jn-checked-item-light': item.checked,
                                            'jn-checked-item-dark': item.checked && isDarkMode
                                            }" class="col-12">
                                            <div class="jn-row">
                                            <span @click="checkItem(item)" class="jn-cursor">
                                                <i class="bi fs-5"
                                                    :class="item.checked ? 'bi-check-circle-fill text-success' : 'bi-circle'"></i>
                                            </span>
                                            <span>
                                                &nbsp;{{ item.point }}
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
                                                <input class="form-check-input" type="checkbox" role="switch"
                                                    :checked="item.ignored">
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colspan="4" class="border-0 p-0 ">
                                            <div class="collapse lh-lg p-1" :id="'collapseChecklistInfo-' + index"
                                                :data-bs-theme="isDarkMode ? 'dark' : ''">
                                                <div class="p-3 ">
                                                    <span class="jn-info opacity-75">
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

const securityChecklist = reactive(tm('securitychecklistdata'));

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);

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

    const transformedObject = ref({});
    // 遍历并重组对象
    securityChecklist.forEach(item => {
        if (!categories.value.includes(item.slug)) {
            categories.value.push(item.slug);
        }

        transformedObject.value[item.slug] = {
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

// 初始化
const fullList = reactive(initSecurityList(securityChecklist));


// 重置
const resetAllslugs = () => {
    trackEvent('SecurityChecklist', 'SecurityChecklist', 'Reset');
    for (const slug in slugs.value) {
        slugs.value[slug] = '';
    }

    setLocalSlugs();
    fullList.value = initSecurityList(securityChecklist);
    listToShow.value = fullList.value[currentList.value];
}

// 切换列表
const listToShow = ref([]);
const changeList = (listName, shouldScroll = true) => {
    listToShow.value = fullList.value[listName];
    currentList.value = listName;

    if (shouldScroll) {
        trackEvent('SecurityChecklist', 'SecurityChecklist', 'ChangeList');
        scrollToElementInOffcanvas('checklist', 10);
    }
};

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
};

// 计数器
function countItems({ action, category, priority }) {
    // 如果 category 为 'all'，则使用所有类别，否则使用指定的类别
    const targetCategories = category === 'all' ? Object.keys(fullList.value) : [category];

    let totalLength = 0;
    let ignoredLength = 0;
    let checkedLength = 0;

    // 遍历所选类别
    targetCategories.forEach(cat => {
        const checklist = fullList.value[cat]?.checklist;
        if (!checklist) return;

        let filteredItems = checklist;

        // 应用优先级过滤，如果指定了优先级
        if (priority) {
            filteredItems = filteredItems.filter(item => item.priority === priority);
        }

        // 累加统计
        totalLength += filteredItems.length;
        ignoredLength += filteredItems.filter(item => item.ignored).length;
        checkedLength += filteredItems.filter(item => item.checked).length;
    });

    // 根据动作返回相应数据
    switch (action) {
        case 'total':
            return totalLength;
        case 'ignored':
            return ignoredLength;
        case 'checked':
            return checkedLength;
        case 'percentage':
            return (totalLength - ignoredLength) === 0 ? '100' : ((checkedLength / (totalLength - ignoredLength)) * 100).toFixed(0);
        default:
            // 当没有指定动作时，返回所有统计数据
            const activeLength = totalLength - ignoredLength;
            const percentage = activeLength > 0 ? ((checkedLength / activeLength) * 100).toFixed(0) : "0";
            return {
                total: totalLength,
                ignored: ignoredLength,
                checked: checkedLength,
                percentage: percentage
            };
    }
}


onMounted(() => {
    changeList('authentication', false);
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
    min-width: 400pt;
}

.jn-btn {
    padding: 10pt;
    cursor: pointer;
}

td {

    border-style: dashed;
    border-bottom-width: 1pt !important;
    border-color: #969696;
    border-left: 0;
    border-right: 0;
    border-top: 0;
}

.jn-checklist-card {
    min-height: 1200pt;
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

</style>