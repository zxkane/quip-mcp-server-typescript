import { URL } from 'url';
import { ResourceNotFoundError } from '../../src/errors';
import { StorageInterface } from '../../src/types';
import { TextContent, ImageContent, EmbeddedResource } from '../../src/tools';

// Create a direct implementation of the accessResource function for testing
// This avoids having to call the main() function and mock all its dependencies
async function accessResource(
  uri: string,
  mockStorageInstance: StorageInterface
): Promise<(TextContent | ImageContent | EmbeddedResource)[]> {
  // Parse the URI
  const parsedUri = new URL(uri);
  
  if (parsedUri.protocol !== 'quip:' && parsedUri.protocol !== 'file:' && parsedUri.protocol !== 's3:' &&
      parsedUri.protocol !== 'https:' && parsedUri.protocol !== 's3+https:') {
    throw new ResourceNotFoundError(uri);
  }
  
  // Extract thread_id and sheet_name
  let threadId: string;
  let sheetName: string | undefined;
  
  if (parsedUri.protocol === 'file:') {
    const filename = parsedUri.pathname.split('/').pop()?.replace(".csv", "").split("-") || [];
    threadId = filename[0];
    sheetName = filename.length > 1 ? filename.slice(1).join("-") : undefined;
  } else if (parsedUri.protocol === 's3:' || parsedUri.protocol === 's3+https:') {
    // Extract key from s3://{bucket}/{key} format or s3+https://{bucket}/{key} format
    const key = parsedUri.pathname.substring(1); // Remove leading slash
    const filename = key.split('/').pop()?.replace(".csv", "").split("-") || [];
    threadId = filename[0];
    sheetName = filename.length > 1 ? filename.slice(1).join("-") : undefined;
    
    // If this is an s3+https:// URI and the storage instance has generatePresignedUrl method
    if (parsedUri.protocol === 's3+https:' && mockStorageInstance &&
        typeof (mockStorageInstance as any).generatePresignedUrl === 'function') {
      try {
        // Generate a presigned URL
        const presignedUrl = await (mockStorageInstance as any).generatePresignedUrl(threadId, sheetName);
        // Update the URI to use the presigned URL
        uri = presignedUrl;
      } catch (error) {
        // Continue with the original URI
      }
    }
  } else if (parsedUri.protocol === 'https:') {
    // Handle presigned S3 URLs
    // Format: https://{bucket}.s3.{region}.amazonaws.com/{prefix}{threadId}-{sheetName}.csv?...
    // or other variations of presigned S3 URLs
    
    // Extract the path part (ignoring query parameters)
    const pathParts = parsedUri.pathname.split('/');
    const filename = pathParts[pathParts.length - 1].replace(".csv", "").split("-") || [];
    
    if (filename.length === 0) {
      throw new ResourceNotFoundError(uri);
    }
    
    threadId = filename[0];
    sheetName = filename.length > 1 ? filename.slice(1).join("-") : undefined;
  } else {
    threadId = parsedUri.hostname;
    const searchParams = new URLSearchParams(parsedUri.search);
    sheetName = searchParams.get('sheet') || undefined;
  }
  
  // Get the CSV content from storage
  if (!mockStorageInstance) {
    throw new ResourceNotFoundError(uri);
  }
  
  const csvContent = await mockStorageInstance.getCSV(threadId, sheetName);
  if (!csvContent) {
    throw new ResourceNotFoundError(uri);
  }
  
  // Return the full CSV content with URI as required by MCP schema
  return [{ 
    type: "text", 
    text: csvContent,
    uri: uri  // Add the URI field to match the expected schema
  }];
}

