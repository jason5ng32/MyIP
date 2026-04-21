import { isFunction } from "@tanstack/vue-table";

export function valueUpdater(updaterOrValue, ref) {
  ref.value = isFunction(updaterOrValue)
    ? updaterOrValue(ref.value)
    : updaterOrValue;
}
