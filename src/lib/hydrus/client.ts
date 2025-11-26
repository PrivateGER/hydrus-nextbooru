import type {
  HydrusSearchResponse,
  HydrusMetadataResponse,
  HydrusFilePathResponse,
  HydrusThumbnailPathResponse,
  HydrusServicesResponse,
  HydrusVerifyAccessKeyResponse,
  HydrusFileSortType,
} from "./types";

export interface HydrusClientConfig {
  apiUrl: string;
  apiKey: string;
}

export class HydrusClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(config?: HydrusClientConfig) {
    this.apiUrl = config?.apiUrl || process.env.HYDRUS_API_URL || "http://localhost:45869";
    this.apiKey = config?.apiKey || process.env.HYDRUS_API_KEY || "";

    if (!this.apiKey) {
      throw new Error("Hydrus API key is required. Set HYDRUS_API_KEY environment variable.");
    }
  }

  private async request<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const url = new URL(endpoint, this.apiUrl);

    // Add query params
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value) || typeof value === "object") {
            url.searchParams.set(key, JSON.stringify(value));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        "Hydrus-Client-API-Access-Key": this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new HydrusApiError(
        `Hydrus API error: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Verify the API key and get permissions
   */
  async verifyAccessKey(): Promise<HydrusVerifyAccessKeyResponse> {
    return this.request<HydrusVerifyAccessKeyResponse>("/verify_access_key");
  }

  /**
   * Get all services configured in Hydrus
   */
  async getServices(): Promise<HydrusServicesResponse> {
    return this.request<HydrusServicesResponse>("/get_services");
  }

  /**
   * Search for files by tags
   */
  async searchFiles(options: {
    tags: string[];
    fileServiceKey?: string;
    tagServiceKey?: string;
    fileSortType?: HydrusFileSortType;
    fileSortAsc?: boolean;
    returnHashes?: boolean;
  }): Promise<HydrusSearchResponse> {
    return this.request<HydrusSearchResponse>("/get_files/search_files", {
      tags: options.tags,
      file_service_key: options.fileServiceKey,
      tag_service_key: options.tagServiceKey,
      file_sort_type: options.fileSortType,
      file_sort_asc: options.fileSortAsc,
      return_hashes: options.returnHashes ?? true,
      return_file_ids: true,
    });
  }

  /**
   * Get metadata for files by IDs or hashes
   */
  async getFileMetadata(options: {
    fileIds?: number[];
    hashes?: string[];
    includeNotes?: boolean;
    includeBlurhash?: boolean;
    onlyReturnBasicInfo?: boolean;
  }): Promise<HydrusMetadataResponse> {
    if (!options.fileIds && !options.hashes) {
      throw new Error("Either fileIds or hashes must be provided");
    }

    return this.request<HydrusMetadataResponse>("/get_files/file_metadata", {
      file_ids: options.fileIds,
      hashes: options.hashes,
      include_notes: options.includeNotes ?? false,
      include_blurhash: options.includeBlurhash ?? true,
      only_return_basic_information: options.onlyReturnBasicInfo ?? false,
    });
  }

  /**
   * Get the local file path for a file
   */
  async getFilePath(options: { fileId?: number; hash?: string }): Promise<HydrusFilePathResponse> {
    if (!options.fileId && !options.hash) {
      throw new Error("Either fileId or hash must be provided");
    }

    return this.request<HydrusFilePathResponse>("/get_files/file_path", {
      file_id: options.fileId,
      hash: options.hash,
    });
  }

  /**
   * Get the local thumbnail path for a file
   */
  async getThumbnailPath(options: {
    fileId?: number;
    hash?: string;
    includeFiletype?: boolean;
  }): Promise<HydrusThumbnailPathResponse> {
    if (!options.fileId && !options.hash) {
      throw new Error("Either fileId or hash must be provided");
    }

    return this.request<HydrusThumbnailPathResponse>("/get_files/thumbnail_path", {
      file_id: options.fileId,
      hash: options.hash,
      include_thumbnail_filetype: options.includeFiletype ?? true,
    });
  }

  /**
   * Get the actual file bytes (useful for proxying)
   */
  async getFile(options: { fileId?: number; hash?: string }): Promise<Response> {
    if (!options.fileId && !options.hash) {
      throw new Error("Either fileId or hash must be provided");
    }

    const url = new URL("/get_files/file", this.apiUrl);
    if (options.fileId) {
      url.searchParams.set("file_id", String(options.fileId));
    } else if (options.hash) {
      url.searchParams.set("hash", options.hash);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "Hydrus-Client-API-Access-Key": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new HydrusApiError(
        `Hydrus API error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    return response;
  }

  /**
   * Get the actual thumbnail bytes (useful for proxying)
   */
  async getThumbnail(options: { fileId?: number; hash?: string }): Promise<Response> {
    if (!options.fileId && !options.hash) {
      throw new Error("Either fileId or hash must be provided");
    }

    const url = new URL("/get_files/thumbnail", this.apiUrl);
    if (options.fileId) {
      url.searchParams.set("file_id", String(options.fileId));
    } else if (options.hash) {
      url.searchParams.set("hash", options.hash);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "Hydrus-Client-API-Access-Key": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new HydrusApiError(
        `Hydrus API error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    return response;
  }
}

export class HydrusApiError extends Error {
  public statusCode: number;
  public responseBody?: string;

  constructor(message: string, statusCode: number, responseBody?: string) {
    super(message);
    this.name = "HydrusApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

// Singleton instance with default config
let defaultClient: HydrusClient | null = null;

export function getHydrusClient(): HydrusClient {
  if (!defaultClient) {
    defaultClient = new HydrusClient();
  }
  return defaultClient;
}
