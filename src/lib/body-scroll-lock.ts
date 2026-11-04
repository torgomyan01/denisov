/**
 * Lock page scroll without `position: fixed` / `scrollTo` restore.
 * Those fight `html { scroll-behavior: smooth }` and make the page jump
 * when a drawer closes.
 *
 * Nested locks are ref-counted (cart + mobile menu, etc.).
 */

type ScrollLockSnapshot = {
  htmlOverflow: string;
  bodyOverflow: string;
  htmlPaddingRight: string;
  bodyPaddingRight: string;
  bodyOverscroll: string;
};

let lockCount = 0;
let snapshot: ScrollLockSnapshot | null = null;

const applyLock = (): void => {
  const html = document.documentElement;
  const body = document.body;
  const gap = Math.max(0, window.innerWidth - html.clientWidth);

  snapshot = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    htmlPaddingRight: html.style.paddingRight,
    bodyPaddingRight: body.style.paddingRight,
    bodyOverscroll: body.style.overscrollBehavior,
  };

  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";

  if (gap > 0) {
    html.style.paddingRight = `${gap}px`;
    body.style.paddingRight = `${gap}px`;
  }
};

const releaseLock = (): void => {
  if (!snapshot) return;
  const html = document.documentElement;
  const body = document.body;
  html.style.overflow = snapshot.htmlOverflow;
  body.style.overflow = snapshot.bodyOverflow;
  html.style.paddingRight = snapshot.htmlPaddingRight;
  body.style.paddingRight = snapshot.bodyPaddingRight;
  body.style.overscrollBehavior = snapshot.bodyOverscroll;
  snapshot = null;
};

/** Returns an unlock function. Safe to call unlock more than once. */
export const lockBodyScroll = (): (() => void) => {
  if (typeof document === "undefined") return () => undefined;

  if (lockCount === 0) applyLock();
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) releaseLock();
  };
};
