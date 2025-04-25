import { LocalStorage, truncateCSVContent, createStorage } from '../../src/storage';
import { StorageError } from '../../src/errors';
import { csvCache, metadataCache } from '../../src/cache';

// Import fs-extra as a variable that can be referenced throughout the tests
const fs = require('fs-extra');

// Mock modules
jest.mock('fs-extra');
// Mock logger
jest.mock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Storage Implementation', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    csvCache.clear();
    metadataCache.clear();
  });

  describe('LocalStorage', () => {
    const storagePath = '/test/storage';
    const threadId = 'test-thread-id';
    const sheetName = 'Test Sheet';
    const csvContent = 'header1,header2\nvalue1,value2\nvalue3,value4';

    describe('constructor', () => {
      it('should initialize storage with the given path', () => {
        // Mock fs.mkdirpSync
        fs.mkdirpSync.mockImplementation(() => {});

        const storage = new LocalStorage(storagePath, false);
        expect(fs.mkdirpSync).toHaveBeenCalledWith(storagePath);
        expect((storage as any).storagePath).toBe(storagePath);
        expect((storage as any).isFileProtocol).toBe(false);
      });
    });

    describe('saveCSV', () => {
      it('should save CSV content to a file', async () => {
        // Mock fs functions
        fs.writeFile.mockResolvedValue(undefined);

        const storage = new LocalStorage(storagePath, false);
        const filePath = await storage.saveCSV(threadId, csvContent);

        // Check if file was written
        expect(fs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining(threadId),
          csvContent,
          'utf-8'
        );

        // Check if metadata was written
        expect(fs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining(`${threadId}.csv.meta`),
          expect.any(String),
          'utf-8'
        );

        // Check if cache was updated
        const cacheKey = (storage as any).getCacheKey(threadId);
        expect(csvCache.get(cacheKey)).toBe(csvContent);
        expect(metadataCache.has(cacheKey)).toBe(true);

        // Check return value
        expect(filePath).toContain(threadId);
      });

      it('should save CSV content with sheet name', async () => {
        // Mock fs functions
        fs.writeFile.mockResolvedValue(undefined);

        const storage = new LocalStorage(storagePath, false);
        const filePath = await storage.saveCSV(threadId, csvContent, sheetName);

        // Check if file was written with sheet name
        expect(fs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining(`${threadId}-${sheetName}`),
          csvContent,
          'utf-8'
        );

        // Check return value
        expect(filePath).toContain(sheetName);
      });

      it('should handle errors when saving CSV', async () => {
        // Mock fs.writeFile to throw an error
        const errorMessage = 'Failed to write file';
        fs.writeFile.mockRejectedValue(new Error(errorMessage));

        const storage = new LocalStorage(storagePath, false);
        
        // Expect the saveCSV method to throw a StorageError
        await expect(storage.saveCSV(threadId, csvContent)).rejects.toThrow(StorageError);
        await expect(storage.saveCSV(threadId, csvContent)).rejects.toThrow(errorMessage);
      });
    });

    describe('getCSV', () => {
      it('should get CSV content from cache if available', async () => {
        const storage = new LocalStorage(storagePath, false);
        const cacheKey = (storage as any).getCacheKey(threadId);
        
        // Add to cache
        csvCache.set(cacheKey, csvContent);
        
        // Get from cache
        const result = await storage.getCSV(threadId);
        
        // Should not read from file
        expect(fs.readFile).not.toHaveBeenCalled();
        expect(result).toBe(csvContent);
      });

      it('should get CSV content from file if not in cache', async () => {
        // Mock fs functions
        fs.pathExists.mockResolvedValue(true);
        fs.readFile.mockResolvedValue(csvContent);

        const storage = new LocalStorage(storagePath, false);
        const result = await storage.getCSV(threadId);
        
        // Should read from file
        expect(fs.pathExists).toHaveBeenCalled();
        expect(fs.readFile).toHaveBeenCalledWith(
          expect.stringContaining(threadId),
          'utf-8'
        );
        expect(result).toBe(csvContent);
        
        // Should update cache
        const cacheKey = (storage as any).getCacheKey(threadId);
        expect(csvCache.get(cacheKey)).toBe(csvContent);
      });

      it('should return null if file does not exist', async () => {
        // Mock fs.pathExists to return false
        fs.pathExists.mockResolvedValue(false);

        const storage = new LocalStorage(storagePath, false);
        const result = await storage.getCSV(threadId);
        
        expect(result).toBeNull();
      });

      it('should handle errors when getting CSV', async () => {
        // Mock fs.pathExists to throw an error
        const errorMessage = 'Failed to read file';
        fs.pathExists.mockRejectedValue(new Error(errorMessage));

        const storage = new LocalStorage(storagePath, false);
        
        // Expect the getCSV method to throw a StorageError
        await expect(storage.getCSV(threadId)).rejects.toThrow(StorageError);
        await expect(storage.getCSV(threadId)).rejects.toThrow(errorMessage);
      });
    });

    describe('getResourceURI', () => {
      it('should return file protocol URI when isFileProtocol is true', () => {
        const storage = new LocalStorage(storagePath, true);
        const uri = storage.getResourceURI(threadId);
        
        expect(uri).toMatch(/^file:\/\//);
        expect(uri).toContain(threadId);
      });

      it('should return quip protocol URI when isFileProtocol is false', () => {
        const storage = new LocalStorage(storagePath, false);
        const uri = storage.getResourceURI(threadId);
        
        expect(uri).toMatch(/^quip:\/\//);
        expect(uri).toContain(threadId);
      });

      it('should include sheet name in quip protocol URI when provided', () => {
        const storage = new LocalStorage(storagePath, false);
        const uri = storage.getResourceURI(threadId, sheetName);
        
        expect(uri).toMatch(/^quip:\/\//);
        expect(uri).toContain(threadId);
        expect(uri).toContain(encodeURIComponent(sheetName));
      });
    });

    describe('getMetadata', () => {
      it('should get metadata from cache if available', async () => {
        const storage = new LocalStorage(storagePath, false);
        const cacheKey = (storage as any).getCacheKey(threadId);
        const metadata = {
          total_rows: 3,
          total_size: csvContent.length,
          resource_uri: `quip://${threadId}`,
          last_updated: new Date().toISOString()
        };
        
        // Add to cache
        metadataCache.set(cacheKey, metadata);
        
        // Get from cache
        const result = await storage.getMetadata(threadId);
        
        // Should not read from file
        expect(fs.readFile).not.toHaveBeenCalled();
        expect(result).toEqual(metadata);
      });

      it('should get metadata from file if not in cache', async () => {
        const metadata = {
          total_rows: 3,
          total_size: csvContent.length,
          resource_uri: `quip://${threadId}`,
          last_updated: new Date().toISOString()
        };
        
        // Mock fs functions
        fs.pathExists.mockImplementation((path: string | Buffer) => {
          return Promise.resolve(path.toString().endsWith('.meta'));
        });
        fs.readFile.mockResolvedValue(JSON.stringify(metadata));

        const storage = new LocalStorage(storagePath, false);
        const result = await storage.getMetadata(threadId);
        
        // Should read from file
        expect(fs.pathExists).toHaveBeenCalled();
        expect(fs.readFile).toHaveBeenCalledWith(
          expect.stringContaining(`${threadId}.csv.meta`),
          'utf-8'
        );
        expect(result).toEqual(metadata);
        
        // Should update cache
        const cacheKey = (storage as any).getCacheKey(threadId);
        expect(metadataCache.get(cacheKey)).toEqual(metadata);
      });

      it('should generate metadata if metadata file does not exist but CSV file does', async () => {
        // Mock fs functions
        fs.pathExists.mockImplementation((path: string | Buffer) => {
          return Promise.resolve(!path.toString().endsWith('.meta'));
        });
        fs.readFile.mockResolvedValue(csvContent);
        fs.writeFile.mockResolvedValue(undefined);

        const storage = new LocalStorage(storagePath, false);
        const result = await storage.getMetadata(threadId);
        
        // Should read CSV file
        expect(fs.readFile).toHaveBeenCalledWith(
          expect.stringContaining(threadId),
          'utf-8'
        );
        
        // Should write metadata file
        expect(fs.writeFile).toHaveBeenCalled();
        
        // Should return generated metadata
        expect(result).toHaveProperty('total_rows', 3);
        expect(result).toHaveProperty('total_size', csvContent.length);
        expect(result).toHaveProperty('resource_uri');
        expect(result).toHaveProperty('last_updated');
      });

      it('should return empty metadata if neither metadata nor CSV file exists', async () => {
        // Mock fs functions
        fs.pathExists.mockResolvedValue(false);

        const storage = new LocalStorage(storagePath, false);
        const result = await storage.getMetadata(threadId);
        
        // Should return empty metadata
        expect(result).toHaveProperty('total_rows', 0);
        expect(result).toHaveProperty('total_size', 0);
        expect(result).toHaveProperty('resource_uri');
        expect(result).toHaveProperty('last_updated', null);
      });

      it('should handle errors when getting metadata', async () => {
        // Mock fs.pathExists to throw an error
        const errorMessage = 'Failed to read metadata';
        fs.pathExists.mockRejectedValue(new Error(errorMessage));

        const storage = new LocalStorage(storagePath, false);
        
        // Expect the getMetadata method to throw a StorageError
        await expect(storage.getMetadata(threadId)).rejects.toThrow(StorageError);
        await expect(storage.getMetadata(threadId)).rejects.toThrow(errorMessage);
      });
    });
  });

  describe('truncateCSVContent', () => {
    it('should not truncate CSV content if it is under the max size', () => {
      const csvContent = 'header1,header2\nvalue1,value2';
      const maxSize = 100;
      
      const [truncated, isTruncated] = truncateCSVContent(csvContent, maxSize);
      
      expect(truncated).toBe(csvContent);
      expect(isTruncated).toBe(false);
    });

    it('should truncate CSV content if it is over the max size', () => {
      const header = 'header1,header2';
      const row1 = 'value1,value2';
      const row2 = 'value3,value4';
      const row3 = 'value5,value6';
      const csvContent = `${header}\n${row1}\n${row2}\n${row3}`;
      const maxSize = header.length + row1.length + 2; // Header + first row + 2 newlines
      
      const [truncated, isTruncated] = truncateCSVContent(csvContent, maxSize);
      
      expect(truncated).toBe(`${header}\n${row1}`);
      expect(isTruncated).toBe(true);
    });

    it('should always include the header row', () => {
      const header = 'header1,header2';
      const row1 = 'value1,value2';
      const csvContent = `${header}\n${row1}`;
      const maxSize = header.length - 1; // Less than header length
      
      const [truncated, isTruncated] = truncateCSVContent(csvContent, maxSize);
      
      expect(truncated).toBe(header);
      expect(isTruncated).toBe(true);
    });
  });

  describe('createStorage', () => {
    it('should create a LocalStorage instance when type is "local"', () => {
      const options = {
        storagePath: '/test/storage',
        isFileProtocol: false
      };
      
      const storage = createStorage('local', options);
      
      expect(storage).toBeInstanceOf(LocalStorage);
    });

    it('should throw an error for unsupported storage types', () => {
      const options = {
        storagePath: '/test/storage',
        isFileProtocol: false
      };
      
      expect(() => createStorage('unsupported', options)).toThrow('Unsupported storage type');
    });
  });
});
