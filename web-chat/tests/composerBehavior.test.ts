import { describe, expect, it } from "vitest";
import {
  computeComposerLayout,
  shouldSubmitComposerOnKeyDown,
  type ComposerKeyEvent,
} from "../src/lib/composerBehavior";

const enterEvent: ComposerKeyEvent = {
  key: "Enter",
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  isCoarsePointer: false,
};

describe("shouldSubmitComposerOnKeyDown", () => {
  describe("with a fine pointer", () => {
    it.each<[string, Partial<ComposerKeyEvent>, boolean]>([
      ["Enter", {}, true],
      ["Shift+Enter", { shiftKey: true }, false],
      ["Alt+Enter", { altKey: true }, false],
      ["Ctrl+Enter", { ctrlKey: true }, true],
      ["Meta+Enter", { metaKey: true }, true],
    ])("handles %s", (_key, modifiers, expected) => {
      expect(shouldSubmitComposerOnKeyDown({ ...enterEvent, ...modifiers })).toBe(
        expected
      );
    });
  });

  describe("with a coarse pointer", () => {
    it.each<[string, Partial<ComposerKeyEvent>, boolean]>([
      ["Enter", {}, false],
      ["Shift+Enter", { shiftKey: true }, false],
      ["Ctrl+Enter", { ctrlKey: true }, true],
      ["Meta+Enter", { metaKey: true }, true],
    ])("handles %s", (_key, modifiers, expected) => {
      expect(
        shouldSubmitComposerOnKeyDown({
          ...enterEvent,
          ...modifiers,
          isCoarsePointer: true,
        })
      ).toBe(expected);
    });
  });

  it("ignores non-Enter keys even with a send modifier", () => {
    expect(
      shouldSubmitComposerOnKeyDown({ ...enterEvent, key: "a", ctrlKey: true })
    ).toBe(false);
  });

  it.each<[string, Partial<ComposerKeyEvent>]>([
    ["Enter", {}],
    ["Ctrl+Enter", { ctrlKey: true }],
    ["Meta+Enter", { metaKey: true }],
  ])("ignores %s during IME composition", (_key, modifiers) => {
    expect(
      shouldSubmitComposerOnKeyDown({ ...enterEvent, ...modifiers, isComposing: true })
    ).toBe(false);
  });

  it("lets Alt override the send shortcut", () => {
    expect(
      shouldSubmitComposerOnKeyDown({ ...enterEvent, ctrlKey: true, altKey: true })
    ).toBe(false);
  });
});

describe("computeComposerLayout", () => {
  it.each<[number, number, "hidden" | "auto"]>([
    [38, 38, "hidden"],
    [120, 120, "hidden"],
    [165, 120, "auto"],
    [0, 0, "hidden"],
    [-10, 0, "hidden"],
  ])(
    "at a scroll height of %ipx sets height to %ipx and overflow to %s",
    (scrollHeight, heightPx, overflowY) => {
      expect(computeComposerLayout(scrollHeight)).toEqual({ heightPx, overflowY });
    }
  );

  it("respects a custom maximum height", () => {
    expect(computeComposerLayout(100, 80)).toEqual({ heightPx: 80, overflowY: "auto" });
  });
});
