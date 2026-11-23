<!-- Dynamic Client <-> Cloudflare Edge Server data-transfer topology. -->
<template>
  <div class="jn-st-topology flex items-center gap-2.5 min-w-0"
    :data-flow="flow"
    :data-paused="paused || undefined"
    :style="linkTone ? { '--st-flow-color': toneVar(linkTone) } : undefined">
    <!-- Client Endpoint -->
    <div class="inline-flex items-center gap-1.5 min-w-0 shrink">
      <UserRound class="jn-st-node size-4 shrink-0" :class="clientNodeClass" aria-hidden="true" />
      <Icon v-if="connection.loc" :icon="'circle-flags:' + connection.loc.toLowerCase()"
        class="size-3.5 shrink-0" />
      <span class="text-xs truncate max-w-28 sm:max-w-40 transition-colors"
        :class="hasClientMeta ? 'font-medium text-foreground' : 'text-muted-foreground'">
        {{ connection.country || connection.loc || t('speedtest.clientNode') }}
      </span>
    </div>

    <!-- Directional Packet Conduit -->
    <div class="jn-st-conduit relative flex-1 md:flex-none md:w-20 lg:w-28 h-5 flex items-center overflow-hidden"
      aria-hidden="true">
      <span class="jn-st-wire is-left"></span>
      <span class="jn-st-wire is-right"></span>
      <span class="jn-st-pkt is-a"></span>
      <span class="jn-st-pkt is-b"></span>
    </div>

    <!-- Cloudflare Edge Server Endpoint -->
    <div class="inline-flex items-center gap-1.5 min-w-0 shrink" :title="edgeTitle">
      <Icon v-if="connection.coloCountryCode"
        :icon="'circle-flags:' + connection.coloCountryCode.toLowerCase()" class="size-3.5 shrink-0" />
      <span class="text-xs truncate max-w-28 sm:max-w-44 transition-colors"
        :class="hasEdgeMeta ? 'font-medium text-foreground' : 'text-muted-foreground'">
        {{ connection.coloCountry || connection.colo || t('speedtest.edgeAuto') }}
      </span>
      <span v-if="connection.coloCountry && connection.colo"
        class="font-mono text-[10px] text-muted-foreground uppercase shrink-0">
        {{ connection.colo }}
      </span>
      <Server class="jn-st-node size-4 shrink-0" :class="serverNodeClass" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { Server, UserRound } from '@lucide/vue';
import { useStatusTone } from '@/composables/use-status-tone.js';

const props = defineProps({
  connection: { type: Object, required: true },
  flow: { type: String, default: 'idle' },
  paused: { type: Boolean, default: false },
});

const { t } = useI18n();
const { textClass, toneVar } = useStatusTone();

const hasClientMeta = computed(() => Boolean(props.connection.country || props.connection.loc));
const hasEdgeMeta = computed(() => Boolean(props.connection.coloCountry || props.connection.colo));

const linkTone = computed(() => {
  if (props.paused || props.flow === 'paused') return 'ok-slow';
  if (props.flow === 'done') return 'ok-fast';
  if (props.flow === 'error') return 'fail';
  if (props.flow !== 'idle') return 'active';
  return null;
});

const clientNodeClass = computed(() => (
  linkTone.value ? textClass(linkTone.value) : 'text-muted-foreground'
));

const serverNodeClass = computed(() => (
  linkTone.value && props.flow !== 'handshake'
    ? textClass(linkTone.value)
    : 'text-muted-foreground'
));

const edgeTitle = computed(() => {
  const { coloCity, colo } = props.connection;
  if (!colo) return t('speedtest.edgeAuto');
  return coloCity ? `Cloudflare · ${coloCity} (${colo})` : `Cloudflare · ${colo}`;
});
</script>

<style scoped>
.jn-st-node {
  transition: color 220ms ease;
}

/* Two half-wires: retracted to 68% in idle (34%..66% open gap), meeting seamlessly at 50% on connect */
.jn-st-wire {
  --st-wire-color: var(--jn-cad-tick-major);
  position: absolute;
  top: calc(50% - 0.5px);
  width: 50%;
  height: 1px;
  background-image: repeating-linear-gradient(
    90deg,
    var(--st-wire-color) 0 3px,
    transparent 3px 7px
  );
  transition: background-color 220ms ease;
}

.jn-st-wire.is-left {
  left: 0;
  transform-origin: left center;
}

.jn-st-wire.is-right {
  right: 0;
  transform-origin: right center;
}

.jn-st-topology[data-flow='idle'] .jn-st-wire {
  transform: scaleX(0.68);
}

.jn-st-topology:not([data-flow='idle']) .jn-st-wire {
  --st-wire-color: color-mix(in oklab, var(--st-flow-color) 42%, transparent);
}

.jn-st-topology[data-paused='true'] .jn-st-wire,
.jn-st-topology[data-flow='error'] .jn-st-wire {
  --st-wire-color: color-mix(in oklab, var(--st-flow-color) 58%, transparent);
}

.jn-st-topology[data-flow='done'] .jn-st-wire {
  background-image: none;
  background-color: color-mix(in oklab, var(--st-flow-color) 52%, transparent);
}

