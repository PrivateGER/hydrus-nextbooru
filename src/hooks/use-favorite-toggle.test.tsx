/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFavoriteState, useFavoriteToggle } from "./use-favorite-toggle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);

function Toggle({ hash }: { hash: string }) {
  const { favorited, toggle } = useFavoriteToggle(hash, false);
  return (
    <button data-testid={`toggle-${hash}`} onClick={toggle}>
      {String(favorited)}
    </button>
  );
}

function Indicator({ hash }: { hash: string }) {
  return <span data-testid={`state-${hash}`}>{String(useFavoriteState(hash, false))}</span>;
}

let container: HTMLDivElement;
let root: Root;

function render(ui: React.ReactElement) {
  act(() => root.render(ui));
}

function text(testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`)?.textContent;
}

async function click(testId: string) {
  await act(async () => {
    container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("favorite state sync", () => {
  it("propagates a toggle to every view of the same post only", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(
      <>
        <Toggle hash={HASH} />
        <Indicator hash={HASH} />
        <Indicator hash={OTHER_HASH} />
      </>,
    );

    await click(`toggle-${HASH}`);

    expect(text(`toggle-${HASH}`)).toBe("true");
    expect(text(`state-${HASH}`)).toBe("true");
    expect(text(`state-${OTHER_HASH}`)).toBe("false");
    expect(fetch).toHaveBeenCalledWith(`/api/posts/${HASH}/favorite`, { method: "PUT" });
  });

  it("rolls every view back when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(
      <>
        <Toggle hash={HASH} />
        <Indicator hash={HASH} />
      </>,
    );

    await click(`toggle-${HASH}`);

    expect(text(`toggle-${HASH}`)).toBe("false");
    expect(text(`state-${HASH}`)).toBe("false");
  });
});
