<!-- Reusable WAAPI emoji motion primitive (`<EmojiMotion>`): renders any native
     emoji inline (or positioned via `class`) and plays one of the 9 core motions
     plus an optional generic SVG micro-effect on hover / keyboard card focus. -->
<template>
    <span ref="rootRef"
        aria-hidden="true"
        :data-motion="spec.motionName"
        :data-fx="spec.fxName || undefined"
        :data-acting="isPlaying || undefined"
        :class="cn('jn-emoji-motion relative inline-grid place-items-center shrink-0 leading-none select-none', props.class)">
        <span v-if="spec.actors.length" ref="fxLayerRef" class="jn-emoji-fx">
            <span v-for="(actor, idx) in spec.actors"
                :key="idx"
                class="jn-emoji-actor"
                :class="{ 'jn-emoji-actor--front': actor.front }">
                <svg viewBox="0 0 32 32" fill="none" class="jn-emoji-svg">
                    <circle v-if="actor.svg.tag === 'circle'" v-bind="actor.svg.attrs" />
                    <line v-else-if="actor.svg.tag === 'line'" v-bind="actor.svg.attrs" />
                </svg>
            </span>
        </span>
        <span ref="emojiRef" class="jn-emoji-glyph">{{ emoji }}</span>
    </span>
</template>

<script setup>
import { computed, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';
import { cn } from '@/lib/utils';
import {
    REPLAY_COOLDOWN_MS,
    playEmojiMotion,
    resolveEmojiMotion,
    shouldPlayOnFocusIn,
} from '@/utils/emoji-motion.js';

const props = defineProps({
    emoji: { type: String, required: true },
    motion: { type: String, default: 'pop' },
    fx: { type: String, default: '' },
    tone: { type: String, default: 'info' },
    angle: { type: Number, default: 0 },
    // 'self' (default) | 'parent' | CSS selector passed to `el.closest(trigger)` | 'none'
    trigger: { type: String, default: 'self' },
    class: { type: [String, Array, Object], default: '' },
});

const rootRef = ref(null);
const fxLayerRef = ref(null);
const emojiRef = ref(null);
const isPlaying = ref(false);

const spec = computed(() => resolveEmojiMotion({
    motion: props.motion,
    fx: props.fx,
    tone: props.tone,
    angle: props.angle,
}));

let activePlayback = null;
let activeToken = 0;
let lastPlayedAt = -Infinity;
let triggerEl = null;
let keyHoverObserver = null;

const stop = () => {
    activeToken += 1;
    activePlayback?.cancel();
    activePlayback = null;
    isPlaying.value = false;
    lastPlayedAt = -Infinity;
};

const play = () => {
    const now = Date.now();
    if (now - lastPlayedAt < REPLAY_COOLDOWN_MS) return false;

    activePlayback?.cancel();
    const token = ++activeToken;
    const actorEls = fxLayerRef.value ? Array.from(fxLayerRef.value.children) : [];

    const playback = playEmojiMotion({
        emojiEl: emojiRef.value,
        actorEls,
        spec: spec.value,
    });

    if (playback.animations.length === 0) {
        activePlayback = null;
        isPlaying.value = false;
        return false;
    }

    lastPlayedAt = now;
    activePlayback = playback;
    isPlaying.value = true;
    playback.finished.then(() => {
        if (activeToken !== token) return;
        activePlayback = null;
        isPlaying.value = false;
    });
    return true;
};

const onPointerEnter = (event) => {
    if (event?.pointerType === 'touch') return;
    play();
};

const onFocusIn = (event) => {
    if (!shouldPlayOnFocusIn(event, triggerEl)) return;
    play();
};

const resolveTriggerElement = () => {
    const el = rootRef.value;
    if (!el || !props.trigger || props.trigger === 'none') return null;
    if (props.trigger === 'self') return el;
    if (props.trigger === 'parent') return el.parentElement;
    return el.closest(props.trigger);
};

onMounted(() => {
    triggerEl = resolveTriggerElement();
    if (!triggerEl) return;

    triggerEl.addEventListener('pointerenter', onPointerEnter, { passive: true });
    triggerEl.addEventListener('focusin', onFocusIn);

    // Mirror J/K keyboard card navigation (`data-keyboard-hover="true"`) when
    // mounted inside a shortcut-navigable card.
    if (typeof MutationObserver !== 'undefined' && triggerEl.classList?.contains('keyboard-shortcut-card')) {
        keyHoverObserver = new MutationObserver(() => {
            if (triggerEl?.getAttribute('data-keyboard-hover') === 'true') {
                play();
            }
        });
        keyHoverObserver.observe(triggerEl, {
            attributes: true,
            attributeFilter: ['data-keyboard-hover'],
        });
    }
});

onDeactivated(stop);
onBeforeUnmount(() => {
    triggerEl?.removeEventListener('pointerenter', onPointerEnter);
    triggerEl?.removeEventListener('focusin', onFocusIn);
    triggerEl = null;
    keyHoverObserver?.disconnect();
    keyHoverObserver = null;
    stop();
});

defineExpose({ play, stop });
</script>

<style scoped>
/* Identity individual transforms prevent stacking-context jumps when callers
   apply hover `translate` / `scale`, while WAAPI animates inner `transform`. */
.jn-emoji-motion {
    translate: 0px 0px;
    rotate: 0deg;
    scale: 1;

    @media (prefers-reduced-motion: no-preference) {
        transition:
            translate 260ms cubic-bezier(0.22, 1, 0.36, 1),
            scale 260ms cubic-bezier(0.22, 1, 0.36, 1);
    }
}

.jn-emoji-glyph {
    position: relative;
    z-index: 1;
    display: inline-block;
    transform-origin: 50% 56%;
}

.jn-emoji-fx {
    position: absolute;
    inset: -0.35em;
    pointer-events: none;
}

.jn-emoji-actor {
    position: absolute;
    inset: 0;
    opacity: 0;
    transform-origin: center;
    pointer-events: none;
}

.jn-emoji-actor--front {
    z-index: 2;
}

.jn-emoji-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
}
</style>
