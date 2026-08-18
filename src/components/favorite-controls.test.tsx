/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FavoriteButton } from "./favorite-button";
import { FavoriteOverlayButton } from "./favorite-overlay-button";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

async function render(children: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root?.render(children));
  return host;
}

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  vi.unstubAllGlobals();
});

describe("favorite controls", () => {
  it("keeps duplicate controls for the same post synchronized", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    const mounted = await render(
      <>
        <FavoriteButton hash="same" initialFavorited={false} />
        <FavoriteOverlayButton hash="same" initialFavorited={false} />
        <FavoriteOverlayButton hash="other" initialFavorited={false} />
      </>
    );

    const buttons = mounted.querySelectorAll("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("false");
    expect(buttons[2].getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      buttons[0].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[2].getAttribute("aria-pressed")).toBe("false");
  });

  it("synchronizes the rollback when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const mounted = await render(
      <>
        <FavoriteOverlayButton hash="same" initialFavorited={false} />
        <FavoriteOverlayButton hash="same" initialFavorited={false} />
      </>
    );

    await act(async () => {
      mounted
        .querySelector('button[aria-label="Add to favorites"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(mounted.querySelectorAll('button[aria-label="Add to favorites"]')).toHaveLength(2);
  });

  it("keeps a low-emphasis 44px overlay visible for touch layouts", async () => {
    const mounted = await render(<FavoriteOverlayButton hash="post" initialFavorited={false} />);
    const button = mounted.querySelector("button");

    expect(button?.className).not.toContain("opacity-0");
    expect(button?.className).toContain("h-11");
    expect(button?.className).toContain("w-11");
    expect(button?.className).toContain("opacity-60");
    expect(button?.className).toContain("pointer-fine:h-7");
  });

  it("keeps the favorited touch state at full emphasis", async () => {
    const mounted = await render(<FavoriteOverlayButton hash="post" initialFavorited />);
    const button = mounted.querySelector("button");

    expect(button?.className).toContain("opacity-100");
    expect(button?.getAttribute("aria-pressed")).toBe("true");
  });
});
