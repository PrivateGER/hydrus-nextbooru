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
        <FavoriteButton hash="duplicate-sync" initialFavorited={false} />
        <FavoriteOverlayButton hash="duplicate-sync" initialFavorited={false} />
        <FavoriteOverlayButton hash="unrelated-sync" initialFavorited={false} />
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

  it("blocks a second duplicate toggle while the first request is pending", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const mounted = await render(
      <>
        <FavoriteButton hash="pending-sync" initialFavorited={false} />
        <FavoriteOverlayButton hash="pending-sync" initialFavorited={false} />
      </>
    );
    const buttons = mounted.querySelectorAll("button");

    await act(async () => {
      buttons[0].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      buttons[1].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(buttons[0].hasAttribute("disabled")).toBe(true);
    expect(buttons[1].hasAttribute("disabled")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => resolveRequest?.(new Response(null, { status: 200 })));
  });

  it("restores the latest state when a duplicate control mounts later", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    const mounted = await render(
      <FavoriteOverlayButton key="first" hash="later-mount" initialFavorited={false} />
    );

    await act(async () => {
      mounted
        .querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      root?.render(
        <FavoriteOverlayButton key="replacement" hash="later-mount" initialFavorited={false} />
      );
    });

    expect(mounted.querySelector("button")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("synchronizes the rollback when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const mounted = await render(
      <>
        <FavoriteOverlayButton hash="rollback-sync" initialFavorited={false} />
        <FavoriteOverlayButton hash="rollback-sync" initialFavorited={false} />
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
    expect(button?.className).toContain("not-any-pointer-coarse:pointer-fine:h-7");
  });

  it("keeps the favorited touch state at full emphasis", async () => {
    const mounted = await render(<FavoriteOverlayButton hash="post" initialFavorited />);
    const button = mounted.querySelector("button");

    expect(button?.className).toContain("opacity-100");
    expect(button?.getAttribute("aria-pressed")).toBe("true");
  });
});
