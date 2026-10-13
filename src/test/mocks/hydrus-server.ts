import { http, HttpResponse, type RequestHandler } from 'msw';
import { setupServer, type SetupServer } from 'msw/node';
import type { HydrusFileMetadata, HydrusServicesObject } from '@/lib/hydrus/types';
import {
  createMockFileBatch,
  createMockSearchResponse,
  createMockMetadataResponse,
} from './fixtures/hydrus-metadata';

const HYDRUS_URL = 'http://localhost:45869';

/** Service keys of the default mock services (hex, like real Hydrus keys). */
export const MOCK_SERVICE_KEYS = {
  myTags: '6c6f63616c2074616773',
  ptr: 'aa'.repeat(32),
  allKnownTags: '616c6c206b6e6f776e2074616773',
} as const;

/** Default /get_services payload: one local tag service, a PTR, and the union. */
export function createDefaultMockServices(): HydrusServicesObject {
  return {
    [MOCK_SERVICE_KEYS.myTags]: { name: 'my tags', type: 5, type_pretty: 'local tag service' },
    [MOCK_SERVICE_KEYS.ptr]: { name: 'public tag repository', type: 0, type_pretty: 'hydrus tag repository' },
    [MOCK_SERVICE_KEYS.allKnownTags]: { name: 'all known tags', type: 10, type_pretty: 'virtual combined tag service' },
    '6c6f63616c2066696c6573': { name: 'my files', type: 2, type_pretty: 'local file domain' },
  };
}

/**
 * State for the mock Hydrus server.
 * Tests can modify this to control server responses.
 */
export interface MockHydrusState {
  fileIds: number[];
  metadata: Map<number, HydrusFileMetadata>;
  searchError?: Error;
  searchErrorStatusCode?: number;
  metadataError?: Error;
  metadataErrorStatusCode?: number;
  metadataDelayMs?: number;
  metadataMalformedJsonResponses?: number;
  /** Services reported by /get_services. */
  services: HydrusServicesObject;
  servicesError?: Error;
  servicesErrorStatusCode?: number;
  /** Count of /get_services requests served (for "no extra call" assertions). */
  servicesRequestCount: number;
  /** Query params of every search_files request, in order. */
  searchRequests: URLSearchParams[];
}

export function createMockHydrusState(fileCount = 0): MockHydrusState {
  const files = createMockFileBatch(fileCount);
  const metadata = new Map<number, HydrusFileMetadata>();
  files.forEach((f) => metadata.set(f.file_id, f));

  return {
    fileIds: files.map((f) => f.file_id),
    metadata,
    services: createDefaultMockServices(),
    servicesRequestCount: 0,
    searchRequests: [],
  };
}

/**
 * Create MSW handlers for Hydrus API endpoints.
 */
export function createHydrusHandlers(state: MockHydrusState): RequestHandler[] {
  return [
    // verify_access_key
    http.get(`${HYDRUS_URL}/verify_access_key`, () => {
      return HttpResponse.json({
        basic_permissions: [0, 1, 2, 3],
        human_description: 'Full access',
      });
    }),

    // get_services
    http.get(`${HYDRUS_URL}/get_services`, () => {
      state.servicesRequestCount++;
      if (state.servicesError) {
        return HttpResponse.json(
          { error: state.servicesError.message },
          { status: state.servicesErrorStatusCode ?? 500 }
        );
      }
      return HttpResponse.json({ version: 1, hydrus_version: 575, services: state.services });
    }),

    // get_files/search_files
    http.get(`${HYDRUS_URL}/get_files/search_files`, ({ request }) => {
      state.searchRequests.push(new URL(request.url).searchParams);
      if (state.searchError) {
        return HttpResponse.json(
          { error: state.searchError.message },
          { status: state.searchErrorStatusCode ?? 500 }
        );
      }
      // Get hashes from metadata to match actual file hashes
      const hashes = state.fileIds.map(id => state.metadata.get(id)?.hash ?? '');
      return HttpResponse.json({
        ...createMockSearchResponse(state.fileIds),
        hashes,
      });
    }),

    // get_files/file_metadata
    http.get(`${HYDRUS_URL}/get_files/file_metadata`, async ({ request }) => {
      if (state.metadataDelayMs) {
        await new Promise((r) => setTimeout(r, state.metadataDelayMs));
      }

      if (state.metadataError) {
        return HttpResponse.json(
          { error: state.metadataError.message },
          { status: state.metadataErrorStatusCode ?? 500 }
        );
      }

      if ((state.metadataMalformedJsonResponses ?? 0) > 0) {
        state.metadataMalformedJsonResponses = (state.metadataMalformedJsonResponses ?? 0) - 1;
        return new HttpResponse('{"metadata":[', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
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
export function createMockHydrusServer(state: MockHydrusState): SetupServer {
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

/**
 * Helper to remove files from mock state (simulates deletion in Hydrus).
 */
export function removeFilesFromState(
  state: MockHydrusState,
  fileIds: number[]
): void {
  state.fileIds = state.fileIds.filter(id => !fileIds.includes(id));
  fileIds.forEach(id => state.metadata.delete(id));
}
