<template>
    <!-- Brand.vue's viewBox: a leaf tucked into the fedora's band on the right
         of the crown, leaning over it. Halo layer first, so the background gap
         shows only where the leaf meets the icon. -->
    <svg class="size-full overflow-visible" viewBox="0 0 511 512.35" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(404 128) rotate(-30) scale(2)">
            <g class="leaf">
                <path class="halo" :d="LEAF" />
                <path :d="LEAF" fill="#16a34a" />
                <path :d="MIDRIB" fill="#bbf7d0" />
            </g>
        </g>
    </svg>
</template>

<script setup>
// Earth Day logo part: a green leaf tucked into the brand icon's hat band.

// 44 × 50 leaf, its stalk at (0, 24) and its tip straight up.
const LEAF = 'M0 24 C-22 10 -22 -16 0 -26 C22 -16 22 10 0 24 Z';
const MIDRIB = 'M-1.5 22 L1.5 22 L1.5 -14 L-1.5 -14 Z';
</script>

<style scoped>
/* Background-colored halo keeps the leaf apart from the icon (24 units after the scale). */
.halo {
    fill: var(--background);
    stroke: var(--background);
    stroke-width: 12;
    stroke-linejoin: round;
}

/* Pivot on the stalk: the bottom centre of the untransformed leaf. */
.leaf {
    transform-box: fill-box;
    transform-origin: 50% 100%;
}

/* A slow sway, as if in a breeze. */
@media (prefers-reduced-motion: no-preference) {
    .leaf {
        animation: sway 6s ease-in-out infinite;
    }
}

@keyframes sway {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
}
</style>
