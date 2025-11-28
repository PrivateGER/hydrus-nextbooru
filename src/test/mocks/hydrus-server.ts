import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { HydrusFileMetadata } from '@/lib/hydrus/types';
import {
  createMockFileBatch,
  createMockSearchResponse,
  createMockMetadataResponse,
} from './fixtures/hydrus-metadata';

const HYDRUS_URL = 'http://localhost:45869';

/**
 * State for the mock Hydrus server.
 * Tests can modify this to control server responses.
 */
export interface MockHydrusState {
  fileIds: number[];
  metadata: Map<number, HydrusFileMetadata>;
  searchError?: Error;
  metadataError?: Error;
  metadataDelayMs?: number;
}

export function createMockHydrusState(fileCount: number = 0): MockHydrusState {
  const files = createMockFileBatch(fileCount);
  const metadata = new Map<number, HydrusFileMetadata>();
  files.forEach((f) => metadata.set(f.file_id, f));

  return {
    fileIds: files.map((f) => f.file_id),
    metadata,
  };
}

/**
 * Create MSW handlers for Hydrus API endpoints.
 */
export function createHydrusHandlers(state: MockHydrusState) {
  return [
    // verify_access_key
    http.get(`${HYDRUS_URL}/verify_access_key`, () => {
      return HttpResponse.json({
        basic_permissions: [0, 1, 2, 3],
        human_description: 'Full access',
      });
    }),

    // get_files/search_files
    http.get(`${HYDRUS_URL}/get_files/search_files`, () => {
      if (state.searchError) {
        return HttpResponse.json(
          { error: state.searchError.message },
          { status: 500 }
        );
      }
      return HttpResponse.json(createMockSearchResponse(state.fileIds));
    }),

    // get_files/file_metadata
    http.get(`${HYDRUS_URL}/get_files/file_metadata`, async ({ request }) => {
      if (state.metadataDelayMs) {
        await new Promise((r) => setTimeout(r, state.metadataDelayMs));
      }

      if (state.metadataError) {
        return HttpResponse.json(
          { error: state.metadataError.message },
          { status: 500 }
        );
      }

      const url = new URL(request.url);
      const fileIdsParam = url.searchParams.get('file_ids');

      if (!fileIdsParam) {
        return HttpResponse.json({ error: 'file_ids required' }, { status: 400 });
      }

      const fileIds: number[] = JSON.parse(fileIdsParam);
      const metadata = fileIds
        .map((id) => state.metadata.get(id))
        .filter((m): m is HydrusFileMetadata => m !== undefined);

      return HttpResponse.json(createMockMetadataResponse(metadata));
    }),
  ];
}

/**
 * Create and return a configured MSW server for Hydrus API.
 */
export function createMockHydrusServer(state: MockHydrusState) {
  return setupServer(...createHydrusHandlers(state));
}

/**
 * Helper to add files to mock state.
 */
export function addFilesToState(
  state: MockHydrusState,
  files: HydrusFileMetadata[]
): void {
  files.forEach((f) => {
    if (!state.fileIds.includes(f.file_id)) {
      state.fileIds.push(f.file_id);
    }
    state.metadata.set(f.file_id, f);
  });
}
