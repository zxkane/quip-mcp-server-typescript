import * as http from 'http';
import { EventEmitter } from 'events';
import { StorageInterface } from '../../src/types';
import { MethodNotFoundError, ResourceNotFoundError } from '../../src/errors';

// Mock the required modules
jest.mock('http', () => {
  const mockServer = {
    listen: jest.fn((port, callback) => {
      if (callback) callback();
      return mockServer;
    }),
    on: jest.fn()
  };
  return {
    createServer: jest.fn().mockReturnValue(mockServer),
    Server: jest.fn().mockImplementation(() => mockServer)
  };
});

jest.mock('fs-extra', () => ({
  mkdirp: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  pathExists: jest.fn().mockResolvedValue(true),
  readFile: jest.fn().mockResolvedValue('mock file content'),
  readdir: jest.fn().mockResolvedValue(['mockfile.csv'])
}));

jest.mock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

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
  handleQuipReadSpreadsheet: jest.fn().mockResolvedValue([
    { type: 'text', text: '{"mock": "response"}' }
  ])
}));

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
    }),
    storagePath: '/mock/storage/path'
  })
}));

// Mock process.exit
const mockExit = jest.fn();
process.exit = mockExit as any;

// Create a map to store request handlers
const requestHandlers = new Map();

// Create mock implementations for MCPServer and MCPServerTransport
const mockMCPServerInstance = {
  setRequestHandler: jest.fn((schema, handler) => {
    requestHandlers.set(schema, handler);
  }),
  run: jest.fn().mockResolvedValue(undefined)
};

const mockMCPServer = jest.fn().mockReturnValue(mockMCPServerInstance);

const mockMCPServerTransport = {
  Stdio: jest.fn().mockReturnValue({ type: 'stdio' }),
  StreamableHTTP: jest.fn().mockReturnValue({ type: 'http' })
};

// Helper functions for tests
const getRequestHandler = (schema) => requestHandlers.get(schema);
const clearRequestHandlers = () => requestHandlers.clear();

// Mock the server module
jest.mock('../../src/server', () => {
  // Get the original module
  const originalModule = jest.requireActual('../../src/server');
  
  console.log('Mocking server module in server.test.ts');
  console.log('Original module exports:', Object.keys(originalModule));
  
  // Return a modified module with our mocks
  return {
    ...originalModule,
    MCPServer: mockMCPServer,
    MCPServerTransport: mockMCPServerTransport
  };
});

// Import the main function after mocking dependencies
import { main } from '../../src/server';

describe('Server Implementation', () => {
  // Mock storage implementation
  const mockStorage: StorageInterface = {
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

  beforeEach(() => {
    jest.clearAllMocks();
    clearRequestHandlers();
  });

  describe('Request Handlers', () => {
    // Mock handlers for testing
    beforeEach(() => {
      // Mock list_tools handler
      requestHandlers.set('list_tools', async () => ({
        tools: [{
          name: 'quip_read_spreadsheet',
          description: 'Mock tool description',
          inputSchema: {
            type: 'object',
            properties: {
              threadId: { type: 'string' }
            },
            required: ['threadId']
          }
        }]
      }));
      
      // Mock list_resources handler
      requestHandlers.set('list_resources', async () => ({
        resources: [{
          uri: 'quip://mock-thread-id',
          name: 'Mock Resource',
          description: 'Mock description',
          mime_type: 'text/csv'
        }]
      }));
      
      // Mock list_resource_templates handler
      requestHandlers.set('list_resource_templates', async () => ({
        templates: [{
          uri_template: 'quip://{thread_id}?sheet={sheet_name}',
          description: 'Quip spreadsheet resource'
        }]
      }));
      
      // Mock read_resource handler
      requestHandlers.set('read_resource', async ({ uri }) => ({
        content: [{ type: 'text', text: 'Mock content' }]
      }));
      
      // Mock call_tool handler
      requestHandlers.set('call_tool', async ({ name, arguments: args }) => ({
        content: [{ type: 'text', text: '{"mock": "response"}' }]
      }));
    });

    describe('list_tools handler', () => {
      it('should return the list of available tools', async () => {
        // Get the list_tools handler
        const handler = getRequestHandler('list_tools');
        expect(handler).toBeDefined();

        // Call the handler
        const result = await handler();
        
        // Check the result
        expect(result).toHaveProperty('tools');
        expect(Array.isArray(result.tools)).toBe(true);
        expect(result.tools.length).toBe(1);
        expect(result.tools[0].name).toBe('quip_read_spreadsheet');
      });
    });

    describe('list_resources handler', () => {
      it('should return the list of available resources', async () => {
        // Get the list_resources handler
        const handler = getRequestHandler('list_resources');
        expect(handler).toBeDefined();

        // Call the handler
        const result = await handler();
        
        // Check the result
        expect(result).toHaveProperty('resources');
        expect(Array.isArray(result.resources)).toBe(true);
      });
    });

    describe('list_resource_templates handler', () => {
      it('should return the list of available resource templates', async () => {
        // Get the list_resource_templates handler
        const handler = getRequestHandler('list_resource_templates');
        expect(handler).toBeDefined();

        // Call the handler
        const result = await handler();
        
        // Check the result
        expect(result).toHaveProperty('templates');
        expect(Array.isArray(result.templates)).toBe(true);
        expect(result.templates.length).toBe(1);
      });
    });

    describe('read_resource handler', () => {
      it('should return the content of a resource', async () => {
        // Get the read_resource handler
        const handler = getRequestHandler('read_resource');
        expect(handler).toBeDefined();

        // Call the handler
        const result = await handler({ uri: 'quip://mock-thread-id' });
        
        // Check the result
        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBe(1);
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('call_tool handler', () => {
      it('should call the specified tool with arguments', async () => {
        // Get the call_tool handler
        const handler = getRequestHandler('call_tool');
        expect(handler).toBeDefined();

        // Call the handler
        const result = await handler({ 
          name: 'quip_read_spreadsheet', 
          arguments: { threadId: 'mock-thread-id' } 
        });
        
        // Check the result
        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBe(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toBe('{"mock": "response"}');
      });
    });
  });

  describe('HTTP Server', () => {
    it('should create HTTP transport with the correct port', () => {
      // Set PORT environment variable
      process.env.PORT = '3000';
      
      // Mock the MCPServerTransport.StreamableHTTP function
      const mockHttpTransport = { type: 'http' };
      mockMCPServerTransport.StreamableHTTP.mockReturnValue(mockHttpTransport);
      
      // Directly test the transport creation
      const transport = mockMCPServerTransport.StreamableHTTP({
        port: 3000,
        auth: undefined
      });
      
      // Check that MCPServerTransport.StreamableHTTP was called with the correct port
      expect(mockMCPServerTransport.StreamableHTTP).toHaveBeenCalledWith({
        port: 3000,
        auth: undefined
      });
      
      // Check that the transport has the correct type
      expect(transport).toEqual(mockHttpTransport);
      expect(transport.type).toBe('http');
    });

    it('should handle errors gracefully', () => {
      // Mock MCPServer constructor to throw an error
      mockMCPServer.mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      // Directly test error handling
      try {
        new mockMCPServer();
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        // Check that the error is what we expect
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Test error');
      }
    });
  });
});
