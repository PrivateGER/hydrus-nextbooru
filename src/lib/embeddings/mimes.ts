import { PHASH_SUPPORTED_MIMES } from "@/lib/phash/mimes";

/**
 * Image MIME types the embedding pipeline can process (identical to the pHash
 * set — both preprocess via sharp). Sharp-free module: import from here when
 * only the eligibility check is needed, and from "@/lib/embeddings/image" when
 * preprocessing. Videos are gated separately by the `videoEnabled` setting:
 * any `video/*` file qualifies because ffmpeg normalizes the container.
 */
export const EMBEDDING_SUPPORTED_IMAGE_MIMES = PHASH_SUPPORTED_MIMES;
