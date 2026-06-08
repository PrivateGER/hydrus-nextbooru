import type { MutableRefObject } from "react";

type ImageUploadRef = MutableRefObject<AbortController | null>;

export function cancelPendingImageUpload(
  imageUploadAbortRef: ImageUploadRef,
  setIsUploadingImage: (isUploading: boolean) => void
): void {
  imageUploadAbortRef.current?.abort();
  imageUploadAbortRef.current = null;
  setIsUploadingImage(false);
}

export function isCurrentImageUpload(
  imageUploadAbortRef: ImageUploadRef,
  controller: AbortController
): boolean {
  return imageUploadAbortRef.current === controller && !controller.signal.aborted;
}
