<template>
  <!-- About / Acknowledgement / Changelog side sheet opened from Footer.vue. -->
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="right" :title="t('about.Title')"
      class="flex flex-col p-0 gap-0 w-full max-w-full md:w-125 md:max-w-125">
      <Tabs :model-value="tab" @update:model-value="emit('update:tab', $event)" class="flex flex-col h-full">
        <!-- Top: tabs + close -->
        <div class="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
          <TabsList>
            <TabsTrigger v-for="item in tabs" :key="item" :value="item">
              {{ t(item + '.Title') }}
            </TabsTrigger>
          </TabsList>
          <SheetClose
            class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
        </div>

        <!-- Content area (independent scrolling) -->
        <div class="flex-1 overflow-y-auto px-5 py-5" ref="sheetBody">
          <!-- About: sections come from aboutSections, each one's paragraphs an array
               in the locale file — adding or reordering copy is a locale-only edit. -->
          <TabsContent value="about" class="space-y-6 mt-0">
            <section v-for="section in aboutSections" :key="section.key">
              <h3 v-if="section.titleKey" class="text-base font-semibold mb-2">{{ t(section.titleKey) }}</h3>
              <div class="space-y-2" :class="section.links && 'mb-3'">
                <p v-for="(paragraph, idx) in tm(`about.${section.key}`)" :key="idx"
                  class="text-sm leading-relaxed text-foreground/85">
                  {{ rt(paragraph) }}
                </p>
              </div>
              <div v-if="section.links" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button v-for="link in section.links" :key="link.href" variant="outline" size="sm" as-child
                  class="justify-start">
                  <a :href="link.href" target="_blank" rel="noopener">
                    <Compass />
                    <span class="flex-1 text-left">{{ t(link.labelKey) }}</span>
                    <ExternalLink class="opacity-50" />
                  </a>
                </Button>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="changelog" class="mt-0">
            <FooterChangelog v-if="hasOpenedChangelog" />
          </TabsContent>

          <TabsContent value="acknowledgement" class="mt-0">
            <FooterAcknowledgements v-if="hasOpenedAcknowledgement" />
          </TabsContent>
        </div>
      </Tabs>
    </SheetContent>
  </Sheet>
</template>

<script setup>
// Lazy About Sheet shell for Footer.vue: renders the About copy directly and
// loads the Acknowledgement and Changelog tabs on demand when selected.
import { ref, watch, nextTick, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Compass, ExternalLink } from '@lucide/vue';

const FooterChangelog = defineAsyncComponent(() => import('./FooterChangelog.vue'));
const FooterAcknowledgements = defineAsyncComponent(() => import('./FooterAcknowledgements.vue'));

const props = defineProps({
  open: { type: Boolean, default: false },
  tab: { type: String, default: 'about' },
});
const emit = defineEmits(['update:open', 'update:tab']);

const { t, tm, rt } = useI18n();

const tabs = ['about', 'acknowledgement', 'changelog'];
const sheetBody = ref(null);
const hasOpenedChangelog = ref(false);
const hasOpenedAcknowledgement = ref(false);

watch(() => props.tab, (currentTab) => {
  if (currentTab === 'changelog') hasOpenedChangelog.value = true;
  if (currentTab === 'acknowledgement') hasOpenedAcknowledgement.value = true;
  nextTick(() => {
    if (sheetBody.value) sheetBody.value.scrollTop = 0;
  });
}, { immediate: true });

const personalLinks = [
  { href: 'https://wujiaxian.com', labelKey: 'about.personal' },
  { href: 'https://kenengba.com', labelKey: 'about.blog' },
  { href: 'https://www.linkedin.com/in/jason5ng32/', labelKey: 'about.linkedIn' },
  { href: 'https://twitter.com/jason5ng32', labelKey: 'about.twitter' },
];

// About tab layout: one entry per section, rendered in order. `key` names the
// paragraph array under `about.` in the locale files; `titleKey` is omitted for
// the lead-in section, and `links` appends a link grid under the paragraphs.
const aboutSections = [
  { key: 'project' },
  { key: 'founder', titleKey: 'about.founderTitle', links: personalLinks },
  { key: 'contact', titleKey: 'about.contactTitle' },
];
</script>
