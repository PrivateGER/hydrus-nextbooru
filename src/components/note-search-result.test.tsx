/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { NoteSearchResult } from "./note-search-result";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe("NoteSearchResult", () => {
  it("renders favorite buttons outside thumbnail links", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(
        <NoteSearchResult
          note={{
            id: 1,
            postId: 1,
            name: "matching note",
            content: "content",
            contentHash: "note-hash",
            headline: null,
            posts: [
              {
                id: 1,
                hash: "primary-note-post",
                mimeType: "image/jpeg",
                width: 800,
                height: 600,
                favorited: false,
              },
              {
                id: 2,
                hash: "additional-note-post",
                mimeType: "image/jpeg",
                width: 400,
                height: 400,
                favorited: false,
              },
            ],
          }}
        />
      );
    });

    const buttons = host.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    expect([...buttons].every((button) => button.closest("a") === null)).toBe(true);
  });
});
