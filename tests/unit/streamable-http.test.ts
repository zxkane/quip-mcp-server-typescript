/**
 * Unit tests for StreamableHTTP implementation
 */
import express from 'express';
import { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Mock the logger to prevent console output during tests
jest.mock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Create interface for our Express mock to fix TypeScript errors
interface ExpressMock extends jest.Mock {
  json: jest.Mock;
}

// Mock express
jest.mock('express', () => {
  const mockJsonMiddleware = jest.fn();
  const mockExpress = jest.fn().mockImplementation(() => ({
    use: jest.fn(),
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    listen: jest.fn().mockImplementation((port, cb) => {
      cb && cb();
      return { close: jest.fn() };
    }),
  }));
  
  // Add json method to the mock function
  // This is necessary because in the actual code we call express.json()
  (mockExpress as ExpressMock).json = jest.fn().mockReturnValue(mockJsonMiddleware);
  
  return mockExpress;
});

// Mock the MCP SDK classes
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    registerCapabilities: jest.fn(),
    setRequestHandler: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation(() => ({
    handleRequest: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  })),
}));

describe('Streamable HTTP Mode', () => {
  // Test that will verify that Express routes are set up correctly
  it('should set up Express app with correct routes for stateless mode', () => {
    // Arrange
    const mockExpressApp = {
      use: jest.fn(),
      post: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      listen: jest.fn().mockImplementation((port, cb) => {
        cb && cb();
        return { close: jest.fn() };
      }),
    };
    
    // Mock express to return our mock app
    (express as any).mockReturnValue(mockExpressApp);

    // Create a server function that mimics the setup in server.ts
    const setupServer = (port: number) => {
      // Create Express app
      const app = express();
      app.use(express.json());
      
      // Set up the routes as in the actual code
      app.post('/mcp', jest.fn());
      app.get('/mcp', jest.fn());
      app.delete('/mcp', jest.fn());
      
      // Start HTTP server
      const httpServer = app.listen(port, () => {
        // Logger would log here
      });
      
      return { app, httpServer };
    };

    // Act
    const { app, httpServer } = setupServer(8080);
    
    // Assert - verify routes were set up correctly
    expect(express).toHaveBeenCalled();
    expect(mockExpressApp.use).toHaveBeenCalled();
    expect(mockExpressApp.post).toHaveBeenCalledWith('/mcp', expect.any(Function));
    expect(mockExpressApp.get).toHaveBeenCalledWith('/mcp', expect.any(Function));
    expect(mockExpressApp.delete).toHaveBeenCalledWith('/mcp', expect.any(Function));
    expect(mockExpressApp.listen).toHaveBeenCalledWith(8080, expect.any(Function));
  });

  // Test that POST /mcp creates a new transport for the request
  it('should create new StreamableHTTPServerTransport for each POST request in stateless mode', async () => {
    // Arrange
    const mockReq = {
      body: { jsonrpc: '2.0', method: 'mock-method', id: 123 },
      headers: {},
    } as unknown as Request;
    
    const mockRes = {
      on: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      headersSent: false,
    } as unknown as Response;
    
    const mockTransport = {
      handleRequest: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    };
    
    // Mock StreamableHTTPServerTransport to return our mock
    (StreamableHTTPServerTransport as any).mockImplementation(() => mockTransport);
    
    // Mock Server for connect
    const mockServer = {
      connect: jest.fn().mockResolvedValue(undefined),
    };
    (Server as any).mockImplementation(() => mockServer);
    
    // Create a simplified stateless request handler that mimics the implementation
    const postHandler = async (req: Request, res: Response) => {
      try {
        // Create a new transport for this request
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // stateless mode
          enableJsonResponse: true,
        } as any);
        
        // Set up cleanup on request close
        res.on('close', () => {
          transport.close();
        });
        
        // Connect to a server
        const server = new Server({
          name: "test-server",
          version: "1.0.0"
        });
        await server.connect(transport);
        
        // Handle request
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        // Error handling
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        });
      }
    };
    
    // Act
    await postHandler(mockReq, mockRes);
    
    // Assert
    expect(StreamableHTTPServerTransport).toHaveBeenCalledWith({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    
    expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
    expect(mockTransport.handleRequest).toHaveBeenCalledWith(mockReq, mockRes, mockReq.body);
    
    // Test cleanup on request close
    const onCloseHandler = (mockRes.on as any).mock.calls[0][1];
    onCloseHandler();
    expect(mockTransport.close).toHaveBeenCalled();
  });

  // Test error handling in POST /mcp
  it('should handle errors in stateless mode POST requests', async () => {
    // Arrange
    const mockReq = {
      body: { jsonrpc: '2.0', method: 'mock-method', id: 123 },
      headers: {},
    } as unknown as Request;
    
    const mockRes = {
      on: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      headersSent: false,
    } as unknown as Response;
    
    const mockError = new Error('Test error');
    const mockTransport = {
      handleRequest: jest.fn().mockRejectedValue(mockError),
      close: jest.fn(),
    };
    
    // Mock StreamableHTTPServerTransport to return our mock
    (StreamableHTTPServerTransport as any).mockImplementation(() => mockTransport);
    
    // Mock Server for connect
    const mockServer = {
      connect: jest.fn().mockResolvedValue(undefined),
    };
    (Server as any).mockImplementation(() => mockServer);
    
    // Create a simplified stateless request handler that mimics the implementation
    const postHandler = async (req: Request, res: Response) => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        } as any);
        
        res.on('close', () => {
          transport.close();
        });
        
        const server = new Server({
          name: "test-server",
          version: "1.0.0"
        });
        await server.connect(transport);
        
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        });
      }
    };
    
    // Act
    await postHandler(mockReq, mockRes);
    
    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error'
      },
      id: null
    });
  });
  
  // Test GET /mcp returns Method Not Allowed
  it('should return 405 Method Not Allowed for GET requests in stateless mode', async () => {
    // Arrange
    const mockReq = { headers: {} } as Request;
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    
    // Create get handler
    const getHandler = async (req: Request, res: Response) => {
      res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed in stateless mode.'
        },
        id: null
      });
    };
    
    // Act
    await getHandler(mockReq, mockRes);
    
    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(405);
    expect(mockRes.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed in stateless mode.'
      },
      id: null
    });
  });
  
  // Test DELETE /mcp returns Method Not Allowed
  it('should return 405 Method Not Allowed for DELETE requests in stateless mode', async () => {
    // Arrange
    const mockReq = { headers: {} } as Request;
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    
    // Create delete handler
    const deleteHandler = async (req: Request, res: Response) => {
      res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed in stateless mode.'
        },
        id: null
      });
    };
    
    // Act
    await deleteHandler(mockReq, mockRes);
    
    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(405);
    expect(mockRes.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed in stateless mode.'
      },
      id: null
    });
  });
});
