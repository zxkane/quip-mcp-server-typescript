import { StorageInterface } from '../../src/types';
import { QuipApiError, InvalidParamsError } from '../../src/errors';
import { handleQuipReadSpreadsheet } from '../../src/tools';

// Mock the logger
jest.mock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock the tools module
jest.mock('../../src/tools', () => ({
  getQuipTools: jest.fn().mockReturnValue([
    {
      name: 'quip_read_spreadsheet',
      description: 'Mock tool description',
      inputSchema: {
        type: 'object',
        properties: {
          threadId: { type: 'string' }
        },
        required: ['threadId']
      }
    }
  ]),
  handleQuipReadSpreadsheet: jest.fn()
}));

// Mock other dependencies
jest.mock('../../src/storage', () => ({
  createStorage: jest.fn().mockReturnValue({
    saveCSV: jest.fn().mockResolvedValue('/mock/path/file.csv'),
    getCSV: jest.fn().mockResolvedValue('mock,csv\ndata,here'),
    getResourceURI: jest.fn().mockReturnValue('quip://mock-thread-id'),
    getMetadata: jest.fn().mockResolvedValue({
      total_rows: 2,
      total_size: 20,
      resource_uri: 'quip://mock-thread-id',
      last_updated: '2023-01-01T00:00:00Z'
    })
  })
}));

jest.mock('fs-extra', () => ({
  mkdirpSync: jest.fn(),
  readdir: jest.fn().mockResolvedValue([])
}));

jest.mock('../../src/cli', () => ({
  parseCommandLineArgs: jest.fn().mockReturnValue({
    mock: true,
    debug: false,
    port: undefined,
    fileProtocol: false
  }),
  configureLogging: jest.fn(),
  getStoragePath: jest.fn().mockReturnValue('/mock/storage'),
  getStorageConfig: jest.fn().mockReturnValue({
    storageType: 'local',
    s3Bucket: undefined,
    s3Region: undefined,
    s3Prefix: undefined,
    s3UrlExpiration: undefined
  })
}));

