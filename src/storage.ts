/**
 * Storage implementation for the Quip MCP Server
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { StorageInterface, StorageOptions } from './types';
import { csvCache, metadataCache } from './cache';
import { logger } from './logger';
import { StorageError } from './errors';

/**
 * Local file system storage implementation
 */
export class LocalStorage implements StorageInterface {
  private storagePath: string;
  private isFileProtocol: boolean;
  
  /**
   * Initialize local storage
   * 
   * @param storagePath Storage path
   * @param isFileProtocol Whether to use file protocol for resource URIs
   */
  constructor(storagePath: string, isFileProtocol: boolean) {
    this.storagePath = storagePath;
    this.isFileProtocol = isFileProtocol;
    fs.mkdirpSync(storagePath);
    logger.info(`LocalStorage initialized with path: ${storagePath}, is_file_protocol: ${isFileProtocol}`);
  }
  
  /**
   * Get file path for a thread and sheet
   * 
   * @param threadId Quip document thread ID
   * @param sheetName Sheet name (optional)
   * @returns File path
   */
  private getFilePath(threadId: string, sheetName?: string): string {
    let fileName = `${threadId}`;
    if (sheetName) {
      // Replace invalid filename characters
      const safeSheetName = sheetName.replace(/[/\\]/g, '_');
      fileName += `-${safeSheetName}`;
    }
    fileName += '.csv';
    return path.join(this.storagePath, fileName);
  }
  
