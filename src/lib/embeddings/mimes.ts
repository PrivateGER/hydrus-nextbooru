import { PHASH_SUPPORTED_MIMES } from "@/lib/phash/mimes";

/**
 * MIME types the embedding pipeline can process (identical to the pHash set —
 * both preprocess via sharp). Sharp-free module: import from here when only
 * the eligibility check is needed (e.g. the feed's per-candidate engine
 * renormalization), and from "@/lib/embeddings/image" when preprocessing.
 */
export const EMBEDDING_SUPPORTED_MIMES = PHASH_SUPPORTED_MIMES;
