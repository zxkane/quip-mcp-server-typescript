import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { runClientLogic } from './client-common.js';

/**
 * Run the client with stdio transport
 */
export async function runStdioClient(
  quipToken: string,
  quipBaseUrl: string,
  threadId: string,
  sheetName?: string
): Promise<void> {
  // Get the current file's directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  try {
    // Initialize the client
    const client = new Client(
      {
        name: "quip-mcp-example-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
    
    // Create stdio transport with mock mode
    const serverPath = path.resolve(__dirname, '../../dist/index.js');
    console.log(`Server path: ${serverPath}`);
    
    // Create a clean environment without PORT to ensure stdio transport is used
    const env = { ...process.env };
    delete env.PORT; // Explicitly remove PORT to prevent HTTP transport
    
    // Add debug flag for server and JSON format to redirect logs 
    const args = [serverPath, "--file-protocol", "--json", "--log-file", "./server.log"];
    
    // Configure transport with stderr piped to capture logs
    const transport = new StdioClientTransport({
      command: 'node',
      args,
      env: {
        ...env,
        QUIP_TOKEN: quipToken,
        QUIP_BASE_URL: quipBaseUrl,
        NODE_OPTIONS: "--inspect" // Enable Node.js inspector for debugging
      },
      stderr: 'pipe' // Pipe stderr so we can capture server logs
    });
    
    console.log("Transport configuration:", {
      command: 'node',
      args: args,
      env: {
        QUIP_TOKEN: quipToken ? "***" : undefined,
        QUIP_BASE_URL: quipBaseUrl ?  "***" : 'default',
        PORT: env.PORT || 'undefined (explicitly removed)',
        NODE_OPTIONS: "--inspect"
      }
    });
    
    console.log("Starting MCP server process with stdio transport...");
    
    try {
      // Connect to the server with a shorter timeout
      console.log("Attempting to connect to the server...");
      await client.connect(transport, { timeout: 10000 }); // 10 second timeout
      console.log("Connected to Quip MCP server using stdio transport");
      
      // Access stderr after connection is established
      if (transport.stderr) {
        console.log("Server stderr stream available, setting up log capture...");
        transport.stderr.on('data', (chunk: Buffer) => {
          console.log(`[SERVER LOG] ${chunk.toString().trim()}`);
        });
      } else {
        console.log("Server stderr stream not available");
      }
    } catch (error) {
      console.error("Failed to connect to the server:", error);
      throw error;
    }
    
    // Run the common client logic
    await runClientLogic(client, threadId, sheetName);
    
    // Clean up
    console.log('Closing MCP client connection...');
    await client.close();
    
  } catch (error) {
    console.error('Error in stdio client:', error);
    throw error;
  }
}
