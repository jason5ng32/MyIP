<template>
    <!-- Help Modal -->
    <div class="modal fade" id="helpModal" tabindex="-1" aria-labelledby="helpModal" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                <div class="modal-header" :class="{ 'dark-mode-border': isDarkMode }">
                    <h5 class="modal-title" id="helpModal">{{ $t('helpModal.Title') }}</h5>
                    <button type="button" class="btn-close" :class="{ 'dark-mode-close-button': isDarkMode }"
                        data-bs-dismiss="modal" aria-label="Close"></button>

                </div>
                <div class="modal-body" :class="{ 'dark-mode': isDarkMode }">
                    <p class="jn-help-note "><i class="bi bi-hand-thumbs-up-fill"></i>
                        {{ $t('shortcutKeys.HelpNote') }}
                    </p>
                    <div v-for="(key, index) in keyMap" :key="key.keys" class="row p-2 jn-shortcut-row"
                        :class="[isDarkMode ? 'border-dark-subtle jn-dark-mode-help-border' : 'border-light-subtle', index === keyMap.length - 1 ? 'jn-border-bottom-none' : '']">
                        <div class="col">
                            <kbd :class="{ 'text-bg-light': isDarkMode }">
                                {{ key.keys.replace(/[\[\]\\\(\)]/g, '') }}
                            </kbd>
                        </div>
                        <div class="col-8">{{ key.description }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { Modal } from 'bootstrap';

export default {
    name: 'HelpModal',
    
    // 引入 Store
    setup() {
        const store = useStore();
        const isDarkMode = computed(() => store.state.isDarkMode);
        const isMobile = computed(() => store.state.isMobile);

        return {
            isDarkMode,
            isMobile
        };
    },

    data() {
        return {
            keyMap: [],
        }
    },

    methods: {

    }
}
</script>

<style scoped></style>
