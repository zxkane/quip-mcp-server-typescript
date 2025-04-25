import { MockQuipClient } from '../../src/mockClient';
import { logger } from '../../src/logger';
import * as fs from 'fs-extra';

// Mock dependencies
jest.mock('fs-extra', () => ({
  mkdirp: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  pathExists: jest.fn().mockResolvedValue(true),
  readFile: jest.fn().mockResolvedValue('mock file content')
}));

// Mock logger
jest.mock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('MockQuipClient', () => {
  let mockClient: MockQuipClient;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new MockQuipClient();
  });
  
  describe('constructor', () => {
    it('should initialize with sample data', () => {
      // Check that the mock data was initialized
      expect((mockClient as any).mockData).toBeDefined();
      expect((mockClient as any).mockData.size).toBeGreaterThan(0);
      
      // Verify that the logger was called
      expect(logger.info).toHaveBeenCalledWith('Initializing MockQuipClient');
    });
    
    it('should include sample spreadsheets', () => {
      const mockData = (mockClient as any).mockData;
      
      // Check for sample1 spreadsheet
      expect(mockData.has('sample1')).toBe(true);
      const sample1 = mockData.get('sample1');
      expect(sample1.title).toBe('Sample Spreadsheet 1');
      expect(sample1.sheets.length).toBe(2);
      expect(sample1.sheets[0].name).toBe('Sheet1');
      
      // Check for sample2 spreadsheet
      expect(mockData.has('sample2')).toBe(true);
      
      // Check for large spreadsheet
      expect(mockData.has('large')).toBe(true);
      const large = mockData.get('large');
      expect(large.title).toBe('Large Sample Spreadsheet');
    });
  });
  
  describe('addMockSpreadsheet', () => {
    it('should add a new spreadsheet to the mock data', () => {
      const newSpreadsheet = {
        threadId: 'new-thread',
        title: 'New Spreadsheet',
        sheets: [
          {
            name: 'New Sheet',
            csv: 'a,b,c\n1,2,3'
          }
        ]
      };
      
      mockClient.addMockSpreadsheet(newSpreadsheet);
      
      // Check that the spreadsheet was added
      const mockData = (mockClient as any).mockData;
      expect(mockData.has('new-thread')).toBe(true);
      expect(mockData.get('new-thread')).toEqual(newSpreadsheet);
      
      // Verify that the logger was called
      expect(logger.debug).toHaveBeenCalledWith(
        'Added mock spreadsheet: new-thread',
        { title: 'New Spreadsheet' }
      );
    });
  });
  
  describe('getThread', () => {
    it('should return thread information for an existing thread', async () => {
      const threadId = 'sample1';
      const result = await mockClient.getThread(threadId);
      
      expect(result).toHaveProperty('thread');
      expect(result.thread).toHaveProperty('id', threadId);
      expect(result.thread).toHaveProperty('title', 'Sample Spreadsheet 1');
      expect(result.thread).toHaveProperty('type', 'spreadsheet');
      expect(result).toHaveProperty('html');
      expect(typeof result.html).toBe('string');
      
      // Verify that the logger was called
      expect(logger.info).toHaveBeenCalledWith(`Getting mock thread: ${threadId}`);
    });
    
    it('should throw an error for a non-existent thread', async () => {
      const threadId = 'non-existent';
      
      await expect(mockClient.getThread(threadId)).rejects.toThrow(`Thread not found: ${threadId}`);
      
      // Verify that the logger was called
      expect(logger.error).toHaveBeenCalledWith(`Mock thread not found: ${threadId}`);
    });
  });
  
  describe('exportThreadToXLSX', () => {
    const outputPath = '/mock/output/path.xlsx';
    
    it('should create a mock XLSX file for an existing thread', async () => {
      const threadId = 'sample1';
      
      // Reset mock implementations for this test
      (fs.mkdirp as unknown as jest.Mock).mockClear();
      (fs.writeFile as unknown as jest.Mock).mockClear();
      
      const result = await mockClient.exportThreadToXLSX(threadId, outputPath);
      
      expect(result).toBe(outputPath);
      expect(fs.mkdirp).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        outputPath,
        'Mock XLSX content'
      );
      
      // Verify that the logger was called
      expect(logger.info).toHaveBeenCalledWith(
        `Exporting mock thread ${threadId} to XLSX at ${outputPath}`
      );
      expect(logger.info).toHaveBeenCalledWith(
        `Successfully exported mock XLSX to ${outputPath}`
      );
    });
    
    it('should throw an error for a non-existent thread', async () => {
      const threadId = 'non-existent';
      
      await expect(mockClient.exportThreadToXLSX(threadId, outputPath)).rejects.toThrow(
        `Thread not found: ${threadId}`
      );
      
      // Verify that the logger was called
      expect(logger.error).toHaveBeenCalledWith(`Mock thread not found: ${threadId}`);
    });
  });
  
  describe('exportThreadToCSVFallback', () => {
    it('should return CSV content for an existing thread and sheet', async () => {
      const threadId = 'sample1';
      const sheetName = 'Sheet1';
      
      const result = await mockClient.exportThreadToCSVFallback(threadId, sheetName);
      
      expect(result).toBe('Name,Age,Email\nJohn Doe,30,john@example.com\nJane Smith,25,jane@example.com\nBob Johnson,40,bob@example.com');
      
      // Verify that the logger was called
      expect(logger.info).toHaveBeenCalledWith(
        `Using fallback method to export mock thread ${threadId} to CSV, sheet: ${sheetName}`
      );
    });
    
    it('should use the first sheet if no sheet name is provided', async () => {
      const threadId = 'sample1';
      
      const result = await mockClient.exportThreadToCSVFallback(threadId);
      
      // Should use the first sheet (Sheet1)
      expect(result).toBe('Name,Age,Email\nJohn Doe,30,john@example.com\nJane Smith,25,jane@example.com\nBob Johnson,40,bob@example.com');
    });
    
    it('should throw an error for a non-existent thread', async () => {
      const threadId = 'non-existent';
      
      await expect(mockClient.exportThreadToCSVFallback(threadId)).rejects.toThrow(
        `Thread not found: ${threadId}`
      );
      
      // Verify that the logger was called
      expect(logger.error).toHaveBeenCalledWith(`Mock thread not found: ${threadId}`);
    });
    
    it('should throw an error for a non-existent sheet', async () => {
      const threadId = 'sample1';
      const sheetName = 'Non-existent Sheet';
      
      await expect(mockClient.exportThreadToCSVFallback(threadId, sheetName)).rejects.toThrow(
        `Sheet '${sheetName}' not found in thread ${threadId}`
      );
      
      // Verify that the logger was called
      expect(logger.error).toHaveBeenCalledWith(`Sheet not found: ${sheetName}`);
    });
  });
  
  describe('isSpreadsheet', () => {
    it('should return true for an existing thread', async () => {
      const threadId = 'sample1';
      
      const result = await mockClient.isSpreadsheet(threadId);
      
      expect(result).toBe(true);
      
      // Verify that the logger was called
      expect(logger.info).toHaveBeenCalledWith(`Checking if mock thread ${threadId} is a spreadsheet`);
    });
    
    it('should return false for a non-existent thread', async () => {
      const threadId = 'non-existent';
      
      const result = await mockClient.isSpreadsheet(threadId);
      
      expect(result).toBe(false);
    });
  });
  
  describe('generateMockHtml', () => {
    it('should generate HTML representation of a spreadsheet', () => {
      const spreadsheet = {
        threadId: 'test-thread',
        title: 'Test Spreadsheet',
        sheets: [
          {
            name: 'Test Sheet',
            csv: 'a,b\n1,2\n3,4'
          }
        ]
      };
      
      const html = (mockClient as any).generateMockHtml(spreadsheet);
      
      // Check that the HTML contains the title and sheet name
      expect(html).toContain('<h1>Test Spreadsheet</h1>');
      expect(html).toContain('<h2>Test Sheet</h2>');
      
      // Check that the HTML contains a table with the CSV data
      expect(html).toContain('<table>');
      expect(html).toContain('<tr><td>a</td><td>b</td></tr>');
      expect(html).toContain('<tr><td>1</td><td>2</td></tr>');
      expect(html).toContain('<tr><td>3</td><td>4</td></tr>');
      expect(html).toContain('</table>');
    });
  });
  
  describe('generateLargeSheet', () => {
    it('should generate a CSV string with the specified dimensions', () => {
      const rows = 3;
      const cols = 2;
      
      const csv = (mockClient as any).generateLargeSheet(rows, cols);
      
      // Check header row
      expect(csv).toContain('Column1,Column2');
      
      // Check data rows
      expect(csv).toContain('Value1-1,Value1-2');
      expect(csv).toContain('Value2-1,Value2-2');
      expect(csv).toContain('Value3-1,Value3-2');
      
      // Count newlines to verify row count
      const newlineCount = (csv.match(/\n/g) || []).length;
      expect(newlineCount).toBe(rows); // Header row + data rows - 1
    });
  });
});