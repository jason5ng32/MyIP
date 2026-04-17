// 成就定义（refactor/04）
//
// 只包含静态定义（name + img），不含运行时状态（achieved / achievedTime / showDetails）。
// 运行时状态由 createInitialAchievementsState() 工厂生成，保证每次调用返回全新对象，
// 不会在多个 Pinia store 实例之间串状态。

export const ACHIEVEMENTS_DEFINITIONS = [
  { name: 'IAmHuman', img: '/achievements/iamhuman.webp' },
  { name: 'BarelyEnough', img: '/achievements/barelyenough.webp' },
  { name: 'RapidPace', img: '/achievements/rapidpace.webp' },
  { name: 'TorrentFlow', img: '/achievements/torrentflow.webp' },
  { name: 'SteadyGoing', img: '/achievements/steadygoing.webp' },
  { name: 'TooFastTooSimple', img: '/achievements/toofasttoosimple.webp' },
  { name: 'SwiftAscent', img: '/achievements/swiftascent.webp' },
  { name: 'SurfaceCheck', img: '/achievements/surfacecheck.webp' },
  { name: 'HalfwayThere', img: '/achievements/halfwaythere.webp' },
  { name: 'FullySecured', img: '/achievements/fullysecured.webp' },
  { name: 'JustInCase', img: '/achievements/justincase.webp' },
  { name: 'HiddenWell', img: '/achievements/hiddenwell.webp' },
  { name: 'SlipUp', img: '/achievements/slipup.webp' },
  { name: 'CleverTrickery', img: '/achievements/clevertrickery.webp' },
  { name: 'EnergySaver', img: '/achievements/energysaver.webp' },
  { name: 'ResourceHog', img: '/achievements/resourcehog.webp' },
  { name: 'MakingBigNews', img: '/achievements/makingbignews.webp' },
  { name: 'GenerousDonor', img: '/achievements/generousdonor.webp' },
  { name: 'ItIsOpen', img: '/achievements/itisopen.webp' },
  { name: 'CuriousCat', img: '/achievements/curiouscat.webp' },
  { name: 'CrossingTheWall', img: '/achievements/crossingthewall.webp' },
];

/**
 * 根据定义生成一份全新的成就状态对象（store state 初始值）。
 * 形状兼容原 store.userAchievements —— 消费方无需修改。
 *
 * 每次调用返回全新对象（不共享引用），避免多 store 实例互相污染。
 */
export function createInitialAchievementsState() {
  const state = {};
  for (const def of ACHIEVEMENTS_DEFINITIONS) {
    state[def.name] = {
      name: def.name,
      img: def.img,
      achieved: false,
      achievedTime: null,
      showDetails: false,
    };
  }
  return state;
}
