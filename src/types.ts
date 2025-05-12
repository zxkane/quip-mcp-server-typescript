/**
 * Type definitions for the Quip MCP Server
 */

/**
 * Command line options for the server
 */
export interface CommandLineOptions {
  /**
   * Path to store CSV files
   */
  storagePath?: string;
  
  /**
   * Whether to use file protocol for resource URIs
   */
  fileProtocol: boolean;
  
  /**
   * Storage type (local or s3)
   */
  storageType: string;
  
  /**
   * S3 bucket name (for S3 storage)
   */
  s3Bucket?: string;
  
  /**
   * S3 region (for S3 storage)
   */
  s3Region?: string;
  
  /**
   * S3 prefix (for S3 storage)
   */
  s3Prefix?: string;
  
  /**
   * S3 URL expiration in seconds (for S3 storage)
   */
  s3UrlExpiration?: number;
  
  /**
   * Whether to enable debug logging
   */
  debug: boolean;
  
  /**
   * Whether to use mock mode (no real Quip token required)
   */
  mock: boolean;
  
  /**
   * Whether to output logs as JSON
   */
  json: boolean;
  
  /**
   * Path to log file (enables file logging when specified)
   */
  logFile?: string;
  
  /**
   * Whether to enable authentication
   */
  auth: boolean;
  
  /**
   * API key for authentication
   */
  apiKey?: string;
  
  /**
   * API key header name
   */
  apiKeyHeader?: string;
  
  /**
   * HTTP port to listen on
   */
  port?: number;
}

/**
 * Options for creating a server instance
 */
export interface ServerOptions {
  /**
   * Storage interface instance
   */
  storage: StorageInterface;
  
  /**
   * Whether to use mock mode
   */
  mock: boolean;
  
  /**
   * Whether to enable authentication
   */
  auth: boolean;
  
  /**
   * API key for authentication
   */
  apiKey?: string;
  
  /**
   * API key header name
   */
  apiKeyHeader?: string;
  
  /**
   * HTTP port to listen on
   */
  port?: number;
}

/**
 * Interface for storage implementations
 */
export interface StorageInterface {
  /**
   * Save CSV content
   * 
   * @param threadId - Quip document thread ID
   * @param sheetName - Sheet name (optional)
   * @param csvContent - CSV content
   * @returns Promise resolving to resource identifier (such as file path or object URL)
   */
  saveCSV(threadId: string, csvContent: string, sheetName?: string): Promise<string>;
  
  /**
   * Get CSV content
   * 
   * @param threadId - Quip document thread ID
   * @param sheetName - Sheet name (optional)
   * @returns Promise resolving to CSV content, or null if it doesn't exist
   */
  getCSV(threadId: string, sheetName?: string): Promise<string | null>;
  
  /**
   * Get resource URI
   * 
   * @param threadId - Quip document thread ID
   * @param sheetName - Sheet name (optional)
   * @returns Resource URI
   */
  getResourceURI(threadId: string, sheetName?: string): string;
  
  /**
   * Get metadata for the stored CSV
   * 
   * @param threadId - Quip document thread ID
   * @param sheetName - Sheet name (optional)
   * @returns Promise resolving to metadata including total_rows, total_size, etc.
   */
  getMetadata(threadId: string, sheetName?: string): Promise<Record<string, any>>;
}

/**
 * Options for creating a storage instance
 */
export interface StorageOptions {
  /**
   * Storage path
   */
  storagePath: string;
  
  /**
   * Whether to use file protocol for resource URIs
   */
  isFileProtocol: boolean;

  /**
   * S3 bucket name (for S3 storage)
   */
  s3Bucket?: string;

  /**
   * S3 region (for S3 storage)
   */
  s3Region?: string;

  /**
   * S3 prefix (for S3 storage)
   */
  s3Prefix?: string;

  /**
   * S3 URL expiration in seconds (for S3 storage)
   */
  s3UrlExpiration?: number;
}

/**
 * Arguments for the quip_read_spreadsheet tool
 */
export interface QuipReadSpreadsheetArgs {
  /**
   * Quip document thread ID
   */
  threadId: string;
  
  /**
   * Sheet name (optional)
   */
  sheetName?: string;
}

/**
 * Response for the quip_read_spreadsheet tool
 */
export interface QuipReadSpreadsheetResponse {
  /**
   * CSV content (possibly truncated)
   */
  csv_content: string;
  
  /**
   * Metadata
   */
  metadata: {
    /**
     * Total number of rows
     */
    total_rows: number;
    
    /**
     * Total size in bytes
     */
    total_size: number;
    
    /**
     * Whether the content was truncated
     */
    is_truncated: boolean;
    
    /**
     * Resource URI for accessing the complete content
     */
    resource_uri: string;
  };
}