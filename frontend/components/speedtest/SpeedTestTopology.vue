<!-- Dynamic Client <-> Cloudflare Edge Server data-transfer topology. -->
<template>
  <div class="jn-st-topology flex items-center gap-2.5 min-w-0" :data-flow="flow">
    <!-- Client Endpoint -->
    <div class="inline-flex items-center gap-1.5 min-w-0 shrink">
      <UserRound class="jn-st-node is-client size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Icon v-if="connection.loc" :icon="'circle-flags:' + connection.loc.toLowerCase()"
        class="size-3.5 shrink-0" />
      <span v-if="connection.country || connection.loc"
        class="text-xs font-medium text-foreground truncate max-w-24 sm:max-w-36">
        {{ connection.country || connection.loc }}
      </span>
    </div>

    <!-- Directional Packet Conduit -->
    <div class="jn-st-conduit relative flex-1 md:flex-none md:w-24 lg:w-32 h-5 flex items-center overflow-hidden"
      aria-hidden="true">
      <div class="jn-st-wire"></div>
      <span class="jn-st-pkt is-a"></span>
      <span class="jn-st-pkt is-b"></span>
      <span class="jn-st-link-dot"></span>
    </div>

    <!-- Cloudflare Edge Server Endpoint -->
    <div class="inline-flex items-center gap-1.5 min-w-0 shrink" :title="edgeTitle">
      <Icon v-if="connection.coloCountryCode"
        :icon="'circle-flags:' + connection.coloCountryCode.toLowerCase()" class="size-3.5 shrink-0" />
      <span class="text-xs font-medium text-foreground truncate max-w-24 sm:max-w-36">
        {{ connection.coloCountry || connection.colo || 'Cloudflare' }}
      </span>
      <span v-if="connection.coloCountry && connection.colo"
        class="font-mono text-[10px] text-muted-foreground uppercase shrink-0">
        {{ connection.colo }}
      </span>
      <Server class="jn-st-node is-server size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { Server, UserRound } from '@lucide/vue';

const props = defineProps({
  connection: { type: Object, required: true },
  flow: { type: String, default: 'idle' },
});

const edgeTitle = computed(() => {
  const { coloCity, colo } = props.connection;
  if (!colo) return 'Cloudflare';
  return coloCity ? `Cloudflare · ${coloCity} (${colo})` : `Cloudflare · ${colo}`;
});
</script>

<style scoped>
.jn-st-node {
  transition: color 250ms ease;
}

.jn-st-topology[data-flow='download'] .jn-st-node.is-client,
.jn-st-topology[data-flow='upload'] .jn-st-node.is-server,
.jn-st-topology[data-flow='ping'] .jn-st-node {
  color: var(--info);
}

.jn-st-topology[data-flow='paused'] .jn-st-node {
  color: var(--warning);
}

.jn-st-topology[data-flow='done'] .jn-st-node {
  color: var(--success);
}

.jn-st-wire {
  position: absolute;
  inset-inline: 0;
  height: 1px;
  background-image: repeating-linear-gradient(
    90deg,
    var(--jn-cad-tick-major) 0 3px,
    transparent 3px 7px
  );
  transition: background-color 250ms ease;
}

.jn-st-topology[data-flow='done'] .jn-st-wire {
  background-image: none;
  background-color: color-mix(in oklab, var(--success) 45%, transparent);
}

.jn-st-topology[data-flow='paused'] .jn-st-wire {
  background-image: repeating-linear-gradient(
    90deg,
    color-mix(in oklab, var(--warning) 55%, transparent) 0 3px,
    transparent 3px 7px
  );
}

.jn-st-topology[data-flow='error'] .jn-st-wire {
  background-image: repeating-linear-gradient(
    90deg,
    color-mix(in oklab, var(--destructive) 55%, transparent) 0 3px,
    transparent 3px 7px
  );
}

.jn-st-pkt {
  position: absolute;
  inset-inline: 0;
  height: 2px;
  opacity: 0;
  pointer-events: none;
}

.jn-st-link-dot {
  position: absolute;
  left: 50%;
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  transform: translateX(-50%) scale(0.5);
  opacity: 0;
  transition: opacity 220ms ease, transform 220ms ease, background-color 220ms ease;
}

.jn-st-topology[data-flow='paused'] .jn-st-link-dot {
  opacity: 1;
  transform: translateX(-50%) scale(1);
  background-color: var(--warning);
}

.jn-st-topology[data-flow='done'] .jn-st-link-dot {
  opacity: 1;
  transform: translateX(-50%) scale(1);
  background-color: var(--success);
}

.jn-st-topology[data-flow='error'] .jn-st-link-dot {
  opacity: 1;
  transform: translateX(-50%) scale(1);
  background-color: var(--destructive);
}

@media (prefers-reduced-motion: no-preference) {
  /* Download: twin glowing comets stream Right (Server) -> Left (Client) */
  .jn-st-topology[data-flow='download'] .jn-st-pkt {
    opacity: 1;
    background: linear-gradient(
      270deg,
      transparent 55%,
      color-mix(in oklab, var(--info) 32%, transparent) 82%,
      var(--info) 98%,
      transparent 100%
    );
    animation: jn-st-pkt-dl 1.05s cubic-bezier(0.35, 0, 0.25, 1) infinite;
  }

  .jn-st-topology[data-flow='download'] .jn-st-pkt.is-b {
    animation-delay: 0.52s;
  }

  /* Upload: twin glowing comets stream Left (Client) -> Right (Server) */
  .jn-st-topology[data-flow='upload'] .jn-st-pkt {
    opacity: 1;
    background: linear-gradient(
      90deg,
      transparent 55%,
      color-mix(in oklab, var(--info) 32%, transparent) 82%,
      var(--info) 98%,
      transparent 100%
    );
    animation: jn-st-pkt-ul 1.05s cubic-bezier(0.35, 0, 0.25, 1) infinite;
  }

  .jn-st-topology[data-flow='upload'] .jn-st-pkt.is-b {
    animation-delay: 0.52s;
  }

  /* Probe / Latency: crisp echo pulse shuttles back and forth */
  .jn-st-topology[data-flow='ping'] .jn-st-pkt.is-a {
    opacity: 1;
    height: 6px;
    background: radial-gradient(
      circle,
      var(--info) 0 2.5px,
      color-mix(in oklab, var(--info) 30%, transparent) 5px,
      transparent 7px
    );
    animation: jn-st-pkt-ping 0.85s ease-in-out infinite alternate;
  }
}

@keyframes jn-st-pkt-dl {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}

@keyframes jn-st-pkt-ul {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes jn-st-pkt-ping {
  0% { transform: translateX(-44%); }
  100% { transform: translateX(44%); }
}
</style>
