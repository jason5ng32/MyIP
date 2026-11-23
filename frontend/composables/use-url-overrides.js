// Keeps the address bar honest about URL overrides (data/url-params.js): when
// a user edit drops one (store.dropPreferenceOverrides), its parameter leaves
// the current URL, so a reload keeps the new choice. Mount once in App.vue.

import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { queryWithoutOverrides } from '../utils/url-overrides.js';

export const useUrlOverrideCleanup = ({ store, route = useRoute(), router = useRouter() }) => {
  watch(() => Object.keys(store.preferenceOverrides), (keys, previous = []) => {
    const dropped = previous.filter((key) => !keys.includes(key));
    const query = queryWithoutOverrides(route.query, dropped);
    if (query) router.replace({ path: route.path, query, hash: route.hash });
  });
};
