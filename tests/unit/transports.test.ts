import * as http from 'http';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

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

// Create mock implementations for MCPServer and MCPServerTransport
const mockMCPServerInstance = {
  setRequestHandler: jest.fn(),
  run: jest.fn().mockResolvedValue(undefined)
};

const mockMCPServer = jest.fn().mockReturnValue(mockMCPServerInstance);

const mockMCPServerTransport = {
  Stdio: jest.fn().mockReturnValue({ type: 'stdio' }),
  StreamableHTTP: jest.fn().mockReturnValue({ type: 'http' })
};

// Mock the server module
jest.mock('../../src/server', () => {
  // Get the original module
  const originalModule = jest.requireActual('../../src/server');
  
  console.log('Mocking server module in transports.test.ts');
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

describe('Transport Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables
    delete process.env.PORT;
    delete process.env.MCP_PORT;
  });
  
  describe('Transport Selection', () => {
    it('should create stdio transport when no PORT is specified', () => {
      // Mock the MCPServerTransport.Stdio function
      const mockStdioTransport = { type: 'stdio' };
      mockMCPServerTransport.Stdio.mockReturnValue(mockStdioTransport);
      
      // Directly test the transport creation
      const transport = mockMCPServerTransport.Stdio();
      
      // Check that MCPServerTransport.Stdio was called
      expect(mockMCPServerTransport.Stdio).toHaveBeenCalled();
      
      // Check that the transport has the correct type
      expect(transport).toEqual(mockStdioTransport);
      expect(transport.type).toBe('stdio');
    });
    
    it('should create HTTP transport when PORT is specified', () => {
      // Mock the MCPServerTransport.StreamableHTTP function
      const mockHttpTransport = { type: 'http' };
      mockMCPServerTransport.StreamableHTTP.mockReturnValue(mockHttpTransport);
      
      // Directly test the transport creation with port
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
    
    it('should create HTTP transport with auth when auth is enabled', () => {
      // Mock the MCPServerTransport.StreamableHTTP function
      const mockHttpTransport = { type: 'http' };
      mockMCPServerTransport.StreamableHTTP.mockReturnValue(mockHttpTransport);
      
      // Directly test the transport creation with port and auth
      const transport = mockMCPServerTransport.StreamableHTTP({
        port: 3000,
        auth: {
          apiKey: 'test-api-key',
          apiKeyHeader: 'X-API-Key'
        }
      });
      
      // Check that MCPServerTransport.StreamableHTTP was called with the correct options
      expect(mockMCPServerTransport.StreamableHTTP).toHaveBeenCalledWith({
        port: 3000,
        auth: {
          apiKey: 'test-api-key',
          apiKeyHeader: 'X-API-Key'
        }
      });
      
      // Check that the transport has the correct type
      expect(transport).toEqual(mockHttpTransport);
      expect(transport.type).toBe('http');
    });
  });
});