/**
 * Storage implementation for the Quip MCP Server
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
    
    // Create the directory only if we're using local storage
    if (process.env.STORAGE_TYPE !== 's3') {
      try {
        fs.mkdirpSync(storagePath);
        logger.info(`LocalStorage initialized with path: ${storagePath}, is_file_protocol: ${isFileProtocol}`);
      } catch (error) {
        logger.warn(`Failed to create storage directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      logger.info(`LocalStorage constructor called but not used (S3 storage mode)`);
    }
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
 * S3 storage implementation
 */
export class S3Storage implements StorageInterface {
  private s3Client: S3Client;
  private bucket: string;
  private prefix: string;
  private urlExpiration: number;
  
  /**
   * Initialize S3 storage
   *
   * @param bucket S3 bucket name
   * @param region S3 region
   * @param prefix S3 object key prefix (optional)
   * @param urlExpiration URL expiration in seconds (default: 3600)
   */
  constructor(bucket: string, region: string, prefix: string = '', urlExpiration: number = 3600) {
    this.bucket = bucket;
    this.prefix = prefix.endsWith('/') || prefix === '' ? prefix : `${prefix}/`;
    this.urlExpiration = urlExpiration;
    
    this.s3Client = new S3Client({ region });
    
    // Check if presigned URLs should be used
    const usePresignedUrls = process.env.USE_PRESIGNED_URLS === 'true';
    
    logger.info(`S3Storage initialized with bucket: ${bucket}, region: ${region}, prefix: ${this.prefix}, use_presigned_urls: ${usePresignedUrls}`);
  }
  
  /**
   * Get S3 object key for a thread and sheet
   *
   * @param threadId Quip document thread ID
   * @param sheetName Sheet name (optional)
   * @returns S3 object key
   */
  private getObjectKey(threadId: string, sheetName?: string): string {
    let key = `${this.prefix}${threadId}`;
    if (sheetName) {
      // Replace invalid characters
      const safeSheetName = sheetName.replace(/[/\\]/g, '_');
      key += `-${safeSheetName}`;
    }
    key += '.csv';
    return key;
  }
  
  /**
   * Save CSV content to S3
   *
   * @param threadId Quip document thread ID
   * @param csvContent CSV content
   * @param sheetName Sheet name (optional)
   * @returns Promise resolving to S3 object key
   */
  async saveCSV(threadId: string, csvContent: string, sheetName?: string): Promise<string> {
    try {
      const key = this.getObjectKey(threadId, sheetName);
      
      // Upload CSV content to S3
      const putCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: csvContent,
        ContentType: 'text/csv',
      });
      
      await this.sendCommand(putCommand);
      
      // Calculate and save metadata
      const metadata = {
        total_rows: csvContent.split('\n').length,
        total_size: csvContent.length,
        resource_uri: this.getResourceURI(threadId, sheetName),
        last_updated: new Date().toISOString()
      };
      
