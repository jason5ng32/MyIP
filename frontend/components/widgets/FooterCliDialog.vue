<template>
  <!-- Command Line API dialog: opened from Footer.vue's Clients column when
       the curl domains are configured. -->
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent :title="t('curl.Title')">
      <DialogHeader :icon="Terminal" :title="t('curl.Title')" />

      <div class="space-y-3">
        <!-- Description -->
        <div class="space-y-1 text-xs font-mono">
          <p class="jn-comment"><span class="text-muted-foreground">{{ t('curl.Note1') }}</span></p>
          <p class="jn-comment">
            <span class="text-muted-foreground">{{ t('curl.Note2_1') }}
              <Badge variant="outline" class="text-success">curl</Badge> {{ t('curl.Note2_2') }}
            </span>
          </p>
          <p class="jn-comment">
            <span class="text-muted-foreground">
              <Badge variant="outline" class="text-success">geo</Badge> {{ t('curl.Note3') }}
            </span>
          </p>
        </div>

        <!-- 3 curl command blocks -->
        <div class="space-y-3">
          <div>
            <p class="jn-comment text-xs font-mono mb-1.5 text-muted-foreground">{{ t('curl.getIPv4') }}</p>
            <pre
              class="jn-curl bg-black text-neutral-100 rounded-md p-3 text-xs font-mono overflow-x-auto">curl {{ curl.ipv4Domain }}<span class="text-success">/geo</span></pre>
          </div>
          <div>
            <p class="jn-comment text-xs font-mono mb-1.5 text-muted-foreground">{{ t('curl.getIPv6') }}</p>
            <pre
              class="jn-curl bg-black text-neutral-100 rounded-md p-3 text-xs font-mono overflow-x-auto">curl {{ curl.ipv6Domain }}<span class="text-success">/geo</span></pre>
          </div>
          <div>
            <p class="jn-comment text-xs font-mono mb-1.5 text-muted-foreground">{{ t('curl.get6and4') }}</p>
            <pre
              class="jn-curl bg-black text-neutral-100 rounded-md p-3 text-xs font-mono overflow-x-auto">curl {{ curl.ipv64Domain }}<span class="text-success">/geo</span></pre>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup>
// Lazy CLI usage dialog for Footer.vue.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Terminal } from '@lucide/vue';

defineProps({
  open: { type: Boolean, default: false },
});
const emit = defineEmits(['update:open']);

const { t } = useI18n();
const store = useMainStore();
const curl = computed(() => store.curl);
</script>

<style scoped>
.jn-curl::before {
  content: '$ ';
  color: var(--muted-foreground);
  font-weight: 500;
  margin-right: 0.25rem;
  opacity: 0.7;
}

.jn-comment::before {
  content: '// ';
  color: var(--muted-foreground);
  font-weight: 500;
  opacity: 0.7;
}
</style>
