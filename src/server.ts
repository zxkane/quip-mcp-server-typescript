/**
 * MCP Server implementation for Quip
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { URL } from 'url';

// Import MCP SDK
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { Request, Response } from 'express';
import {
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Import types from our local definitions
import {
  TextContent,
  ImageContent,
  EmbeddedResource,
  getQuipTools, 
  handleQuipReadSpreadsheet
} from './tools';

// Import error handling
import {
  MethodNotFoundError,
  ResourceNotFoundError} from './errors';

// Import logger
import { logger } from './logger';

// Import types and utilities
import { StorageInterface } from './types';
import { parseCommandLineArgs, configureLogging, getStoragePath } from './cli';
import { version } from './version';
import { createStorage } from './storage';

// Load environment variables
dotenv.config();

// Global storage instance
let storageInstance: StorageInterface | null = null;

// Constants

// Define interfaces for MCP types
interface Resource {
  uri: string;
  name: string;
  description: string;
  mime_type?: string;
}

interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description: string;
  parameterDefinitions: TemplateParameter[];
}

interface TemplateParameter {
  name: string;
  description: string;
  required: boolean;
}

/**
 * Generate available resource templates
 * 
 * @returns Array of resource templates
 */
function generateResourceTemplates(): ResourceTemplate[] {
  logger.info("Generating resource templates");
  
  // Create template for Quip spreadsheet with thread ID and optional sheet name
  const spreadsheetTemplate: ResourceTemplate = {
    uriTemplate: "quip://{thread_id}?sheet={sheet_name}",
    name: "Quip Spreadsheet",
    description: "Access a specific sheet within a Quip spreadsheet document by thread ID and sheet name",
    parameterDefinitions: [
      {
        name: "thread_id",
        description: "The Quip document thread ID",
        required: true
      },
      {
        name: "sheet_name",
        description: "The name of the sheet (if omitted, will use the first sheet)",
        required: false
      }
    ]
  };
  
  return [spreadsheetTemplate];
}


/**
 * Discover available resources by scanning the storage directory
 *
 * @param isFileProtocol Whether to use file protocol for resource URIs
 * @returns Promise resolving to list of available resources
 */