      // Save metadata as a separate object
      const metadataKey = `${key}.meta`;
      const metadataPutCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: metadataKey,
        Body: JSON.stringify(metadata),
        ContentType: 'application/json',
      });
      
      await this.sendCommand(metadataPutCommand);
      
      // Update caches
      const cacheKey = this.getCacheKey(threadId, sheetName);
      csvCache.set(cacheKey, csvContent);
      metadataCache.set(cacheKey, metadata);
      
      logger.info(`Saved CSV to S3: ${this.bucket}/${key}`, {
        bytes: metadata.total_size,
        rows: metadata.total_rows
      });
      
      return key;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to save CSV to S3 for thread ${threadId}`, { error: errorMessage });
      throw new StorageError(`Failed to save CSV to S3: ${errorMessage}`);
    }
  }
  
  /**
   * Get CSV content from S3
   *
   * @param threadId Quip document thread ID
   * @param sheetName Sheet name (optional)
   * @returns Promise resolving to CSV content, or null if object doesn't exist
   */
  /**
   * Send a command to S3
   *
   * @param command Command to send
   * @returns Promise resolving to command response
   */
  protected async sendCommand(command: any): Promise<any> {
    return this.s3Client.send(command);
  }

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
      
      // If not in cache, get from S3
      const key = this.getObjectKey(threadId, sheetName);
      
      // Check if object exists
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
        await this.sendCommand(headCommand);
      } catch (error) {
        // Object doesn't exist
        logger.warn(`CSV object not found in S3: ${this.bucket}/${key}`);
        return null;
      }
      
      // Get object
      const getCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      
      const response = await this.sendCommand(getCommand);
      
      if (!response.Body) {
        throw new Error('Response body is undefined');
      }
      
      // Convert stream to string
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body) {
        chunks.push(Buffer.from(chunk));
      }
      const content = Buffer.concat(chunks).toString('utf-8');
      
      // Update cache
      csvCache.set(cacheKey, content);
      
      logger.info(`Retrieved CSV from S3: ${this.bucket}/${key}`, { bytes: content.length });
      return content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get CSV from S3 for thread ${threadId}`, { error: errorMessage });
      throw new StorageError(`Failed to get CSV from S3: ${errorMessage}`);
    }
  }
  
  /**
   * Get resource URI
   *
   * @param threadId Quip document thread ID
   * @param sheetName Sheet name (optional)
   * @returns Resource URI (presigned S3 URL or s3:// URI)
   */
  getResourceURI(threadId: string, sheetName?: string): string {
    // Get the object key for the thread and sheet
    const key = this.getObjectKey(threadId, sheetName);
    
    // Check if we should generate a presigned URL
    const usePresignedUrl = process.env.USE_PRESIGNED_URLS === 'true';
    
    if (usePresignedUrl) {
      // Since getResourceURI is not async, we can't generate a presigned URL here
      // Instead, we'll return a special URI format that can be resolved later
      // The actual presigned URL will be generated when needed using the generatePresignedUrl method
      logger.debug(`Returning special URI format for presigned URL generation: ${threadId}, ${sheetName || 'default'}`);
      return `s3+https://${this.bucket}/${key}`;
    }
    
    // Fall back to s3:// URI format
    return `s3://${this.bucket}/${key}`;
  }
  
  /**
   * Generate a presigned URL for accessing the S3 object
   * This is a new method that can be used when an actual presigned URL is needed
   *
   * @param threadId Quip document thread ID
   * @param sheetName Sheet name (optional)
   * @returns Promise resolving to a presigned URL
   */
  async generatePresignedUrl(threadId: string, sheetName?: string): Promise<string> {
    try {
      // Get the object key for the thread and sheet
      const key = this.getObjectKey(threadId, sheetName);
      
      // Create a GetObject command for the S3 object
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      
      // Generate a presigned URL with the specified expiration time
      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: this.urlExpiration
      });
      
      logger.debug(`Generated presigned URL for ${key}, expires in ${this.urlExpiration} seconds`);
      
      return presignedUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to generate presigned URL for thread ${threadId}`, { error: errorMessage });
      throw new StorageError(`Failed to generate presigned URL: ${errorMessage}`);
    }
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
      
      const key = this.getObjectKey(threadId, sheetName);
      const metadataKey = `${key}.meta`;
      
      // Try to get metadata object
      try {
        const getCommand = new GetObjectCommand({
          Bucket: this.bucket,
          Key: metadataKey,
        });
        
        const response = await this.sendCommand(getCommand);
        
        if (!response.Body) {
          throw new Error('Response body is undefined');
        }
        
        // Convert stream to string
        const chunks: Buffer[] = [];
        for await (const chunk of response.Body) {
          chunks.push(Buffer.from(chunk));
        }
        const metadataContent = Buffer.concat(chunks).toString('utf-8');
        const metadata = JSON.parse(metadataContent);
        
        // Update cache
        metadataCache.set(cacheKey, metadata);
        
        return metadata;
      } catch (metadataError) {
        // Metadata object doesn't exist or error occurred
        logger.warn(`Metadata object not found in S3 or error: ${this.bucket}/${metadataKey}`);
        
        // Try to get the CSV object to generate metadata
        const csvContent = await this.getCSV(threadId, sheetName);
        if (csvContent) {
          const metadata = {
            total_rows: csvContent.split('\n').length,
            total_size: csvContent.length,
            resource_uri: this.getResourceURI(threadId, sheetName),
            last_updated: new Date().toISOString()
          };
          
          try {
            // Save the generated metadata
            const metadataPutCommand = new PutObjectCommand({
              Bucket: this.bucket,
              Key: metadataKey,
              Body: JSON.stringify(metadata),
              ContentType: 'application/json',
            });
            
            await this.sendCommand(metadataPutCommand);
          } catch (putError) {
            // Log error but continue
            logger.error(`Failed to save metadata to S3: ${this.bucket}/${metadataKey}`, {
              error: putError instanceof Error ? putError.message : String(putError)
            });
          }
          
          // Update cache
          metadataCache.set(cacheKey, metadata);
          
          return metadata;
        }
        
        // If neither object exists, return empty metadata
        const emptyMetadata = {
          total_rows: 0,
          total_size: 0,
          resource_uri: this.getResourceURI(threadId, sheetName),
          last_updated: null
        };
        
        return emptyMetadata;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get metadata from S3 for thread ${threadId}`, { error: errorMessage });
      throw new StorageError(`Failed to get metadata from S3: ${errorMessage}`);
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
 * Truncate CSV content to be under the specified maximum size while maintaining valid CSV structure
 * 
 * @param csvContent Original CSV content
 * @param maxSize Maximum size in bytes (default: 10KB)
 * @returns Tuple of truncated CSV content and a boolean indicating if truncation occurred
 */
