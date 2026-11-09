/** Public counter id from Metrika dashboard. */
export const YANDEX_METRIKA_ID = 114148645;

/** Goal identifiers configured in Metrika (JavaScript-событие). */
export const METRIKA_GOALS = {
  addToCart: "add_to_cart",
  orderSuccess: "order_success",
} as const;

declare global {
  interface Window {
    ym?: (
      id: number,
      method: string,
      ...args: Array<string | Record<string, unknown>>,
    ) => void;
  }
}

/** Fire a Metrika JavaScript goal when the counter is loaded. */
export const reachMetrikaGoal = (
  goal: string,
  params?: Record<string, unknown>,
): void => {
  if (typeof window === "undefined") return;
  if (!goal.trim()) return;
  try {
    if (params) {
      window.ym?.(YANDEX_METRIKA_ID, "reachGoal", goal, params);
    } else {
      window.ym?.(YANDEX_METRIKA_ID, "reachGoal", goal);
    }
  } catch {
    /* ignore tracker errors */
  }
};
