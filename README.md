[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/zxkane-quip-mcp-server-typescript-badge.png)](https://mseep.ai/app/zxkane-quip-mcp-server-typescript)

# Quip MCP Server (TypeScript)

A Model Context Protocol (MCP) server for interacting with Quip spreadsheets, implemented in TypeScript. This server provides tools to read spreadsheet data from Quip documents and return the content in CSV format.

## 🚀 AWS Pay-as-You-Go Serverless Deployment

**Deploy to AWS with zero infrastructure management and pay only for what you use!**

### ⚡ AWS Agent Core Runtime (Recommended)
- **🔧 SSE Support**: Built-in Server-Sent Events for real-time streaming
- **⏱️ Extended Runtime**: Up to 8 hours execution time
- **📦 Large Payloads**: 100MB payload support
- **🔐 Built-in Auth**: Integrated OAuth and identity management
- **💰 Consumption-based**: Pay only for actual runtime usage

```bash
cd infrastructure/agent-core
./deploy.sh --agent-name my-quip-mcp --secret-arn arn:aws:secretsmanager:...
```

### 🌐 AWS Lambda + API Gateway
- **📈 Auto-scaling**: Handles varying loads automatically
- **🌍 Global**: Distributed across multiple availability zones
- **💸 Cost-effective**: Pay per request with generous free tier
- **🔌 HTTP Interface**: Works with any HTTP MCP client

```bash
cd infrastructure/api-gateway-lambda
./deploy.sh --secret-arn arn:aws:secretsmanager:...
```

Both options provide enterprise-grade serverless infrastructure with no servers to manage!

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [Using npm](#using-npm)
  - [From Source](#from-source)
  - [Environment Variables](#environment-variables)
- [Usage](#usage)
  - [Running the Server](#running-the-server)
  - [Transport Documentation](#transport-documentation)
  - [Configure for Claude.app](#configure-for-claudeapp)
  - [Command Line Arguments](#command-line-arguments)
  - [Server-Sent Events (SSE) Support](#server-sent-events-sse-support)
  - [Deploy to AWS Lambda + API Gateway](#deploy-to-aws-lambda--api-gateway)
- [Available Tools](#available-tools)
  - [quip_read_spreadsheet](#quip_read_spreadsheet)
- [Resource URIs](#resource-uris)
- [How It Works](#how-it-works)
  - [Error Handling](#error-handling)
  - [Mock Mode](#mock-mode)
  - [Structured Logging](#structured-logging)
  - [Authentication](#authentication)
  - [Caching](#caching)
  - [Storage Options](#storage-options)
    - [Local Storage](#local-storage)
    - [S3 Storage](#s3-storage)
- [Health Check Endpoint](#health-check-endpoint)
- [Cloud Deployment](#cloud-deployment)
  - [AWS Lambda + API Gateway](#aws-lambda--api-gateway)
  - [AWS Agent Core Runtime](#aws-agent-core-runtime)
- [Development](#development)
  - [Project Structure](#project-structure)
  - [Setting Up a Development Environment](#setting-up-a-development-environment)
  - [Scripts](#scripts)
  - [Running Tests](#running-tests)
  - [Debugging](#debugging)
  - [Adding New Tools](#adding-new-tools)
- [Contributing](#contributing)
- [License](#license)

## Features

- Retrieve spreadsheet content from Quip documents
- Support for selecting specific sheets by name
- Returns data in CSV format with metadata
- Handles authentication via Quip API token
- Provides appropriate error messages for non-spreadsheet documents
- Automatically handles large spreadsheets by truncating content when necessary
- Stores spreadsheet content locally for efficient access
- **Multiple storage options** including local filesystem and Amazon S3
- Provides resource URIs for accessing complete spreadsheet content
- **Enhanced error handling** with detailed error messages and proper error types
- **Mock mode** for testing without a real Quip API token
- **Structured logging** with different log levels (debug, info, warn, error)
- **API key authentication** for securing the HTTP server
- **Caching mechanism** for improved performance with frequently accessed resources
- **Health check endpoint** for monitoring server status

## Installation

### Using npm

```bash
# Install globally
npm install -g @zxkane/quip-mcp-server

# Or install locally in your project
npm install @zxkane/quip-mcp-server
```

### From Source

```bash
# Clone the repository
git clone https://github.com/zxkane/quip-mcp-server-typescript.git
cd quip-mcp-server-typescript

# Install dependencies
npm install

# Build the project
npm run build
```

### Environment Variables

Create a `.env` file in the root directory with your Quip API token:

```
# Quip API token (required unless in mock mode)
QUIP_TOKEN=your_quip_api_token_here

# Quip API base URL (optional, defaults to https://platform.quip.com)
QUIP_BASE_URL=https://platform.quip.com

# Storage type (optional, defaults to 'local', can be 'local' or 's3')
# STORAGE_TYPE=local

# Storage path for CSV files (optional, defaults to ~/.quip-mcp-server/storage)
QUIP_STORAGE_PATH=/path/to/storage

# S3 storage configuration (required when STORAGE_TYPE=s3)
# S3_BUCKET=your-bucket-name
# S3_REGION=us-east-1
# S3_PREFIX=quip-data/
# S3_URL_EXPIRATION=3600

# MCP server port (optional, defaults to 3000)
MCP_PORT=3000

# Debug mode (optional, set to true to enable debug logging)
# QUIP_DEBUG=true

# Mock mode (optional, set to true to use mock data without a real Quip token)
# QUIP_MOCK=true

# JSON logging (optional, set to true to output logs as JSON)
# JSON_LOGS=true

# Authentication (optional, set to true to enable API key authentication)
# MCP_AUTH_ENABLED=true

# API key for authentication (optional, auto-generated if not provided)
# MCP_API_KEY=your_api_key_here

# API key header name (optional, defaults to X-API-Key)
# MCP_API_KEY_HEADER=X-API-Key
```

## Usage

### Running the Server

```bash
# Using npm with stdio transport (default)
npm start

# With command-line arguments
npm start -- --storage-path /path/to/storage --file-protocol --debug

# Using HTTP transport (set PORT and HOST environment variables)
PORT=3000 HOST=localhost npm start

# Using node directly
node dist/index.js --storage-path /path/to/storage
```

The server supports two transport protocols:

1. **stdio transport** (default): Used when running as a subprocess for tools like Claude.app
2. **HTTP transport**: Used when you want to expose the server over HTTP, which is useful for development or when running as a standalone service

To use HTTP transport, set the `PORT` environment variable (and optionally `HOST`).

For detailed information about transport options, configuration, security considerations, and environment-specific examples, see the [Transport Documentation](docs/transport-documentation.md).

### Transport Documentation

The Quip MCP server supports two transport types:

- **Stdio Transport**: The default transport, used when running the server as a subprocess of another application (e.g., Claude.app).
- **HTTP Transport**: Used when exposing the server over HTTP, allowing clients to connect over a network.

The [detailed transport documentation](docs/transport-documentation.md) covers:

- Transport configuration options
- Security considerations for each transport type
- Environment-specific examples (local development, Claude.app integration, production deployment, Docker/container usage, CI/CD integration)
- Troubleshooting common issues
- Future considerations for transport improvements

### Configure for Claude.app

Add to your Claude settings:

```json
"mcpServers": {
  "quip": {
    "command": "node",
    "args": ["dist/index.js", "--storage-path", "/path/to/storage"],
    "env": {
      "QUIP_TOKEN": "your_quip_api_token"
    }
  }
}
```

If you want to use the file protocol for resource URIs:

```json
"mcpServers": {
  "quip": {
    "command": "node",
    "args": ["dist/index.js", "--storage-path", "/path/to/storage", "--file-protocol"],
    "env": {
      "QUIP_TOKEN": "your_quip_api_token"
    }
  }
}
```

### Command Line Arguments

The server supports the following command line arguments:

- `--storage-type <type>`: Storage type (local or s3, defaults to 'local')
- `--storage-path <path>`: Path to store CSV files (defaults to QUIP_STORAGE_PATH environment variable or ~/.quip-mcp-server/storage)
- `--file-protocol`: Use file protocol for resource URIs (instead of quip:// protocol)
- `--s3-bucket <name>`: S3 bucket name (required for S3 storage)
- `--s3-region <region>`: S3 region (required for S3 storage)
- `--s3-prefix <prefix>`: S3 prefix (optional for S3 storage)
- `--s3-url-expiration <seconds>`: S3 URL expiration in seconds (default: 3600)
- `--use-presigned-urls`: Generate presigned HTTPS URLs for S3 resources (instead of s3:// URIs)
- `--debug`: Enable debug logging
- `--mock`: Use mock mode (no real Quip token required)
- `--json`: Output logs as JSON
- `--auth`: Enable authentication
- `--api-key <key>`: API key for authentication (auto-generated if not provided)
- `--api-key-header <header>`: API key header name (defaults to X-API-Key)
- `--port <port>`: HTTP port to listen on (defaults to MCP_PORT environment variable or 3000)
- `--sse`: Enable SSE (Server-Sent Events) format for responses (defaults to false)

**Example:**
```bash
node dist/index.js --storage-path /path/to/storage --file-protocol --debug
```

**Example with mock mode:**
```bash
node dist/index.js --mock --storage-path /path/to/storage
```

**Example with authentication:**
```bash
node dist/index.js --auth --api-key your_api_key_here
```

**Example with SSE format:**
```bash
node dist/index.js --port 3000 --sse --mock
```

### Server-Sent Events (SSE) Support

The server supports Server-Sent Events (SSE) format for HTTP responses through the `--sse` flag. SSE is a web standard that allows servers to push data to clients over a single HTTP connection using the `text/event-stream` content type.

**When to use SSE:**
- Real-time applications that need streaming responses
- Integration with systems that expect event-stream format
- WebSocket alternatives for server-to-client communication
- Progressive response streaming

**Response Format Differences:**

*With `--sse` flag:*
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"jsonrpc":"2.0","result":{"tools":[...]},"id":1}

```

*Without `--sse` flag (default):*
```
Content-Type: application/json

{"jsonrpc":"2.0","result":{"tools":[...]},"id":1}
```

**Testing SSE functionality:**
```bash
# Start SSE server
node dist/index.js --port 3000 --sse --mock &

# Test with curl
curl -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
     http://localhost:3000/mcp
```

All MCP protocol methods are supported with SSE format, including error responses. The underlying MCP functionality remains unchanged.

### Deploy to AWS Lambda + API Gateway

The Quip MCP server can be deployed to AWS Lambda with API Gateway to create a serverless, scalable HTTP endpoint. This setup is ideal for production environments and provides several benefits:

- **Serverless Operation**: No need to manage servers
- **Auto-scaling**: Handles varying loads automatically
- **High Availability**: Distributed across multiple availability zones
- **Cost-effective**: Pay only for what you use
- **Streamable HTTP Interface**: Works with tools that support HTTP MCP servers

For detailed deployment instructions, see the [Cloud Deployment](#aws-lambda--api-gateway) section.

## Available Tools

### quip_read_spreadsheet

Retrieves the content of a Quip spreadsheet as CSV.

**Parameters:**
- `threadId` (required): The Quip document thread ID
- `sheetName` (optional): Name of the sheet to extract. If not provided, the first sheet will be used.

**Example:**
```json
{
  "threadId": "AbCdEfGhIjKl",
  "sheetName": "Sheet1"
}
```

**Response:**
The tool returns a JSON object containing:
- `csv_content`: The spreadsheet content in CSV format (truncated if too large)
- `metadata`: Additional information about the spreadsheet:
  - `total_rows`: Total number of rows in the spreadsheet
  - `total_size`: Total size of the CSV content in bytes
  - `is_truncated`: Boolean indicating if the content was truncated
  - `resource_uri`: URI to access the complete spreadsheet content

**Example Response (default protocol):**
```json
{
  "csv_content": "header1,header2\nvalue1,value2\n...",
  "metadata": {
    "total_rows": 1000,
    "total_size": 52840,
    "is_truncated": true,
    "resource_uri": "quip://AbCdEfGhIjKl?sheet=Sheet1"
  }
}
```

**Example Response (with --file-protocol):**
```json
{
  "csv_content": "header1,header2\nvalue1,value2\n...",
  "metadata": {
    "total_rows": 1000,
    "total_size": 52840,
    "is_truncated": true,
    "resource_uri": "file:///path/to/storage/AbCdEfGhIjKl-Sheet1.csv"
  }
}
```

**Example Response (with S3 storage):**
```json
{
  "csv_content": "header1,header2\nvalue1,value2\n...",
  "metadata": {
    "total_rows": 1000,
    "total_size": 52840,
    "is_truncated": true,
    "resource_uri": "s3://my-bucket/quip-data/AbCdEfGhIjKl-Sheet1.csv"
  }
}
```

**Example Response (with S3 storage and --use-presigned-urls):**
```json
{
  "csv_content": "header1,header2\nvalue1,value2\n...",
  "metadata": {
    "total_rows": 1000,
    "total_size": 52840,
    "is_truncated": true,
    "resource_uri": "https://my-bucket.s3.us-east-1.amazonaws.com/quip-data/AbCdEfGhIjKl-Sheet1.csv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=..."
  }
}
```

**Error Handling:**
- If the thread is not a spreadsheet, an error will be returned.
- If the specified sheet is not found, an error will be returned.

### Resource URIs

The server provides resource URIs for accessing complete spreadsheet content. These URIs can be used with the MCP resource access mechanism.

The server supports multiple URI formats depending on the configuration:

#### Default Protocol (quip://)

**URI Format:**
```
quip://{threadId}?sheet={sheetName}
```

**Example:**
```
quip://AbCdEfGhIjKl?sheet=Sheet1
```

#### File Protocol (with --file-protocol option)

**URI Format:**
```
file://{storage_path}/{threadId}-{sheetName}.csv
```

**Example:**
```
file:///home/user/.quip-mcp-server/storage/AbCdEfGhIjKl-Sheet1.csv
```

#### S3 Protocol (when using S3 storage)

**URI Format:**
```
s3://{bucket}/{prefix}/{threadId}-{sheetName}.csv
```

**Example:**
```
s3://my-bucket/quip-data/AbCdEfGhIjKl-Sheet1.csv
```

#### Presigned S3 URLs (when using S3 storage with USE_PRESIGNED_URLS=true)

**URI Format:**
```
s3+https://{bucket}/{prefix}/{threadId}-{sheetName}.csv
```

Which resolves to an HTTPS URL:
```
https://{bucket}.s3.{region}.amazonaws.com/{prefix}/{threadId}-{sheetName}.csv?{authentication_params}
```

**Example:**
```
https://my-bucket.s3.us-east-1.amazonaws.com/quip-data/AbCdEfGhIjKl-Sheet1.csv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...
```

When accessed, the resource returns the complete CSV content of the spreadsheet, regardless of size.

## How It Works

The server uses two methods to extract spreadsheet data:

1. **Primary Method**: Exports the spreadsheet to XLSX format using the Quip API, then converts it to CSV.
2. **Fallback Method**: If the primary method fails, it parses the HTML content of the document to extract the table data.

For large spreadsheets, the server:
1. Saves the complete CSV content to local storage
2. Returns a truncated version (up to 10KB) with metadata
3. Provides a resource URI for accessing the complete content

### Error Handling

The server implements a comprehensive error handling system with specific error types:
- `QuipMCPError`: Base error class for all server errors
- `InvalidParamsError`: For invalid request parameters
- `MethodNotFoundError`: For unknown methods or tools
- `ParseError`: For JSON parsing errors
- `AuthenticationError`: For authentication failures
- `ResourceNotFoundError`: For resource not found errors
- `QuipApiError`: For Quip API errors
- `StorageError`: For storage-related errors
- `TimeoutError`: For request timeout errors

Each error type has a specific error code and can include additional data for debugging. This consistent error handling ensures that clients receive clear and actionable error messages, making it easier to diagnose and fix issues.

### Mock Mode

The server includes a mock mode that doesn't require a real Quip API token. This is useful for testing and development. In mock mode, the server uses pre-defined sample data instead of making actual API calls to Quip.

To enable mock mode, use the `--mock` command line argument or set the `QUIP_MOCK` environment variable to `true`.

Mock mode provides several sample spreadsheets with different structures and sizes, allowing you to test your application's handling of various data formats without needing access to real Quip documents. This is particularly useful for development environments or CI/CD pipelines where you may not want to use real API credentials.

### Structured Logging

The server implements structured logging with different log levels:
- `DEBUG`: Detailed debugging information
- `INFO`: General information about server operation
- `WARN`: Warning messages
- `ERROR`: Error messages

Logs can be output as plain text or JSON format. To enable JSON logging, use the `--json` command line argument or set the `JSON_LOGS` environment variable to `true`.

The structured logging system provides consistent log formatting and includes contextual information with each log entry, making it easier to filter and analyze logs. When JSON logging is enabled, logs can be easily parsed by log management systems for advanced monitoring and alerting.

### Authentication

The server supports API key authentication for securing the HTTP server. When enabled, clients must include the API key in the request headers.

To enable authentication, use the `--auth` command line argument or set the `MCP_AUTH_ENABLED` environment variable to `true`. You can specify the API key using the `--api-key` argument or `MCP_API_KEY` environment variable. If not provided, a random API key will be generated and displayed in the logs.

The API key header name can be customized using the `--api-key-header` argument or `MCP_API_KEY_HEADER` environment variable. By default, the header name is `X-API-Key`.

Authentication is only applied to the HTTP transport mode and does not affect stdio transport, which is typically used in more controlled environments.

### Caching

The server implements a caching mechanism for frequently accessed resources. This improves performance by reducing the number of disk reads and API calls.

Two types of caches are used:
- `csvCache`: For caching CSV content (10 minutes TTL)
- `metadataCache`: For caching metadata (30 minutes TTL)

The caching system automatically handles cache invalidation based on TTL (Time To Live) values and implements a simple LRU (Least Recently Used) strategy to prevent memory issues when dealing with many resources. This ensures optimal performance while maintaining reasonable memory usage.

### Storage Options

The server supports two storage options:

#### Local Storage

By default, the server uses local file system storage to store CSV files. This is suitable for most use cases and provides good performance.

To configure local storage:
```bash
# Using environment variables
STORAGE_TYPE=local QUIP_STORAGE_PATH=/path/to/storage npm start

# Using command line arguments
npm start -- --storage-type local --storage-path /path/to/storage
```

#### S3 Storage

For production deployments or when you need to share data across multiple instances, you can use Amazon S3 storage. This allows you to store CSV files in an S3 bucket.

To configure S3 storage:
```bash
# Using environment variables
STORAGE_TYPE=s3 S3_BUCKET=your-bucket-name S3_REGION=us-east-1 npm start

# Using command line arguments
npm start -- --storage-type s3 --s3-bucket your-bucket-name --s3-region us-east-1
```

Additional S3 configuration options:
- `S3_PREFIX` / `--s3-prefix`: Prefix for S3 object keys (e.g., "quip-data/")
- `S3_URL_EXPIRATION` / `--s3-url-expiration`: URL expiration in seconds (default: 3600)
- `USE_PRESIGNED_URLS`: Set to "true" to generate presigned HTTPS URLs for direct access to S3 resources

**Presigned S3 URLs**:
When `USE_PRESIGNED_URLS` is set to "true", the server will generate presigned HTTPS URLs for resource URIs instead of s3:// URIs. This allows direct access to the resources without requiring AWS credentials or special S3 client libraries. Presigned URLs are temporary and expire after the time specified by `S3_URL_EXPIRATION` (default: 3600 seconds).

**AWS Authentication**:
The S3 storage implementation uses the AWS SDK, which automatically loads credentials from the environment. You can provide AWS credentials using any of the standard methods:
- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- Shared credentials file (`~/.aws/credentials`)
- IAM roles for Amazon EC2 or ECS tasks

For more information on AWS authentication, see the [AWS SDK documentation](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html).

## Health Check Endpoint

The server provides a health check endpoint at `/health` that can be used to monitor the server's status. This endpoint is available when running in HTTP transport mode.

To access the health check endpoint, send a GET request to `/health`:

```bash
curl http://localhost:3000/health
```

The endpoint returns a simple JSON response with status "ok" when the server is running properly:

```json
{
  "status": "ok"
}
```

This endpoint can be used by monitoring tools or container orchestration systems to check if the server is healthy and ready to handle requests.

## Cloud Deployment

### AWS Lambda + API Gateway

The Quip MCP server can be deployed as a serverless application using AWS Lambda with API Gateway. This provides a scalable, low-maintenance deployment option with a streamable HTTP interface.

The project includes an AWS CDK infrastructure setup that automates the deployment of:
- Lambda function with the Quip MCP server
- API Gateway endpoint
- S3 bucket for storing CSV files
- Secrets Manager for storing sensitive information

For detailed deployment instructions, architecture overview, and usage information, see the [AWS Lambda Deployment Guide](infrastructure/api-gateway-lambda/README.md) in the infrastructure directory.

To connect Claude.app to your deployed MCP server, add the following to your Claude settings (after deployment):

```json
"mcpServers": {
  "quip-remote": {
    "endpointUrl": "https://your-api-gateway-url/mcp",
    "headers": {
      "X-API-Key": "YOUR_API_KEY_VALUE"
    }
  }
}
```

### AWS Agent Core Runtime

The Quip MCP server can also be deployed to AWS Agent Core Runtime, which provides enhanced capabilities for AI agents and MCP servers:

**Key Benefits:**
- **Extended execution time**: Up to 8 hours (vs 15-minute Lambda limit)
- **Larger payload support**: 100MB payloads (vs 6MB Lambda limit)
- **Session isolation**: Dedicated microVMs for each user session
- **Built-in authentication**: Integrated OAuth and identity management
- **Enhanced observability**: Specialized tracing for agent operations
- **Consumption-based pricing**: Pay only for actual runtime usage

The project includes a complete CDK infrastructure setup for Agent Core Runtime deployment:

- ARM64 container deployment with Docker buildx
- ECR repository with automated image builds
- IAM roles with AWS-documented permissions for Agent Core Runtime
- AwsCustomResource for Agent Core Runtime API calls
- S3 integration for data storage
- Secrets Manager integration for credentials

**Complete IAM Permission Set:**
The deployment automatically creates an execution role with all required permissions per AWS documentation:
- ECR image access and authentication
- CloudWatch Logs for runtime logging
- X-Ray distributed tracing
- CloudWatch metrics publishing
- Agent Core Runtime workload identity
- Bedrock model invocation capabilities

For detailed deployment instructions, see the [Agent Core Runtime Deployment Guide](infrastructure/agent-core/README.md).

Quick deployment:
```bash
cd infrastructure/agent-core
./deploy.sh --agent-name my-quip-mcp --region us-west-2
```

## Development

### Project Structure

```
quip-mcp-server-typescript/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── server.ts                # MCP server implementation
│   ├── cli.ts                   # Command-line argument handling
│   ├── quipClient.ts            # Quip API client
│   ├── mockClient.ts            # Mock Quip client for testing
│   ├── tools.ts                 # Tool definitions and handlers
│   ├── storage.ts               # Storage abstraction and implementations
│   ├── types.ts                 # TypeScript type definitions
│   ├── version.ts               # Version information
│   ├── errors.ts                # Error handling
│   ├── logger.ts                # Structured logging
│   ├── auth.ts                  # Authentication
│   └── cache.ts                 # Caching mechanism
├── tests/
│   ├── unit/                    # Unit tests
│   │   ├── server.test.ts
│   │   ├── quipClient.test.ts
│   │   ├── tools.test.ts
│   │   ├── storage.test.ts
│   │   └── ...
│   └── e2e/                     # End-to-end tests
├── infrastructure/              # AWS deployment resources
│   ├── api-gateway-lambda/      # CDK project for Lambda + API Gateway deployment
│   │   ├── bin/
│   │   │   └── app.ts           # CDK app entry point
│   │   ├── lib/
│   │   │   └── quip-mcp-server-stack.ts  # Main CDK stack
│   │   ├── lambda/              # Lambda function code
│   │   │   ├── run.js           # Lambda handler
│   │   │   └── package.json
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md            # Lambda + API Gateway deployment guide
│   └── README.md                # Overview of deployment options
├── example-client/              # Example MCP client implementation
│   ├── src/
│   │   ├── client-common.ts
│   │   ├── http-client.ts
│   │   ├── stdio-client.ts
│   │   └── index.ts
│   ├── package.json
│   └── README.md
├── dist/                        # Compiled JavaScript output
├── .env.example                 # Example environment variables
├── .gitignore                   # Git ignore file
├── jest.config.js               # Jest configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # npm package configuration
└── LICENSE                      # License file
```

### Setting Up a Development Environment

```bash
# Clone the repository
git clone https://github.com/zxkane/quip-mcp-server-typescript.git
cd quip-mcp-server-typescript

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Scripts

- `npm run build`: Build the project
- `npm start`: Run the server
- `npm run dev`: Run the server in development mode
- `npm test`: Run tests
- `npm run test:watch`: Run tests in watch mode
- `npm run test:coverage`: Run tests with coverage
- `npm run test:e2e`: Run end-to-end tests
- `npm run lint`: Lint the code
- `npm run format`: Format the code

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run end-to-end tests
npm run test:e2e
```

### Debugging

You can use the MCP inspector to debug the server:

```bash
# Install the MCP inspector
npm install -g @modelcontextprotocol/inspector

# Debug the server
mcp-inspector node dist/index.js
```

### Adding New Tools

To add new tools:

1. Define the tool in `src/tools.ts` by adding it to the `getQuipTools()` function:

```typescript
export function getQuipTools(): Tool[] {
  return [
    {
      name: "quip_read_spreadsheet",
      description: "Read the content of a Quip spreadsheet...",
      inputSchema: {
        // Schema definition
      }
    },
    {
      name: "your_new_tool",
      description: "Description of your new tool",
      inputSchema: {
        // Schema definition for your tool
      }
    }
  ];
}
```

2. Implement the handler function for the tool:

```typescript
export async function handleYourNewTool(
  args: Record<string, any>,
  storage: StorageInterface
): Promise<(TextContent | ImageContent | EmbeddedResource)[]> {
  // Implement your tool logic here
  return [{ type: "text", text: "Your tool response" }];
}
```

3. Register the handler in `src/server.ts` by adding it to the `call_tool` handler:

```typescript
server.call_tool(async (name: string, arguments_: any) => {
  logger.info(`Handling tool call: ${name}`);
  logger.debug(`Tool arguments: ${JSON.stringify(arguments_)}`);
  
  if (!arguments_ || typeof arguments_ !== 'object') {
    logger.error("Invalid arguments: not an object");
    throw new InvalidParamsError("Invalid arguments");
  }
  
  try {
    if (name === "quip_read_spreadsheet") {
      if (!storageInstance) {
        throw new StorageError("Storage not initialized");
      }
      return await handleQuipReadSpreadsheet(arguments_, storageInstance, options.mock);
    } else if (name === "your_new_tool") {
      return await handleYourNewTool(arguments_, storageInstance);
    } else {
      logger.error(`Unknown tool: ${name}`);
      throw new MethodNotFoundError(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof QuipMCPError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Tool call failed: ${errorMessage}`);
    throw new QuipApiError(`Tool call failed: ${errorMessage}`);
  }
});
```

## Contributing

Contributions are welcome! Here's how you can contribute to the project:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Run tests to ensure everything works (`npm test`)
5. Commit your changes (`git commit -m 'Add some feature'`)
6. Push to the branch (`git push origin feature/your-feature-name`)
7. Open a Pull Request

Please make sure your code follows the project's coding standards and includes appropriate tests.

## License

[MIT License](LICENSE)
