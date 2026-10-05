<template>
  <!-- Account menu at the right of the site Nav. Two shapes:
       a Firebase-less self-hosted instance has no user system, so only the
       preferences cog shows; otherwise a dropdown carries sign-in (signed
       out) or the account card + achievements (signed in), then preferences,
       benefits & usage and sign-out. The dialogs it opens are raised through
       the store: Preferences and User live in App.vue, Achievements on the
       homepage. -->
  <!-- Firebase-less: standalone preferences cog. -->
  <JnTooltip v-if="!isFireBaseSet" :text="t('nav.preferences.title')">
    <Button variant="ghost" size="icon" class="size-8 cursor-pointer" aria-label="Open preferences"
      @click="openPreferences">
      <Cog />
    </Button>
  </JnTooltip>

  <!-- Sign In / User Dropdown -->
  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <!-- Not signed in: the solid block reads as the "sign in"
           call-to-action, and the menu opens on the sign-in options, so
           the affordance is self-explaining one click deep. -->
      <Button v-if="!isSignedIn" size="sm" @click="getUserInfo" class="h-8 gap-1 px-1.5 cursor-pointer"
        aria-label="User menu">
        <UserRound class="size-5" />
        <ChevronDown class="opacity-60" />
      </Button>
      <!-- Signed in: avatar + chevron -->
      <Button v-else variant="ghost" size="sm" @click="getUserInfo" class="h-8 gap-1 px-1 cursor-pointer"
        aria-label="User menu">
        <span class="inline-flex size-7 overflow-hidden rounded-full">
          <img :src="userPhotoURL" :alt="userName" :title="userName" class="size-full object-cover"
            referrerpolicy="no-referrer">
        </span>
        <ChevronDown class="opacity-60" />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="w-56 shadow-md">
      <!-- Signed in: account card + achievements -->
      <template v-if="isSignedIn">
        <div class="px-2 pt-2 pb-3">
          <div class="flex items-center gap-3">
            <span class="inline-flex size-10 overflow-hidden rounded-full shrink-0">
              <img :src="userPhotoURL" :alt="userName" class="size-full object-cover"
                referrerpolicy="no-referrer">
            </span>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="truncate text-sm font-semibold leading-none">{{ userName }}</span>
              <span v-if="remoteUserInfoFetched && remoteUserInfo.userLevel">
                <Badge :class="levelBadgeClass"
                  class="border-transparent text-[10px] font-medium px-1.5 py-0 h-4">
                  {{ t('user.Level.' + remoteUserInfo.userLevel) }}
                </Badge>
              </span>
              <span v-else-if="!remoteUserInfoFetched" class="text-xs text-muted-foreground">{{
                t('user.Fields.Fetching') }}</span>
            </div>
          </div>
          <dl class="mt-3 space-y-1 text-xs">
            <div class="flex items-baseline justify-between gap-2">
              <dt class="text-muted-foreground">{{ t('user.Fields.CreatedAt') }}</dt>
              <dd class="font-medium">{{ userCreatedAt }}</dd>
            </div>
            <!-- How this account signs in. One account per email
                 address, so this is also the only way in. -->
            <div v-if="linkedProviders.length" class="flex items-baseline justify-between gap-2">
              <dt class="text-muted-foreground">{{ t('user.Fields.SignInMethods') }}</dt>
              <dd class="flex min-w-0 items-center gap-1.5 font-medium">
                <span v-for="provider in linkedProviders" :key="provider.providerId"
                  class="inline-flex items-center gap-1" :title="provider.label">
                  <Icon v-if="provider.icon" :icon="provider.icon" class="size-3.5 shrink-0" />
                  <span>{{ provider.label }}</span>
                </span>
              </dd>
            </div>
          </dl>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem class="cursor-pointer" @select="openAchievements">
          <Award />
          <span>{{ t('user.MyAchievements') }}</span>
        </DropdownMenuItem>
      </template>

      <!-- Not signed in: sign-in providers -->
      <template v-else>
        <DropdownMenuItem class="cursor-pointer" @select="store.signInWithGoogle">
          <Icon icon="ri:google-line" />
          <span>{{ t('user.SignInWithGoogle') }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem v-if="signInProviders.includes('github')" class="cursor-pointer"
          @select="store.signInWithGithub">
          <Icon icon="ri:github-line" />
          <span>{{ t('user.SignInWithGithub') }}</span>
        </DropdownMenuItem>
      </template>

      <!-- Every state: preferences + benefits & usage -->
      <DropdownMenuSeparator />
      <DropdownMenuItem class="cursor-pointer" @select="openPreferences">
        <Cog />
        <span>{{ t('nav.preferences.title') }}</span>
      </DropdownMenuItem>
      <DropdownMenuItem class="cursor-pointer" @select="store.setTriggerUserBenefits(true)">
        <HeartHandshake />
        <span>{{ t('user.Benefits.Title') }}</span>
      </DropdownMenuItem>

      <template v-if="isSignedIn">
        <DropdownMenuSeparator />
        <DropdownMenuItem class="cursor-pointer" @select="store.signOut">
          <LogOut />
          <span>{{ t('user.SignOut') }}</span>
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup>
// Account menu (preferences cog or user dropdown) for the site Nav.
// Everything it opens goes through store triggers.
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';
import { unixToDateTime } from '@/utils/time-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JnTooltip } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Award, ChevronDown, Cog, HeartHandshake, LogOut, UserRound } from '@lucide/vue';
import { Icon } from '@iconify/vue';

const { t, locale } = useI18n();
const store = useMainStore();
const route = useRoute();
const router = useRouter();

// Firebase / User
const isFireBaseSet = computed(() => store.isFireBaseSet);
const isSignedIn = computed(() => store.isSignedIn);
const userName = computed(() => store.user?.displayName);
const userPhotoURL = computed(() => store.user?.photoURL);
const userCreatedAt = computed(() => unixToDateTime(store.user?.metadata?.createdAt, locale.value));
const remoteUserInfo = computed(() => store.remoteUserInfo);
const remoteUserInfoFetched = computed(() => store.remoteUserInfoFetched);
// Sign-in methods attached to this account.
const linkedProviders = computed(() => store.linkedProviders);
// Sign-in methods offered here (no GitHub in a PWA on its own auth domain).
const signInProviders = computed(() => store.signInProviders);

// Level Badge Color: mapped to semantic token, keep each level color distinction
const levelBadgeClass = computed(() => {
  const level = remoteUserInfo.value?.userLevel;
  switch (level) {
    case 'Premium': return 'bg-action text-action-foreground';
    case 'Owner': return 'bg-foreground text-background';
    case 'Developer': return 'bg-success text-success-foreground';
    case 'HonoraryMember': return 'bg-warning text-warning-foreground';
    case 'Standard':
    default: return 'bg-muted-foreground text-background';
  }
});

const getUserInfo = async () => {
  if (remoteUserInfoFetched.value || !isSignedIn.value) return;
  store.setTriggerRemoteUserInfo(true);
};

// Preferences: the one site-wide sheet (App.vue).
const openPreferences = () => {
  store.toggleSheet('preferences');
  trackEvent('Nav', 'NavClick', 'Preferences');
};

// Achievements live on the homepage only: from any other page, go home first
// (the kept-alive Home comes back as it was left), then raise the sheet.
const openAchievements = async () => {
  if (route.name !== 'home') {
    const failure = await router.push('/');
    if (failure) return;
  }
  store.setTriggerAchievements(true);
};
</script>