  /**
   * Save CSV content to local file
   * 
   * @param threadId Quip document thread ID
   * @param csvContent CSV content
   * @param sheetName Sheet name (optional)
   * @returns Promise resolving to file path
   */
  async saveCSV(threadId: string, csvContent: string, sheetName?: string): Promise<string> {
    try {
      const filePath = this.getFilePath(threadId, sheetName);
      await fs.writeFile(filePath, csvContent, 'utf-8');
      
      // Calculate and save metadata
      const metadata = {
        total_rows: csvContent.split('\n').length,
        total_size: csvContent.length,
        resource_uri: this.getResourceURI(threadId, sheetName),
        last_updated: new Date().toISOString()
      };
      
      // Save metadata to a separate file
      const metadataPath = `${filePath}.meta`;
      await fs.writeFile(metadataPath, JSON.stringify(metadata), 'utf-8');
      
      // Update caches
      const cacheKey = this.getCacheKey(threadId, sheetName);
      csvCache.set(cacheKey, csvContent);
      metadataCache.set(cacheKey, metadata);
      
      logger.info(`Saved CSV to ${filePath}`, {
        bytes: metadata.total_size,
        rows: metadata.total_rows
      });
      
      return filePath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to save CSV for thread ${threadId}`, { error: errorMessage });
      throw new StorageError(`Failed to save CSV: ${errorMessage}`);
    }
  }
  
  /**
   * Get CSV content from local file
   * 
   * @param threadId Quip document thread ID
   * @param sheetName Sheet name (optional)
   * @returns Promise resolving to CSV content, or null if file doesn't exist
   */
  async getCSV(threadId: string, sheetName?: string): Promise<string | null> {
    try {
      const cacheKey = this.getCacheKey(threadId, sheetName);
      
      // Try to get from cache first
      const cachedContent = csvCache.get(cacheKey);
      if (cachedContent) {
        logger.debug(`Retrieved CSV from cache for thread ${threadId}`, {
          sheetName: sheetName || 'default',
          bytes: cachedContent.length
        });
        return cachedContent;
      }
      
      // If not in cache, read from file
      const filePath = this.getFilePath(threadId, sheetName);
      if (!await fs.pathExists(filePath)) {
        logger.warn(`CSV file not found: ${filePath}`);
        return null;
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Update cache
      csvCache.set(cacheKey, content);
      
      logger.info(`Retrieved CSV from ${filePath}`, { bytes: content.length });
      return content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get CSV for thread ${threadId}`, { error: errorMessage });
      throw new StorageError(`Failed to get CSV: ${errorMessage}`);
    }
  }
  
  /**
   * Get resource URI
   * 
   * @param threadId Quip document thread ID
   * @param sheetName Sheet name (optional)
   * @returns Resource URI
   */
  getResourceURI(threadId: string, sheetName?: string): string {
    if (this.isFileProtocol) {
      return `file://${this.getFilePath(threadId, sheetName)}`;
    }
    if (sheetName) {
      return `quip://${threadId}?sheet=${encodeURIComponent(sheetName)}`;
    }
    return `quip://${threadId}`;
  }
  
  /**
   * Get metadata for the stored CSV
   * 
   * @param threadId Quip document thread ID
   * @param sheetName Sheet name (optional)
   * @returns Promise resolving to metadata including total_rows, total_size, etc.
   */
  async getMetadata(threadId: string, sheetName?: string): Promise<Record<string, any>> {
    try {
      const cacheKey = this.getCacheKey(threadId, sheetName);
      
      // Try to get from cache first
      const cachedMetadata = metadataCache.get(cacheKey);
      if (cachedMetadata) {
        logger.debug(`Retrieved metadata from cache for thread ${threadId}`, {
          sheetName: sheetName || 'default'
        });
        return cachedMetadata;
      }
      
      const filePath = this.getFilePath(threadId, sheetName);
      const metadataPath = `${filePath}.meta`;
      
      if (!await fs.pathExists(metadataPath)) {
        logger.warn(`Metadata file not found: ${metadataPath}`);
        // If metadata file doesn't exist but CSV file does, generate metadata
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf-8');
          
          const metadata = {
            total_rows: content.split('\n').length,
            total_size: content.length,
            resource_uri: this.getResourceURI(threadId, sheetName),
            last_updated: new Date().toISOString()
          };
          
          // Save the generated metadata
          await fs.writeFile(metadataPath, JSON.stringify(metadata), 'utf-8');
          
          // Update cache
          metadataCache.set(cacheKey, metadata);
          
          return metadata;
        }
        
        // If neither file exists, return empty metadata
        const emptyMetadata = {
          total_rows: 0,
          total_size: 0,
          resource_uri: this.getResourceURI(threadId, sheetName),
          last_updated: null
        };
        
        return emptyMetadata;
      }
      
      // Read metadata from file
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      
      // Update cache
      metadataCache.set(cacheKey, metadata);
      
      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get metadata for thread ${threadId}`, { error: errorMessage });
      throw new StorageError(`Failed to get metadata: ${errorMessage}`);
    }
  }
  
  /**
   * Get cache key for a thread and sheet
   *
   * @param threadId Quip document thread ID
   * @param sheetName Sheet name (optional)
   * @returns Cache key
   */
  private getCacheKey(threadId: string, sheetName?: string): string {
    return sheetName ? `${threadId}:${sheetName}` : threadId;
  }
}

/**
 * Truncate CSV content to be under the specified maximum size
 * 
 * @param csvContent Original CSV content
 * @param maxSize Maximum size in bytes (default: 10KB)
 * @returns Tuple of truncated CSV content and a boolean indicating if truncation occurred
 */
export function truncateCSVContent(csvContent: string, maxSize: number = 10 * 1024): [string, boolean] {
  if (csvContent.length <= maxSize) {
    return [csvContent, false];
  }
  
  const lines = csvContent.split('\n');
  const header = lines[0] || '';
  
  // Always include the header
  const result = [header];
  let currentSize = header.length + 1; // +1 for newline
  
  // Add as many data rows as possible without exceeding maxSize
  for (let i = 1; i < lines.length; i++) {
    const lineSize = lines[i].length + 1; // +1 for newline
    if (currentSize + lineSize > maxSize) {
      break;
    }
    
    result.push(lines[i]);
    currentSize += lineSize;
  }
  
  const truncatedContent = result.join('\n');
  logger.info(`Truncated CSV from ${csvContent.length} bytes to ${truncatedContent.length} bytes`);
  return [truncatedContent, true];
}

/**
 * Factory function to create storage instance
 * 
 * @param storageType Storage type, currently supports "local"
 * @param options Parameters passed to storage constructor
 * @returns Storage instance
 * @throws Error if storage type is not supported
 */
export function createStorage(storageType: string, options: StorageOptions): StorageInterface {
  if (storageType === 'local') {
    return new LocalStorage(options.storagePath, options.isFileProtocol);
  }
  throw new Error(`Unsupported storage type: ${storageType}`);
}