<template>
  <!-- Acknowledgement tab content inside FooterAboutSheet.vue. -->
  <div class="space-y-4">
    <p class="text-sm text-muted-foreground leading-relaxed">{{ t('acknowledgement.Note1') }}</p>
    <ul class="grid grid-cols-1 gap-2 list-none p-0">
      <li v-for="(item, idx) in acknowledgementsList" :key="idx">
        <Button v-if="item.link" variant="outline" size="sm" as-child class="w-full justify-start">
          <a :href="item.link" target="_blank" rel="noopener">
            <Smile />
            <span class="flex-1 text-left truncate text-xs">{{ item.name }}</span>
            <ExternalLink class="opacity-50" />
          </a>
        </Button>
        <div v-else
          class="flex items-center gap-2 h-8 px-3 text-sm rounded-md border bg-card text-foreground/80">
          <Smile class="size-4 text-muted-foreground shrink-0" />
          <span class="truncate text-xs">{{ item.name }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
// Lazy Acknowledgement tab for the Footer's About sheet.
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { ExternalLink, Smile } from '@lucide/vue';

const { t } = useI18n();

const acknowledgementsList = [
  { name: 'Setilis Hu', link: '' },
  { name: 'Seven Yu', link: 'https://github.com/dofy' },
  { name: 'Nikolai Tschacher', link: 'https://incolumitas.com/pages/about/' },
  { name: 'Project Alexandria (Cloudflare)', link: 'https://www.cloudflare.com/lp/project-alexandria/' },
  { name: 'Cloudflare Speedtest', link: 'https://github.com/cloudflare/speedtest' },
  { name: 'V.PS', link: 'https://v.ps/?utm_source=ipcheck.ing&utm_medium=acknowledgement&utm_campaign=footer' },
  { name: 'Proxy-Seller', link: 'https://proxy-seller.com/?partner=4FEC1644D12240F4' },
  { name: 'Sentry', link: 'https://www.sentry.io/' },
  { name: '1Password', link: 'https://www.1password.com/' },
  { name: 'Greptile', link: 'https://www.greptile.com/' },
  { name: 'GitBook', link: 'https://www.gitbook.com/' },
  { name: 'Globalping by jsDelivr', link: 'https://globalping.io/' },
  { name: 'ProxyCheck.io', link: 'https://proxycheck.io/' },
  { name: 'Digital Defense', link: 'https://digital-defense.io/' },
  { name: 'RIPE NCC', link: 'https://stat.ripe.net/' },
  { name: 'OONI', link: 'https://ooni.org/' },
  { name: 'CAIDA', link: 'https://www.caida.org/' },
  { name: 'ChatGPT', link: 'https://chatgpt.com/' },
  { name: 'Claude', link: 'https://claude.ai/' },
];
</script>
