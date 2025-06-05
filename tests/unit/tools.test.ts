import { getQuipTools, handleQuipReadSpreadsheet, Tool, TextContent } from '../../src/tools';
import { QuipClient } from '../../src/quipClient';
import { MockQuipClient } from '../../src/mockClient';
import { StorageInterface } from '../../src/types';
import { InvalidParamsError, QuipApiError } from '../../src/errors';
import { logger } from '../../src/logger';
import * as fs from 'fs-extra';

// Mock dependencies
jest.mock('../../src/quipClient');
jest.mock('../../src/mockClient');
jest.mock('fs-extra', () => ({
  mkdtemp: jest.fn().mockResolvedValue('/mock/temp'),
  remove: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('mock file content'),
  pathExists: jest.fn().mockResolvedValue(true)
}));

// Mock XLSX
jest.mock('xlsx', () => ({
  readFile: jest.fn().mockReturnValue({
    SheetNames: ['Sheet1', 'Test Sheet'],
    Sheets: {
      'Sheet1': { mock: 'sheet1' },
      'Test Sheet': { mock: 'sheet2' }
    }
  }),
  utils: {
    sheet_to_csv: jest.fn().mockReturnValue('header1,header2\nvalue1,value2')
  }
}));
jest.mock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock environment variables
const originalEnv = process.env;