/* Full-width carrier so translateX(%) maps 1:1 to conduit width; ::before renders the crisp dot */
.jn-st-pkt {
  position: absolute;
  inset-inline: 0;
  top: 50%;
  height: 0;
  pointer-events: none;
}

.jn-st-pkt::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: var(--st-flow-color, var(--muted-foreground));
  box-shadow: 0 0 6px color-mix(in oklab, var(--st-flow-color, transparent) 45%, transparent);
  transform: translate(-50%, -50%);
  transition: background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease, opacity 180ms ease;
}

.jn-st-pkt.is-a::after {
  content: '';
  position: absolute;
  top: -1px;
  width: 22px;
  height: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 180ms ease;
}

/* Idle: two hollow terminal dots resting on the open wire ends (-16% = 34%, +16% = 66%) */
.jn-st-topology[data-flow='idle'] .jn-st-pkt.is-a {
  transform: translateX(-16%);
}

.jn-st-topology[data-flow='idle'] .jn-st-pkt.is-b {
  transform: translateX(16%);
}

.jn-st-topology[data-flow='idle'] .jn-st-pkt::before {
  width: 5px;
  height: 5px;
  border: 1px solid var(--muted-foreground);
  background-color: var(--card);
  box-shadow: none;
  opacity: 0.55;
}

/* Once fused past handshake, second dot stays hidden while the single fused dot carries all traffic */
.jn-st-topology:not([data-flow='idle']):not([data-flow='handshake']) .jn-st-pkt.is-b {
  opacity: 0;
}

.jn-st-topology[data-flow='download'] .jn-st-pkt.is-a::after {
  left: 50%;
  opacity: 0.72;
  background: linear-gradient(90deg, var(--st-flow-color), transparent);
}

.jn-st-topology[data-flow='upload'] .jn-st-pkt.is-a::after {
  right: 50%;
  opacity: 0.72;
  background: linear-gradient(270deg, var(--st-flow-color), transparent);
}

@media (prefers-reduced-motion: no-preference) {
  .jn-st-wire {
    transition: transform 320ms cubic-bezier(0.5, 0, 0.82, 0.35), background-color 220ms ease;
  }

  /* 1. Handshake: two disconnected dots glide inward with the wire ends and fuse at 0% */
  .jn-st-topology[data-flow='handshake'] .jn-st-pkt.is-a {
    animation: jn-st-merge-a 320ms cubic-bezier(0.5, 0, 0.82, 0.35) forwards;
  }

  .jn-st-topology[data-flow='handshake'] .jn-st-pkt.is-b {
    animation: jn-st-merge-b 320ms cubic-bezier(0.5, 0, 0.82, 0.35) forwards;
  }

  /* 2. Ping: starts right at 0% heading rightward so merge -> shuttle has zero pause or velocity jump */
  .jn-st-topology[data-flow='ping'] .jn-st-pkt.is-a {
    animation: jn-st-pkt-ping 1.2s infinite;
  }

  /* 3. Download: fused dot streams Server (right) -> Client (left) */
  .jn-st-topology[data-flow='download'] .jn-st-pkt.is-a {
    animation: jn-st-pkt-dl 0.88s cubic-bezier(0.35, 0, 0.25, 1) infinite;
  }

  /* 4. Upload: fused dot streams Client (left) -> Server (right) */
  .jn-st-topology[data-flow='upload'] .jn-st-pkt.is-a {
    animation: jn-st-pkt-ul 0.88s cubic-bezier(0.35, 0, 0.25, 1) infinite;
  }

  /* Pause freezes the dot in-place at its exact current coordinate instead of snapping to center */
  .jn-st-topology[data-paused='true'][data-flow] .jn-st-pkt.is-a,
  .jn-st-topology[data-paused='true'][data-flow] .jn-st-pkt.is-b {
    animation-play-state: paused;
  }

  .jn-st-topology[data-paused='true'] .jn-st-pkt.is-a::after {
    opacity: 0.35;
  }
}

@keyframes jn-st-merge-a {
  0% { transform: translateX(-16%); }
  100% { transform: translateX(0%); }
}

@keyframes jn-st-merge-b {
  0% { transform: translateX(16%); opacity: 1; }
  75% { opacity: 1; }
  100% { transform: translateX(0%); opacity: 0; }
}

@keyframes jn-st-pkt-ping {
  0% { transform: translateX(0%); animation-timing-function: cubic-bezier(0.39, 0.575, 0.565, 1); }
  25% { transform: translateX(42%); animation-timing-function: cubic-bezier(0.435, 0, 0.61, 0.425); }
  50% { transform: translateX(0%); animation-timing-function: cubic-bezier(0.39, 0.575, 0.565, 1); }
  75% { transform: translateX(-42%); animation-timing-function: cubic-bezier(0.435, 0, 0.61, 0.425); }
  100% { transform: translateX(0%); }
}

@keyframes jn-st-pkt-dl {
  0% { transform: translateX(44%); opacity: 0.45; }
  12% { opacity: 1; }
  88% { opacity: 1; }
  100% { transform: translateX(-44%); opacity: 0.45; }
}

@keyframes jn-st-pkt-ul {
  0% { transform: translateX(-44%); opacity: 0.45; }
  12% { opacity: 1; }
  88% { opacity: 1; }
  100% { transform: translateX(44%); opacity: 0.45; }
}
</style>
