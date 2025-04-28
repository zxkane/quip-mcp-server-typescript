import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { parse } from 'csv-parse/sync';
import {
  ListToolsResultSchema,
  CallToolResultSchema,
  ReadResourceResultSchema
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Check required environment variables
const required = ['QUIP_TOKEN', 'QUIP_BASE_URL', 'QUIP_THREAD_ID'];
const missing = required.filter(name => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please create a .env.local file with these variables');
  process.exit(1);
}

// Get environment variables
const quipToken = process.env.QUIP_TOKEN || '';
const quipBaseUrl = process.env.QUIP_BASE_URL || '';
const threadId = process.env.QUIP_THREAD_ID || '';
const sheetName = process.env.QUIP_SHEET_NAME;

async function main() {
  // Get the current file's directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  console.log('Starting Quip MCP client example');
  console.log('-------------------------------');
  
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
    const args = [serverPath, "--debug", "--file-protocol", "--json", "--log-file", "./server.log"]; // Use debug mode, file protocol, and JSON output
    
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
    
    // Add event listeners for process events
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception:', err);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
    });
    
    console.log("Transport configuration:", {
      command: 'node',
      args: args,
      env: {
        QUIP_TOKEN: quipToken ? "***" : undefined,
        QUIP_BASE_URL: quipBaseUrl,
        PORT: env.PORT || 'undefined (explicitly removed)',
        NODE_OPTIONS: "--inspect"
      }
    });
    
    console.log("Starting MCP server process...");
    
    try {
      // Connect to the server with a shorter timeout
      console.log("Attempting to connect to the server...");
      await client.connect(transport, { timeout: 10000 }); // 10 second timeout
      console.log("Connected to Quip MCP server");
      
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
      process.exit(1);
    }
    
    // List available tools
    console.log('Getting available tools...');
    try {
      console.log('Sending list_tools request...');
      const toolsResult = await client.request(
        { 
          method: "tools/list",
          // Adding empty params to avoid potential SDK issues
          params: {}
        },
        ListToolsResultSchema
      );
      console.log('Received list_tools response');
      
      if (toolsResult && toolsResult.tools && Array.isArray(toolsResult.tools)) {
        console.log(`Found ${toolsResult.tools.length} tools:`);
        for (const tool of toolsResult.tools) {
          console.log(`- ${tool.name}: ${tool.description}`);
        }
      } else {
        console.log('No tools available or unexpected response structure');
        console.log('Response:', JSON.stringify(toolsResult, null, 2));
      }
    } catch (toolsError) {
      console.error('Error listing tools:', toolsError);
      // Continue execution to try other requests
    }
    
    // Call the quip_read_spreadsheet tool
    console.log('\nReading spreadsheet data...');
    console.log(`Thread ID: ${threadId}`);
    if (sheetName) {
      console.log(`Sheet Name: ${sheetName}`);
    }
    
    const toolParams: Record<string, any> = { threadId };
    if (sheetName) {
      toolParams.sheetName = sheetName;
    }
    
    const startTime = new Date();
    console.log(`Request started at: ${startTime.toISOString()}`);
    
    try {
      console.log('Sending call_tool request...');
      const toolResult = await client.request(
        {
          method: "tools/call",
          params: {
            name: "quip_read_spreadsheet",
            arguments: toolParams
          },
        },
        CallToolResultSchema
      );
      console.log('Received call_tool response');
      
      // Log end time and duration
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      // Parse the response
      if (toolResult && toolResult.content && Array.isArray(toolResult.content) && toolResult.content.length > 0) {
        const content = toolResult.content[0];
        
        if (content.type === "text" && content.text) {
          const responseData = JSON.parse(content.text);
          
          // Display results
          console.log('\nSpreadsheet Data:');
          console.log('----------------');
          console.log(`Total Rows: ${responseData.metadata.total_rows}`);
          console.log(`Total Size: ${responseData.metadata.total_size} bytes`);
          console.log(`Truncated: ${responseData.metadata.is_truncated ? 'Yes' : 'No'}`);
          console.log(`Resource URI: ${responseData.metadata.resource_uri}`);
          
          console.log('\nCSV Content Preview:');
          console.log('-------------------');
          // Parse CSV content using csv-parse library
          const records = parse(responseData.csv_content, {
            columns: true,
            skip_empty_lines: true
          });
          
          // Display first 5 rows of parsed CSV
          console.log('First', Math.min(5, records.length), 'rows (parsed as objects):');
          const previewRows = records.slice(0, Math.min(5, records.length));
          console.table(previewRows);
          
          if (responseData.metadata.is_truncated && responseData.metadata.resource_uri) {
            console.log('... (content truncated)');
            
            // Access the complete content through resource URI
            console.log('\nAccessing complete content through resource URI...');
            
            try {
              console.log('Sending read_resource request...');
              const resourceResult = await client.request(
                { 
                  method: "resources/read",
                  params: { uri: responseData.metadata.resource_uri }
                },
                ReadResourceResultSchema
              );
              console.log('Received read_resource response');
              
              // Debug the response structure
              console.log('Resource result:', JSON.stringify(resourceResult, null, 2));
              
              if (resourceResult && resourceResult.contents && Array.isArray(resourceResult.contents) && resourceResult.contents.length > 0) {
                const resourceContent = resourceResult.contents[0];
                console.log('Resource content:', JSON.stringify(resourceContent, null, 2));
                
                if (resourceContent.type === "text" && typeof resourceContent.text === 'string') {
                  console.log(`Complete CSV has ${resourceContent.text.split('\n').length} lines`);
                } else {
                  console.log('Could not retrieve complete CSV content');
                  console.log('Content type:', resourceContent.type);
                  console.log('Text type:', typeof resourceContent.text);
                  console.log('Text value:', resourceContent.text);
                }
              } else {
                console.log('No content returned from resource');
                console.log('Response:', JSON.stringify(resourceResult, null, 2));
              }
            } catch (resourceError) {
              console.error('Error reading resource:', resourceError);
            }
          } else if (responseData.metadata.is_truncated) {
            console.log('... (content truncated, but no resource URI available)');
          }
        } else {
          console.log('Unexpected response type:', content.type);
        }
      } else {
        console.log('No content returned from tool call');
        console.log('Response:', JSON.stringify(toolResult, null, 2));
      }
      
      console.log(`\nRequest completed at: ${endTime.toISOString()}`);
      console.log(`Total duration: ${duration}ms`);
      
    } catch (toolError) {
      console.error('Error calling tool:', toolError);
    }
    
    // Clean up
    console.log('Closing MCP client connection...');
    await client.close();
    console.log('\nTest completed successfully');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Handle interrupts
process.on('SIGINT', () => {
  console.log('Interrupted, exiting...');
  process.exit(0);
});

main().catch(console.error);