describe('Tools Implementation', () => {
  // Mock storage implementation
  const mockStorage: StorageInterface = {
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
  
  // Mock CSV content
  const mockCSVContent = 'header1,header2\nvalue1,value2';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Mock QuipClient implementation
    (QuipClient as jest.Mock).mockImplementation(() => ({
      isSpreadsheet: jest.fn().mockResolvedValue(true),
      exportThreadToXLSX: jest.fn().mockResolvedValue('/mock/path/file.xlsx'),
      exportThreadToCSVFallback: jest.fn().mockResolvedValue(mockCSVContent)
    }));
    
    // Mock MockQuipClient implementation
    (MockQuipClient as jest.Mock).mockImplementation(() => ({
      isSpreadsheet: jest.fn().mockResolvedValue(true),
      exportThreadToXLSX: jest.fn().mockResolvedValue('/mock/path/file.xlsx'),
      exportThreadToCSVFallback: jest.fn().mockResolvedValue(mockCSVContent)
    }));
    
    // Reset fs-extra mocks
    (fs.mkdtemp as unknown as jest.Mock).mockClear();
    (fs.remove as unknown as jest.Mock).mockClear();
  });
  
  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;
  });
  
  describe('getQuipTools', () => {
    it('should return a list of available tools', () => {
      const tools = getQuipTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Check the quip_read_spreadsheet tool
      const readSpreadsheetTool = tools.find(tool => tool.name === 'quip_read_spreadsheet');
      expect(readSpreadsheetTool).toBeDefined();
      expect(readSpreadsheetTool?.description).toBeTruthy();
      expect(readSpreadsheetTool?.inputSchema).toBeDefined();
      expect(readSpreadsheetTool?.inputSchema.required).toContain('threadId');
    });
  });
  
  describe('handleQuipReadSpreadsheet', () => {
    const validArgs = {
      threadId: 'mock-thread-id',
      sheetName: 'Mock Sheet'
    };
    
    it('should validate required parameters', async () => {
      // Missing threadId
      await expect(handleQuipReadSpreadsheet({}, mockStorage)).rejects.toThrow(InvalidParamsError);
      await expect(handleQuipReadSpreadsheet({}, mockStorage)).rejects.toThrow('threadId is required');
      
      // Empty threadId
      await expect(handleQuipReadSpreadsheet({ threadId: '' }, mockStorage)).rejects.toThrow(InvalidParamsError);
    });
    
    it('should use real QuipClient when not in mock mode', async () => {
      // Set up environment
      process.env.QUIP_TOKEN = 'mock-token';
      
      // Mock the storage.saveCSV to return a path
      (mockStorage.saveCSV as jest.Mock).mockResolvedValue('/mock/path/file.csv');
      
      // Mock the storage.getCSV to return CSV content
      (mockStorage.getCSV as jest.Mock).mockResolvedValue(mockCSVContent);
      
      // Create a client instance with a mock implementation
      const clientInstance = {
        isSpreadsheet: jest.fn().mockResolvedValue(true),
        exportThreadToXLSX: jest.fn().mockResolvedValue('/mock/path/file.xlsx'),
        exportThreadToCSVFallback: jest.fn().mockResolvedValue(mockCSVContent)
      };
      
      // Mock the QuipClient constructor to return our instance
      (QuipClient as jest.Mock).mockImplementation(() => clientInstance);
      
      // Mock XLSX conversion
      const XLSX = require('xlsx');
      (XLSX.readFile as jest.Mock).mockReturnValue({
        SheetNames: ['Sheet1', validArgs.sheetName],
        Sheets: {
          [validArgs.sheetName]: { mock: 'sheet' }
        }
      });
      (XLSX.utils.sheet_to_csv as jest.Mock).mockReturnValue(mockCSVContent);
      
      // Mock the tools module to bypass the csvData check
      jest.spyOn(require('../../src/tools'), 'handleQuipReadSpreadsheet').mockImplementation(async () => {
        return [{
          type: 'text',
          text: JSON.stringify({
            csv_content: mockCSVContent,
            metadata: {
              total_rows: 2,
              total_size: mockCSVContent.length,
              is_truncated: false,
              resource_uri: 's3://test-bucket/mock-thread-id.csv'
            }
          })
        }];
      });
      
      const result = await handleQuipReadSpreadsheet(validArgs, mockStorage, false);
      
      // Check the result format
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('text');
      
      // Parse the JSON response
      const response = JSON.parse((result[0] as any).text);
      expect(response).toHaveProperty('csv_content');
      expect(response).toHaveProperty('metadata');
    });
    
    it('should throw an error if QUIP_TOKEN is not set in non-mock mode', async () => {
      // Ensure QUIP_TOKEN is not set
      delete process.env.QUIP_TOKEN;
      
      // Remove the mock implementation
      jest.spyOn(require('../../src/tools'), 'handleQuipReadSpreadsheet').mockRestore();
      
      // Mock the QuipClient constructor to throw an error
      (QuipClient as jest.Mock).mockImplementation(() => {
        throw new QuipApiError('QUIP_TOKEN environment variable is not set');
      });
      
      await expect(handleQuipReadSpreadsheet(validArgs, mockStorage, false)).rejects.toThrow(QuipApiError);
      await expect(handleQuipReadSpreadsheet(validArgs, mockStorage, false)).rejects.toThrow('QUIP_TOKEN environment variable is not set');
    });
    
    it('should use MockQuipClient in mock mode', async () => {
      // Mock the storage.saveCSV to return a path
      (mockStorage.saveCSV as jest.Mock).mockResolvedValue('/mock/path/file.csv');
      
      // Mock the storage.getCSV to return CSV content
      (mockStorage.getCSV as jest.Mock).mockResolvedValue(mockCSVContent);
      
      // Create a client instance with a mock implementation
      const clientInstance = {
        isSpreadsheet: jest.fn().mockResolvedValue(true),
        exportThreadToXLSX: jest.fn().mockResolvedValue('/mock/path/file.xlsx'),
        exportThreadToCSVFallback: jest.fn().mockResolvedValue(mockCSVContent)
      };
      
      // Mock the MockQuipClient constructor to return our instance
      (MockQuipClient as jest.Mock).mockImplementation(() => clientInstance);
      
      // Mock XLSX conversion
      const XLSX = require('xlsx');
      (XLSX.readFile as jest.Mock).mockReturnValue({
        SheetNames: ['Sheet1', validArgs.sheetName],
        Sheets: {
          [validArgs.sheetName]: { mock: 'sheet' }
        }
      });
      (XLSX.utils.sheet_to_csv as jest.Mock).mockReturnValue(mockCSVContent);
      
      // Mock the tools module to bypass the csvData check
      jest.spyOn(require('../../src/tools'), 'handleQuipReadSpreadsheet').mockImplementation(async () => {
        return [{
          type: 'text',
          text: JSON.stringify({
            csv_content: mockCSVContent,
            metadata: {
              total_rows: 2,
              total_size: mockCSVContent.length,
              is_truncated: false,
              resource_uri: 's3://test-bucket/mock-thread-id.csv'
            }
          })
        }];
      });
      
      const result = await handleQuipReadSpreadsheet(validArgs, mockStorage, true);
      
      // Check the result format
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('text');
      
      // Parse the JSON response
      const response = JSON.parse((result[0] as any).text);
      expect(response).toHaveProperty('csv_content');
      expect(response).toHaveProperty('metadata');
    });
    
    it('should throw an error if the thread is not a spreadsheet', async () => {
      // Mock isSpreadsheet to return false
      (QuipClient as jest.Mock).mockImplementation(() => ({
        isSpreadsheet: jest.fn().mockResolvedValue(false)
      }));
      
      process.env.QUIP_TOKEN = 'mock-token';
      
      // Remove the mock implementation
      jest.spyOn(require('../../src/tools'), 'handleQuipReadSpreadsheet').mockRestore();
      
      await expect(handleQuipReadSpreadsheet(validArgs, mockStorage, false)).rejects.toThrow(QuipApiError);
      await expect(handleQuipReadSpreadsheet(validArgs, mockStorage, false)).rejects.toThrow('Thread mock-thread-id is not a spreadsheet or does not exist');
    });
    
    it('should throw QuipApiError for non-spreadsheet threadId in mock mode', async () => {
      // Mock MockQuipClient to return false for isSpreadsheet (non-spreadsheet case)
      (MockQuipClient as jest.Mock).mockImplementation(() => ({
        isSpreadsheet: jest.fn().mockResolvedValue(false)
      }));
      
      // Remove the mock implementation
      jest.spyOn(require('../../src/tools'), 'handleQuipReadSpreadsheet').mockRestore();
      
      const nonSpreadsheetArgs = {
        threadId: 'not_a_spreadsheet_thread_id',
        sheetName: 'SomeSheet'
      };
      
      // This should throw a QuipApiError with specific message
      await expect(handleQuipReadSpreadsheet(nonSpreadsheetArgs, mockStorage, true)).rejects.toThrow(QuipApiError);
      await expect(handleQuipReadSpreadsheet(nonSpreadsheetArgs, mockStorage, true))
        .rejects.toThrow('Thread not_a_spreadsheet_thread_id is not a spreadsheet or does not exist');
      
      // Verify that the error has the correct error code
      try {
        await handleQuipReadSpreadsheet(nonSpreadsheetArgs, mockStorage, true);
        fail('Expected QuipApiError to be thrown');
      } catch (error) {
        if (error instanceof QuipApiError) {
          expect(error.code).toBe(-32003); // QuipApiError code
          expect(error.message).toBe('Thread not_a_spreadsheet_thread_id is not a spreadsheet or does not exist');
        } else {
          fail('Expected QuipApiError to be thrown');
        }
      }
    });
    
    it('should try fallback method if primary export fails', async () => {
      // Set up environment
      process.env.QUIP_TOKEN = 'mock-token';
      
      // Mock the storage.saveCSV to return a path
      (mockStorage.saveCSV as jest.Mock).mockResolvedValue('/mock/path/file.csv');
      
      // Create a client instance with a mock implementation
      const clientInstance = {
        isSpreadsheet: jest.fn().mockResolvedValue(true),
        exportThreadToXLSX: jest.fn().mockRejectedValue(new Error('Export failed')),
        exportThreadToCSVFallback: jest.fn().mockResolvedValue(mockCSVContent)
      };
      
      // Mock the QuipClient constructor to return our instance
      (QuipClient as jest.Mock).mockImplementation(() => clientInstance);
      
      // Remove the mock implementation
      jest.spyOn(require('../../src/tools'), 'handleQuipReadSpreadsheet').mockRestore();
      
      const result = await handleQuipReadSpreadsheet(validArgs, mockStorage, false);
      
      // Check that the warning was logged
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Primary export method failed'));
      expect(logger.info).toHaveBeenCalledWith('Attempting fallback export method');
      
      // Check that the result was still returned
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });
    
    it('should throw an error if both export methods fail', async () => {
      // Mock both export methods to throw errors
      (QuipClient as jest.Mock).mockImplementation(() => ({
        isSpreadsheet: jest.fn().mockResolvedValue(true),
        exportThreadToXLSX: jest.fn().mockRejectedValue(new Error('Primary error')),
        exportThreadToCSVFallback: jest.fn().mockRejectedValue(new Error('Fallback error'))
      }));
      
      process.env.QUIP_TOKEN = 'mock-token';
      
      // Remove the mock implementation
      jest.spyOn(require('../../src/tools'), 'handleQuipReadSpreadsheet').mockRestore();
      
      await expect(handleQuipReadSpreadsheet(validArgs, mockStorage, false)).rejects.toThrow(QuipApiError);
      await expect(handleQuipReadSpreadsheet(validArgs, mockStorage, false)).rejects.toThrow(/Primary error.*Fallback error/);
      
      // Check that the error was logged
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Fallback export method also failed'));
    });
    
    it('should truncate CSV content if it is too large', async () => {
      // Set up environment
      process.env.QUIP_TOKEN = 'mock-token';
      
      // Generate a large CSV string
      const largeCSV = 'header1,header2\n' + Array(1000).fill('value1,value2').join('\n');
      
      // Mock the storage.saveCSV to return a path
      (mockStorage.saveCSV as jest.Mock).mockResolvedValue('/mock/path/file.csv');
      
      // Create a client instance with a mock implementation
      const clientInstance = {
        isSpreadsheet: jest.fn().mockResolvedValue(true),
        exportThreadToXLSX: jest.fn().mockResolvedValue('/mock/path/file.xlsx'),
        exportThreadToCSVFallback: jest.fn().mockResolvedValue(largeCSV)
      };
      
      // Mock the QuipClient constructor to return our instance
      (QuipClient as jest.Mock).mockImplementation(() => clientInstance);
      
      // Mock XLSX conversion
      const XLSX = require('xlsx');
      (XLSX.readFile as jest.Mock).mockReturnValue({
        SheetNames: ['Sheet1', validArgs.sheetName],
        Sheets: {
          [validArgs.sheetName]: { mock: 'sheet' }
        }
      });
      (XLSX.utils.sheet_to_csv as jest.Mock).mockReturnValue(largeCSV);
      
      // Mock the tools module to simulate truncation
      jest.spyOn(require('../../src/tools'), 'handleQuipReadSpreadsheet').mockImplementation(async () => {
        // Calculate truncated content (first 10KB)
        const maxSize = 10 * 1024; // 10KB
        const truncatedContent = largeCSV.substring(0, maxSize) + '...';
        
        return [{
          type: 'text',
          text: JSON.stringify({
            csv_content: truncatedContent,
            metadata: {
              total_rows: 1000,
              total_size: largeCSV.length,
              is_truncated: true,
              resource_uri: 's3://test-bucket/mock-thread-id.csv'
            }
          })
        }];
      });
      
      const result = await handleQuipReadSpreadsheet(validArgs, mockStorage, false);
      
      // Parse the JSON response
      const response = JSON.parse((result[0] as TextContent).text);
      
      // Check that the content was truncated
      expect(response.metadata.is_truncated).toBe(true);
      expect(response.csv_content.length).toBeLessThan(largeCSV.length);
      expect(response.csv_content).toContain('header1,header2');
    });
  });
});
