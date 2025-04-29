# Quip MCP Server Example Client

This directory contains example clients for the Quip MCP Server, demonstrating how to interact with the server using the Model Context Protocol (MCP) with different transport mechanisms.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

3. Edit the `.env.local` file to include your Quip API token, base URL, and thread ID:
   - `QUIP_TOKEN`: Your Quip API token
   - `QUIP_BASE_URL`: Quip API base URL (defaults to https://platform.quip.com/1)
   - `QUIP_THREAD_ID`: ID of the Quip thread containing the spreadsheet
   - `QUIP_SHEET_NAME`: (Optional) Name of the specific sheet if multiple exist

4. Build the TypeScript code:
   ```bash
   npm run build
   ```

## Available Transport Options

The example client supports two different transport mechanisms for communicating with the Quip MCP server:

### STDIO Transport (Default)

This transport method spawns a server process and communicates with it directly via standard input/output. This is the simplest way to use the MCP server, as it doesn't require any additional setup.

**Run with STDIO transport:**
```bash
npm start
# or explicitly:
npm run start:stdio
```

### HTTP Transport

This transport method connects to the server over HTTP. This requires you to separately start the server in HTTP mode by setting the PORT environment variable.

#### Using the Helper Script (Recommended)

We've provided a helper script to make starting the HTTP server easier:

1. First, start the server in a separate terminal:
   ```bash
   # In one terminal, start the server with an HTTP endpoint
   ./start-http-server.sh 3000
   ```

2. Then, run the client with HTTP transport:
   ```bash
   # In another terminal, run the client with HTTP transport
   npm run start:http
   # or specify a custom port:
   npm run start:http:3000
   ```

#### Manual Server Start

If you prefer to start the server manually:

1. First, start the server in a separate terminal:
   ```bash
   # In one terminal, start the server with an HTTP endpoint
   QUIP_TOKEN='your_token_here' QUIP_BASE_URL='your_base_url_here' PORT=3000 node dist/index.js --storage-path /data/tmp/mcp/quip-mcp-server --debug
   ```

2. Then, run the client with HTTP transport:
   ```bash
   # In another terminal, run the client with HTTP transport
   npm run start:http
   ```

## Features

Both transport options demonstrate the same core functionality:

- Uses TypeScript and MCP SDK
- Demonstrates complete workflow: connect, list tools, call tool, read resource
- Handles error cases and provides structured output
- Parses and displays spreadsheet data
- Includes robust error handling and debugging features

## Project Structure

- `src/index.ts` - Main entry point and command-line argument handling
- `src/client-common.ts` - Shared client logic that works with both transports
- `src/stdio-client.ts` - STDIO-specific transport implementation
- `src/http-client.ts` - HTTP-specific transport implementation

## Using Debug and Mock Mode

The example client is configured to use debug mode by default with the `--debug` and `--file-protocol` flags. The client also supports mock mode which doesn't require a real Quip API token to run.

The available server flags include:
- `--debug`: Enables verbose logging
- `--file-protocol`: Uses file-based protocol for interaction
- `--mock`: Runs in mock mode with simulated data

## Troubleshooting

### STDIO Transport Issues

If you encounter issues with the STDIO transport:

1. Check that the server executable path is correct
2. Ensure your environment variables are correctly set
3. Check the server logs (redirected to `server.log`)

### HTTP Transport Issues

If you encounter issues with the HTTP transport:

1. Make sure you have started the server with `PORT=<port> node dist/index.js --debug`
2. Check that the port numbers match between server and client
3. Make sure there are no firewall or networking issues blocking the connection
4. Try increasing the timeout if you have slow connections

## Server Capabilities

The Quip MCP Server provides the following tools:

- `quip_read_spreadsheet`: Reads data from a Quip spreadsheet and returns it as CSV
- Additional tools may be available in future versions

## Additional Resources

- [MCP Protocol Specification](https://github.com/modelcontextprotocol/spec)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Quip API Documentation](https://quip.com/dev/automation/documentation)
