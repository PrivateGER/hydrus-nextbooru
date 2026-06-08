import { describe, expect, it, vi } from "vitest";
import { cancelPendingImageUpload, isCurrentImageUpload } from "./image-upload-state";

describe("image upload state", () => {
  it("aborts a pending upload, clears the ref, and clears uploading state", () => {
    const controller = new AbortController();
    const ref = { current: controller };
    const setUploading = vi.fn();

    cancelPendingImageUpload(ref, setUploading);

    expect(controller.signal.aborted).toBe(true);
    expect(ref.current).toBeNull();
    expect(setUploading).toHaveBeenCalledWith(false);
  });

  it("only treats the active, un-aborted controller as current", () => {
    const activeController = new AbortController();
    const staleController = new AbortController();
    const ref = { current: activeController };

    expect(isCurrentImageUpload(ref, activeController)).toBe(true);
    expect(isCurrentImageUpload(ref, staleController)).toBe(false);

    activeController.abort();
    expect(isCurrentImageUpload(ref, activeController)).toBe(false);
  });
});
