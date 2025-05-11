import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { runClientLogic } from './client-common.js';

interface S3Config {
  bucket?: string;
  region?: string;
  prefix?: string;
  urlExpiration?: number;
  awsProfile?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
}

/**
 * Run the client with HTTP transport
 */
export async function runHttpClient(
  quipToken: string,
  quipBaseUrl: string,
  threadId: string,
  port: number = 3000,
  sheetName?: string,
): Promise<void> {
  try {
    // Initialize the client
    const client = new Client(
      {
        name: "quip-mcp-example-client-http",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
    
    console.log(`Starting standalone server on port ${port} and connecting via HTTP...`);
    console.log(`Note: You need to manually start the server with the following command in a separate terminal:`);
    
    // Build example command
    const exampleCmd = `QUIP_TOKEN='<your token>' QUIP_BASE_URL='<your url>' PORT=${port}`;
    
    console.log(exampleCmd);
    
    // Configure HTTP transport to connect to the correct endpoint
    const url = new URL(`http://localhost:${port}/mcp`);
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    });
    
    console.log("Transport configuration:", {
      url: url.toString(),
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    try {
      // Connect to the server with a timeout
      console.log("Attempting to connect to the server via HTTP...");
      await client.connect(transport, { timeout: 10000 }); // 10 second timeout
      console.log("Connected to Quip MCP server using HTTP transport");
    } catch (error) {
      console.error("Failed to connect to the server:", error);
      console.error("\nConnection Error Troubleshooting:");
      console.error("1. Make sure the server is running with the command shown above");
      console.error(`2. Check that port ${port} is not being used by another process`);
      console.error("3. Verify that the server started successfully (check for error messages)");
      console.error("4. Try a different port if necessary");
      console.error("\nFull command to start the server:");
      // Define base command
      const serverCommand = `QUIP_TOKEN='${quipToken}' QUIP_BASE_URL='${quipBaseUrl}' PORT=${port} node dist/index.js --debug`;
      
      console.error(serverCommand + '\n');
      throw error;
    }
    
    // Run the common client logic
    await runClientLogic(client, threadId, sheetName);
    
    // Clean up
    console.log('Closing MCP client connection...');
    await client.close();
    
  } catch (error) {
    console.error('Error in HTTP client:', error);
    throw error;
  }
}