async function discoverResources(isFileProtocol: boolean): Promise<Resource[]> {
  logger.info("Discovering resources");
  
  if (!storageInstance) {
    logger.error("Storage not initialized");
    return [];
  }
  
  // Check if storage is LocalStorage
  if (!(storageInstance as any).storagePath) {
    logger.warn("Storage is not LocalStorage, cannot discover resources");
    return [];
  }
  
  const resources: Resource[] = [];
  const storagePath = (storageInstance as any).storagePath;
  
  try {
    // Scan storage directory for CSV files
    const files = await fs.readdir(storagePath);
    
    for (const filename of files) {
      if (filename.endsWith(".csv") && !filename.endsWith(".meta")) {
        // Parse filename to get thread_id and sheet_name
        const filePath = path.join(storagePath, filename);
        
        // Extract thread_id and sheet_name from filename
        let threadId: string;
        let sheetName: string | undefined;
        
        if (filename.includes("-")) {
          // Format: {thread_id}-{sheet_name}.csv
          threadId = filename.split("-")[0];
          sheetName = filename.split("-").slice(1).join("-").replace(".csv", "");
        } else {
          // Format: {thread_id}.csv
          threadId = filename.replace(".csv", "");
          sheetName = undefined;
        }
        
        // Get metadata
        const metadata = await storageInstance.getMetadata(threadId, sheetName);
        
        // Create resource URI
        let resourceUri: string;
        if (isFileProtocol) {
          resourceUri = `file://${filePath}`;
        } else {
          // Use resource template to create resource URI
          resourceUri = storageInstance.getResourceURI(threadId, sheetName);
        }
        
        // Create resource name
        let resourceName = `Quip Thread(Spreadsheet): ${threadId}`;
        if (sheetName) {
          resourceName += ` (Sheet: ${sheetName})`;
        }
        if (isFileProtocol) {
          resourceName += ` You can access the file at: ${filePath}`;
        }
        
        // Create resource description
        const description = `CSV data from Quip spreadsheet. ${metadata.total_rows || 0} rows, ${metadata.total_size || 0} bytes.`;
        
        // Create resource
        const resource: Resource = {
          uri: resourceUri,
          name: resourceName,
          description: description,
          mime_type: "text/csv"
        };
        
        resources.push(resource);
        logger.info(`Discovered resource: ${resourceUri}`);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error discovering resources`, { error: errorMessage });
  }
  
  logger.info(`Discovered ${resources.length} resources`);
  return resources;
}

/**
 * Handle resource access requests
 *
 * @param uri Resource URI
 * @returns Promise resolving to sequence of content objects
 */
async function accessResource(uri: string): Promise<(TextContent | ImageContent | EmbeddedResource)[]> {
  logger.info(`Handling resource access: ${uri}`);
  
  // Parse the URI
  const parsedUri = new URL(uri);
  
  if (parsedUri.protocol !== 'quip:' && parsedUri.protocol !== 'file:') {
    logger.error(`Unsupported URI scheme: ${parsedUri.protocol}`);
    throw new ResourceNotFoundError(uri);
  }
  
  // Extract thread_id and sheet_name
  let threadId: string;
  let sheetName: string | undefined;
  
  if (parsedUri.protocol === 'file:') {
    const filename = path.basename(parsedUri.pathname).replace(".csv", "").split("-");
    threadId = filename[0];
    sheetName = filename.length > 1 ? filename.slice(1).join("-") : undefined;
  } else {
    threadId = parsedUri.hostname;
    const searchParams = new URLSearchParams(parsedUri.search);
    sheetName = searchParams.get('sheet') || undefined;
  }
  
  logger.info(`Accessing resource for thread_id: ${threadId}, sheet_name: ${sheetName || 'default'}`);
  
  // Get the CSV content from storage
  if (!storageInstance) {
    logger.error("Storage not initialized");
    throw new ResourceNotFoundError(uri);
  }
  
  const csvContent = await storageInstance.getCSV(threadId, sheetName);
  if (!csvContent) {
    logger.error(`Resource not found: ${uri}`);
    throw new ResourceNotFoundError(uri);
  }
  
  // Return the full CSV content with URI as required by MCP schema
  return [{ 
    type: "text", 
    text: csvContent,
    uri: uri  // Add the URI field to match the expected schema
  }];
}

/**
 * Main entry point for the Quip MCP server
 */
export async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const options = parseCommandLineArgs();
    
    // Configure logging based on options
    configureLogging(options);
    
    // Check for required environment variables if not in mock mode
    if (!options.mock) {
      const quipToken = process.env.QUIP_TOKEN;
      if (!quipToken) {
        logger.error("QUIP_TOKEN environment variable is not set");
        logger.error("Please set the QUIP_TOKEN environment variable to your Quip API token or use --mock mode");
        process.exit(1);
      }
    } else {
      logger.info("Running in mock mode - no Quip token required");
    }
    
    // Get storage path from options or environment
    const storagePath = getStoragePath(options);
    
    // Initialize storage
    storageInstance = createStorage('local', {
      storagePath,
      isFileProtocol: options.fileProtocol
    });
    
    // Create a minimal MCP server
    const server = new Server({
      name: "quip-mcp-server",
      version: version
    });
    
    // Register capabilities
    logger.info("Registering capabilities");
    server.registerCapabilities({
      tools: {},
      resources: {
        templates: true  // Indicate that this server supports resource templates
      }
    });
    
    // Register tools
    logger.info("Registering tools");
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.info("Handling tools/list request");
      const tools = getQuipTools();
      return { tools };
    });
    
    // Register tool call handler
    logger.info("Registering tool call handler");
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      logger.info(`Handling tools/call request for tool: ${request.params.name}`);
      
      if (request.params.name === "quip_read_spreadsheet") {
        return {
          content: await handleQuipReadSpreadsheet(
            request.params.arguments || {},
            storageInstance!,
            options.mock
          )
        };
      } else {
        logger.error(`Unknown tool: ${request.params.name}`);
        throw new MethodNotFoundError(`Unknown tool: ${request.params.name}`);
      }
    });
    
    // Discover resources
    logger.info("Discovering resources");
    const resources = await discoverResources(options.fileProtocol);
    
    // Register resources list handler
    logger.info("Registering resources list handler");
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.info("Handling resources/list request");
      return { resources };
    });
    
    // Register resource read handler
    logger.info("Registering resource read handler");
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      logger.info(`Handling resources/read request for URI: ${request.params.uri}`);
      return {
        contents: await accessResource(request.params.uri)
      };
    });
    
    // Register resource templates list handler
    logger.info("Registering resource templates list handler");
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      logger.info("Handling resources/list_templates request");
      const resourceTemplates = generateResourceTemplates();
      return { resourceTemplates };
    });
    
    // Choose transport based on options
    
    // Check if we're being launched by the client (stdin is a pipe)
    const isStdinPipe = !process.stdin.isTTY;
    
    logger.info(`Stdin is pipe: ${isStdinPipe}, process.stdin.isTTY: ${process.stdin.isTTY}`);
    logger.info(`Environment PORT: ${process.env.PORT}, options.port: ${options.port}`);
    
    // Choose transport based on options
    if (options.port || process.env.PORT) {
      // Using Streamable HTTP transport with Express
      const port = options.port || parseInt(process.env.PORT || '3000', 10);
      logger.info(`Using HTTP transport on port ${port}`);
      
      // Create Express app
      const app = express();
      app.use(express.json());
      
      // Handle POST requests for client-to-server communication
      app.post('/mcp', async (req: Request, res: Response) => {
        logger.info('Received POST MCP request');
        
        try {
          // Each request gets its own transport and server instance for stateless mode
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,  // No sessions in stateless mode
            enableJsonResponse: true
          });
          
          // Clean up on request close
          res.on('close', () => {
            logger.info('Request closed');
            transport.close();
          });
          
          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Error handling MCP request:', { error: errorMessage });
          
          if (!res.headersSent) {
            res.status(500).json({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Internal server error'
              },
              id: null
            });
          }
        }
      });
      
      // Stateless mode doesn't support GET (server-sent events) or DELETE (session termination)
      app.get('/mcp', async (req: Request, res: Response) => {
        logger.info('Received GET MCP request');
        res.status(405).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Method not allowed in stateless mode.'
          },
          id: null
        });
      });
      
      app.delete('/mcp', async (req: Request, res: Response) => {
        logger.info('Received DELETE MCP request');
        res.status(405).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Method not allowed in stateless mode.'
          },
          id: null
        });
      });
      
      // Start HTTP server
      const httpServer = app.listen(port, () => {
        logger.info(`MCP server listening on port ${port}`);
      });
      
      // Keep the process alive
      return new Promise<void>((resolve) => {
        process.on('SIGINT', async () => {
          logger.info('Shutting down server');
          httpServer.close();
          await server.close();
          resolve();
          process.exit(0);
        });
      });
    } else {
      // Using stdio transport
      logger.info("Using stdio transport");
      const transport = new StdioServerTransport();
      
      // Connect to the transport - this will block for stdio
      logger.info("Connecting to transport");
      try {
        await server.connect(transport);
        logger.info("Server connected successfully");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error connecting to transport: ${errorMessage}`);
        throw error;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error in main`, { error: errorMessage });
    process.exit(1);
  }
}
