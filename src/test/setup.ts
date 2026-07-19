import { beforeAll, afterEach, vi } from 'vitest';

// Set test environment variables
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.HYDRUS_API_URL = 'http://localhost:45869';
  process.env.HYDRUS_API_KEY = 'test-api-key';
  process.env.HYDRUS_FILES_PATH = '/test/files';
});

// Node >= 25 ships webstorage globals by default, and in the jsdom test
// environment they shadow jsdom's storage. Node's global is an accessor that
// throws on ANY access when --localstorage-file is unset (and vitest's jsdom
// pool aliases window to globalThis, so there is no separate jsdom binding to
// restore) — so probe each storage global and replace a broken or missing one
// with an in-memory Storage. On Node 24, where jsdom's own storage works,
// this is a no-op; in the plain 'node' environment no code touches storage
// and nothing happens.
function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(String(key)) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(String(key)),
    setItem: (key: string, value: string) => void data.set(String(key), String(value)),
  } as Storage;
}

function storageGlobalWorks(key: 'localStorage' | 'sessionStorage'): boolean {
  try {
    const storage = (globalThis as Record<string, Storage | undefined>)[key];
    storage?.getItem('__webstorage_probe__');
    return storage != null;
  } catch {
    return false;
  }
}

beforeAll(() => {
  if (!('window' in globalThis)) return;
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    if (!storageGlobalWorks(key)) {
      Object.defineProperty(globalThis, key, {
        value: createMemoryStorage(),
        configurable: true,
        writable: true,
      });
    }
  }
});

afterEach(() => {
  vi.clearAllMocks();
});
