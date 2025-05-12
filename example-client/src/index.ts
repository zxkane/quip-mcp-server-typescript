import path from 'path';
import dotenv from 'dotenv';
import { runStdioClient } from './stdio-client.js';
import { runHttpClient } from './http-client.js';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local' ) });

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

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result: Record<string, any> = {
    transport: 'stdio',  // Default to stdio transport for backward compatibility
    port: 3000,          // Default port for HTTP transport
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--http') {
      result.transport = 'http';
    } else if (arg === '--port' && i + 1 < args.length) {
      result.port = parseInt(args[i + 1], 10);
      i++; // Skip the next argument (the port value)
    }
  }
  
  return result;
}

/**
 * Main entry point for the Quip MCP client example
 */
async function main() {
  // Add event listeners for process events
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
  });
  
  try {
    // Parse command line args
    const options = parseArgs();
    
    // Run the appropriate client based on the transport option
    if (options.transport === 'http') {
      await runHttpClient(
        quipToken, 
        quipBaseUrl, 
        threadId, 
        options.port, 
        sheetName,
      );
    } else {
      await runStdioClient(quipToken, quipBaseUrl, threadId, sheetName);
    }
    
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
