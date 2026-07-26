<!-- InfoBanner — fade-slide section banner that upsells an advanced tool
     after a homepage test settles (Connectivity → Service Status, DNS Leak
     → Enhanced DNS Leak Test, …). Callers pass show / icon / copy / action. -->
<template>
  <Transition name="fade-slide">
    <div v-if="show"
      class="mt-3 flex flex-col md:flex-row items-start gap-3 rounded-lg border border-info/30 bg-info/5 p-4 md:p-5">
      <div class="flex-1 min-w-0 space-y-1.5">
        <h3 class="text-sm font-semibold m-0 flex items-center gap-2 mb-2">
          <component :is="icon" class="size-4 text-info shrink-0" />
          {{ title }}
        </h3>
        <p class="text-sm text-muted-foreground leading-relaxed m-0">
          {{ note }}
        </p>
      </div>
      <div class="w-full md:w-auto md:self-stretch flex justify-end items-end md:items-center">
        <Button variant="action" size="sm" @click="emit('action')" class="shrink-0 cursor-pointer">
          <span>{{ cta }}</span>
          <ArrowRight class="size-4 ml-1" />
        </Button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { Button } from '@/components/ui/button';
import { ArrowRight } from '@lucide/vue';

defineProps({
  show: { type: Boolean, default: false },
  icon: { type: [Object, Function], required: true },
  title: { type: String, required: true },
  note: { type: String, required: true },
  cta: { type: String, required: true },
});

const emit = defineEmits(['action']);
</script>

<style scoped>
.fade-slide-enter-active {
  transition: all 0.3s ease-out;
}

.fade-slide-leave-active {
  transition: all 0.2s ease-out;
}

.fade-slide-enter-from {
  transform: translateY(10px);
  opacity: 0;
}

.fade-slide-leave-to {
  opacity: 0;
}
</style>
