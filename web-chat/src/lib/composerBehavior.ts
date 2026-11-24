export const COMPOSER_MAX_HEIGHT_PX = 120;

export interface ComposerKeyEvent {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
  isCoarsePointer: boolean;
}

export function shouldSubmitComposerOnKeyDown(event: ComposerKeyEvent): boolean {
  if (event.isComposing || event.key !== "Enter") {
    return false;
  }
  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    return true;
  }
  if (event.isCoarsePointer) {
    return false;
  }
  return !event.shiftKey && !event.altKey;
}

export function computeComposerLayout(
  scrollHeight: number,
  maxHeightPx = COMPOSER_MAX_HEIGHT_PX
): { heightPx: number; overflowY: "hidden" | "auto" } {
  return {
    heightPx: Math.max(0, Math.min(scrollHeight, maxHeightPx)),
    overflowY: scrollHeight > maxHeightPx ? "auto" : "hidden",
  };
}