export function truncateCSVContent(csvContent: string, maxSize: number = 10 * 1024): [string, boolean] {
  if (csvContent.length <= maxSize) {
    return [csvContent, false]; // No truncation needed
  }
  
  // Parse the CSV properly to handle quoted fields with embedded newlines
  // First, identify the header row
  let headerEndIndex = 0;
  let inQuote = false;
  
  // Find where the header row ends by tracking quotes
  for (let i = 0; i < csvContent.length; i++) {
    if (csvContent[i] === '"') {
      // Toggle quote state (accounting for escaped quotes)
      if (i + 1 < csvContent.length && csvContent[i + 1] === '"') {
        i++; // Skip escaped quote
      } else {
        inQuote = !inQuote;
      }
    } else if (csvContent[i] === '\n' && !inQuote) {
      headerEndIndex = i;
      break;
    }
  }
  
  // Get header row
  const header = csvContent.substring(0, headerEndIndex);
  
  // Now parse the CSV to find complete rows
  let currentPos = headerEndIndex + 1; // Start after header
  const completedRows = [header]; // Start with header
  let rowStartPos = currentPos;
  let currentSize = header.length + 1; // +1 for newline
  inQuote = false;
  
  while (currentPos < csvContent.length) {
    const char = csvContent[currentPos];
    
    // Handle quotes to properly track multi-line cells
    if (char === '"') {
      // Check for escaped quotes (two double quotes in a row)
      if (currentPos + 1 < csvContent.length && csvContent[currentPos + 1] === '"') {
        currentPos += 2; // Skip both quote characters
      } else {
        inQuote = !inQuote;
        currentPos++;
      }
      continue;
    }
    
    // If we find a row end (newline outside of quotes)
    if (char === '\n' && !inQuote) {
      const row = csvContent.substring(rowStartPos, currentPos);
      const rowSize = row.length + 1; // +1 for newline
      
      // Check if adding this row would exceed our size limit
      if (currentSize + rowSize > maxSize) {
        break; // Stop if adding this row would exceed maxSize
      }
      
      // Add the complete row
      completedRows.push(row);
      currentSize += rowSize;
      rowStartPos = currentPos + 1; // Start of next row
    }
    
    currentPos++;
  }
  
  const truncatedContent = completedRows.join('\n');
  logger.info(`Truncated CSV from ${csvContent.length} bytes to ${truncatedContent.length} bytes`);
  logger.info(`Truncated from ${csvContent.split('\n').length} lines to ${truncatedContent.split('\n').length} lines`);
  
  return [truncatedContent, true];
}

/**
 * Factory function to create storage instance
 *
 * @param storageType Storage type, supports "local" and "s3"
 * @param options Parameters passed to storage constructor
 * @returns Storage instance
 * @throws Error if storage type is not supported
 */
export function createStorage(storageType: string, options: StorageOptions): StorageInterface {
  // Export the storage type to environment for other components to check
  process.env.STORAGE_TYPE = storageType;
  
  logger.info(`Creating storage implementation for type: ${storageType}`);
  
  if (storageType === 'local') {
    return new LocalStorage(options.storagePath, options.isFileProtocol);
  } else if (storageType === 's3') {
    if (!options.s3Bucket) {
      throw new Error('S3 bucket name is required for S3 storage');
    }
    if (!options.s3Region) {
      throw new Error('S3 region is required for S3 storage');
    }
    
    return new S3Storage(
      options.s3Bucket,
      options.s3Region,
      options.s3Prefix || '',
      options.s3UrlExpiration || 3600
    );
  }
  throw new Error(`Unsupported storage type: ${storageType}`);
}
