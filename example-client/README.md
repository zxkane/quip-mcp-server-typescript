# Quip MCP Server Example Client

This directory contains an example client for the Quip MCP Server, demonstrating how to interact with the server using the Model Context Protocol (MCP).

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

## Available Client

### TypeScript SDK Client (`src/index.ts`)

This client demonstrates how to use the official MCP SDK to interact with the Quip MCP server.

**Features:**
- Uses TypeScript and MCP SDK
- Demonstrates complete workflow: connect, list tools, call tool, read resource
- Handles error cases and provides structured output
- Parses and displays spreadsheet data
- Includes robust error handling and debugging features

**Build and run:**
```bash
npm run build
npm start
```

## Using Debug and Mock Mode

The example client is configured to use debug mode by default with the `--debug` and `--file-protocol` flags. The client also supports mock mode which doesn't require a real Quip API token to run.

The available flags include:
- `--debug`: Enables verbose logging
- `--file-protocol`: Uses file-based protocol for interaction
- `--mock`: Runs in mock mode with simulated data

The client includes extensive logging and error handling to help you understand the MCP interaction flow:
- Connection establishment with timeout handling
- Tool discovery and listing
- Spreadsheet data retrieval
- Resource access for larger datasets
- Performance timing for operations

## Troubleshooting

### Timeout Issues

The client configures a 10-second timeout for connecting to the server. If you encounter timeout errors:

1. Try reducing the complexity of your requests
2. Ensure your environment variables are correctly set
3. Check network connectivity to the Quip API
4. Verify that the server is running properly

### Module Format

The example client uses ESM modules format, indicated by `"type": "module"` in package.json. The client properly handles ESM imports and paths using Node.js native ESM features.

## Server Capabilities

The Quip MCP Server provides the following tools:

- `quip_read_spreadsheet`: Reads data from a Quip spreadsheet and returns it as CSV
- Additional tools may be available in future versions

## Additional Resources

- [MCP Protocol Specification](https://github.com/modelcontextprotocol/spec)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Quip API Documentation](https://quip.com/dev/automation/documentation)