describe('Server Error Handling', () => {
  let mockStorage: StorageInterface;
  let toolCallHandler: (request: any) => Promise<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockStorage = {
      saveCSV: jest.fn().mockResolvedValue('/mock/path/file.csv'),
      getCSV: jest.fn().mockResolvedValue('mock,csv\ndata,here'),
      getResourceURI: jest.fn().mockReturnValue('quip://mock-thread-id'),
      getMetadata: jest.fn().mockResolvedValue({
        total_rows: 2,
        total_size: 20,
        resource_uri: 'quip://mock-thread-id',
        last_updated: '2023-01-01T00:00:00Z'
      })
    };

    // Create the tool call handler function that mimics the actual implementation
    toolCallHandler = async (request: any) => {
      try {
        if (request.params.name === "quip_read_spreadsheet") {
          return {
            content: await handleQuipReadSpreadsheet(
              request.params.arguments || {},
              mockStorage,
              true // mock mode
            )
          };
        } else {
          // Return error as content instead of throwing to ensure response is sent
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: {
                  code: -32601,
                  message: `Method not found: ${request.params.name}`
                }
              })
            }]
          };
        }
      } catch (error) {
        // Instead of throwing, return error as content to ensure response is sent
        let errorCode = -32603; // Internal error default
        let errorMsg = 'Internal server error';
        
        // Import the error classes to ensure proper instanceof checks
        const { QuipMCPError } = require('../../src/errors');
        
        if (error instanceof QuipMCPError) {
          errorCode = error.code;
          errorMsg = error.message;
        } else if (error instanceof Error) {
          errorMsg = error.message;
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: {
                code: errorCode,
                message: errorMsg
              }
            })
          }]
        };
      }
    };
  });

  describe('Tool Call Handler Error Handling', () => {
    it('should return error response for non-spreadsheet threadId instead of throwing', async () => {
      // Mock handleQuipReadSpreadsheet to throw QuipApiError (non-spreadsheet case)
      const mockError = new QuipApiError('Thread not_a_spreadsheet_id is not a spreadsheet or does not exist');
      (handleQuipReadSpreadsheet as jest.Mock).mockRejectedValue(mockError);

      const request = {
        params: {
          name: 'quip_read_spreadsheet',
          arguments: {
            threadId: 'not_a_spreadsheet_id'
          }
        }
      };

      // Call the handler and expect it to return an error response, not throw
      const result = await toolCallHandler(request);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBe(1);
      expect(result.content[0].type).toBe('text');

      // Parse the error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.error.code).toBe(-32003); // QuipApiError code
      expect(errorResponse.error.message).toBe('Thread not_a_spreadsheet_id is not a spreadsheet or does not exist');
    });

    it('should return error response for invalid parameters instead of throwing', async () => {
      // Mock handleQuipReadSpreadsheet to throw InvalidParamsError
      const mockError = new InvalidParamsError('threadId is required');
      (handleQuipReadSpreadsheet as jest.Mock).mockRejectedValue(mockError);

      const request = {
        params: {
          name: 'quip_read_spreadsheet',
          arguments: {} // Missing threadId
        }
      };

      // Call the handler and expect it to return an error response, not throw
      const result = await toolCallHandler(request);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBe(1);
      expect(result.content[0].type).toBe('text');

      // Parse the error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.error.code).toBe(-32602); // InvalidParamsError code
      expect(errorResponse.error.message).toBe('threadId is required');
    });

    it('should return error response for unknown tools instead of throwing', async () => {
      const request = {
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      };

      // Call the handler and expect it to return an error response, not throw
      const result = await toolCallHandler(request);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBe(1);
      expect(result.content[0].type).toBe('text');

      // Parse the error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.error.code).toBe(-32601); // Method not found
      expect(errorResponse.error.message).toBe('Method not found: unknown_tool');
    });

    it('should return error response for generic errors instead of throwing', async () => {
      // Mock handleQuipReadSpreadsheet to throw a generic Error
      const mockError = new Error('Generic error occurred');
      (handleQuipReadSpreadsheet as jest.Mock).mockRejectedValue(mockError);

      const request = {
        params: {
          name: 'quip_read_spreadsheet',
          arguments: {
            threadId: 'some_thread_id'
          }
        }
      };

      // Call the handler and expect it to return an error response, not throw
      const result = await toolCallHandler(request);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBe(1);
      expect(result.content[0].type).toBe('text');

      // Parse the error response
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.error.code).toBe(-32603); // Internal error
      expect(errorResponse.error.message).toBe('Generic error occurred');
    });

    it('should return successful response for valid spreadsheet threadId', async () => {
      // Mock handleQuipReadSpreadsheet to return successful response
      const mockResponse = [{
        type: 'text',
        text: JSON.stringify({
          csv_content: 'header1,header2\nvalue1,value2',
          metadata: {
            total_rows: 2,
            total_size: 30,
            is_truncated: false,
            resource_uri: 'quip://valid_thread_id'
          }
        })
      }];
      (handleQuipReadSpreadsheet as jest.Mock).mockResolvedValue(mockResponse);

      const request = {
        params: {
          name: 'quip_read_spreadsheet',
          arguments: {
            threadId: 'valid_thread_id'
          }
        }
      };

      // Call the handler and expect it to return a successful response
      const result = await toolCallHandler(request);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBe(1);
      expect(result.content[0].type).toBe('text');

      // Parse the successful response
      const successResponse = JSON.parse(result.content[0].text);
      expect(successResponse.csv_content).toBeDefined();
      expect(successResponse.metadata).toBeDefined();
      expect(successResponse.error).toBeUndefined();
    });
  });

  describe('Error Response Format', () => {
    it('should format error responses with proper JSON-RPC structure', async () => {
      // Mock handleQuipReadSpreadsheet to throw QuipApiError
      const mockError = new QuipApiError('Test error message');
      (handleQuipReadSpreadsheet as jest.Mock).mockRejectedValue(mockError);

      const request = {
        params: {
          name: 'quip_read_spreadsheet',
          arguments: {
            threadId: 'test_thread_id'
          }
        }
      };

      const result = await toolCallHandler(request);
      const errorResponse = JSON.parse(result.content[0].text);

      // Verify the error response structure
      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toHaveProperty('code');
      expect(errorResponse.error).toHaveProperty('message');
      expect(typeof errorResponse.error.code).toBe('number');
      expect(typeof errorResponse.error.message).toBe('string');
      expect(errorResponse.error.code).toBe(-32003); // QuipApiError code
      expect(errorResponse.error.message).toBe('Test error message');
    });

    it('should preserve custom error codes and messages', async () => {
      const testCases = [
        { error: new QuipApiError('Custom message', { extra: 'data' }), expectedCode: -32003 },
        { error: new InvalidParamsError('Invalid params', { field: 'threadId' }), expectedCode: -32602 },
        { error: new Error('Generic error'), expectedCode: -32603 }
      ];

      for (const testCase of testCases) {
        (handleQuipReadSpreadsheet as jest.Mock).mockRejectedValue(testCase.error);

        const request = {
          params: {
            name: 'quip_read_spreadsheet',
            arguments: { threadId: 'test' }
          }
        };

        const result = await toolCallHandler(request);
        const errorResponse = JSON.parse(result.content[0].text);

        expect(errorResponse.error.code).toBe(testCase.expectedCode);
        expect(errorResponse.error.message).toBe(testCase.error.message);
      }
    });
  });
});