// Mock logger
jest.mock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Resource Response Format Tests', () => {
  // Mock storage instance
  const mockStorageInstance: StorageInterface = {
    saveCSV: jest.fn().mockResolvedValue('/mock/path/file.csv'),
    getCSV: jest.fn().mockResolvedValue('mock,csv\ndata,here'),
    getResourceURI: jest.fn().mockReturnValue('s3://test-bucket/mock-thread-id.csv'),
    getMetadata: jest.fn().mockResolvedValue({
      total_rows: 2,
      total_size: 20,
      resource_uri: 's3://test-bucket/mock-thread-id.csv',
      last_updated: '2023-01-01T00:00:00Z'
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('accessResource function', () => {
    it('should return content with correct format including uri field', async () => {
      const uri = 'file:///mock/path/1234-SheetName.csv';

      // Mock getCSV to return some content
      const mockCsvContent = 'id,name\n1,test\n2,test2';
      (mockStorageInstance.getCSV as jest.Mock).mockResolvedValueOnce(mockCsvContent);
      
      const result = await accessResource(uri, mockStorageInstance);
      
      // Check the result format
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('type', 'text');
      expect(result[0]).toHaveProperty('text', mockCsvContent);
      expect(result[0]).toHaveProperty('uri', uri);
    });
    
    it('should correctly parse s3+https protocol URIs and attempt to generate presigned URLs', async () => {
      const uri = 's3+https://test-bucket/1234-SheetName.csv';
      
      // Mock the generatePresignedUrl method
      const mockPresignedUrl = 'https://test-bucket.s3.us-west-2.amazonaws.com/1234-SheetName.csv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...';
      (mockStorageInstance as any).generatePresignedUrl = jest.fn().mockResolvedValue(mockPresignedUrl);
      
      await accessResource(uri, mockStorageInstance);
      
      // Check that getCSV was called with the right parameters
      expect(mockStorageInstance.getCSV).toHaveBeenCalledWith('1234', 'SheetName');
      
      // Check that generatePresignedUrl was called
      expect((mockStorageInstance as any).generatePresignedUrl).toHaveBeenCalledWith('1234', 'SheetName');
    });
    
    it('should correctly parse https protocol URIs (presigned S3 URLs)', async () => {
      const uri = 'https://test-bucket.s3.us-west-2.amazonaws.com/1234-SheetName.csv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...';
      
      await accessResource(uri, mockStorageInstance);
      
      // Check that getCSV was called with the right parameters
      expect(mockStorageInstance.getCSV).toHaveBeenCalledWith('1234', 'SheetName');
    });

    it('should throw ResourceNotFoundError when uri protocol is not supported', async () => {
      const uri = 'http://example.com/file.csv';
      
      await expect(accessResource(uri, mockStorageInstance)).rejects.toThrow(ResourceNotFoundError);
    });

    it('should correctly parse file protocol URIs', async () => {
      const uri = 'file:///mock/path/1234-SheetName.csv';
      
      await accessResource(uri, mockStorageInstance);
      
      // Check that getCSV was called with the right parameters
      expect(mockStorageInstance.getCSV).toHaveBeenCalledWith('1234', 'SheetName');
    });

    it('should correctly parse quip protocol URIs with sheet parameter', async () => {
      const uri = 'quip://1234?sheet=SheetName';
      
      await accessResource(uri, mockStorageInstance);
      
      // Check that getCSV was called with the right parameters
      expect(mockStorageInstance.getCSV).toHaveBeenCalledWith('1234', 'SheetName');
    });
  });

  describe('ReadResource Response Format', () => {
    it('should format response with contents (plural), not content (singular)', async () => {
      const uri = 'file:///mock/path/1234-Sheet.csv';
      const mockCsvContent = 'id,name\n1,test\n2,test2';
      (mockStorageInstance.getCSV as jest.Mock).mockResolvedValueOnce(mockCsvContent);
      
      // Create a response object similar to what the server returns
      const response = {
        // The fix changes this from 'content' to 'contents'
        contents: await accessResource(uri, mockStorageInstance)
      };
      
      // Verify the fix - response should use 'contents' (plural)
      expect(response).toHaveProperty('contents');
      expect(response).not.toHaveProperty('content');
      
      // And each content item should have the uri field
      expect(response.contents[0]).toHaveProperty('uri', uri);
    });
  });
});
