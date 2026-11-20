// Achievement badge images and the store's per-achievement runtime state; the names come from common/codes/achievements.js.

// An achievement's badge: public/achievements/<name in lower case>.webp.
export const achievementImage = (name) => `/achievements/${name.toLowerCase()}.webp`;

// A fresh state object keyed by name, so store instances never share entries.
export const createInitialAchievementsState = (names) => Object.fromEntries(names.map((name) => [name, {
  name,
  img: achievementImage(name),
  achieved: false,
  achievedTime: null,
  showDetails: false,
}]));
