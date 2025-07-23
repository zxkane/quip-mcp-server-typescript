# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Build and Development
- `npm run build` - Compile TypeScript to JavaScript in dist/
- `npm run dev` - Run server in development mode with ts-node
- `npm start` - Run the compiled server from dist/

### Testing
- `npm test` - Run all unit tests with Jest
- `npm run test:watch` - Run tests in watch mode during development
- `npm run test:coverage` - Generate test coverage reports
- `npm run test:e2e` - Run end-to-end tests

### Code Quality
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier

## Architecture Overview

This is a **Model Context Protocol (MCP) server** for Quip spreadsheets that supports both stdio and HTTP transports.

### Core Components

**Transport Layer** (src/server.ts:541-731):
- Stdio transport for integration with Claude.app and similar tools
- HTTP transport with Express server for standalone operation
- SSE (Server-Sent Events) support for streaming responses

**Storage Abstraction** (src/storage.ts):
- Local filesystem storage (default)
- Amazon S3 storage for production deployments
- Unified interface supporting both storage backends

**Quip Integration** (src/quipClient.ts, src/mockClient.ts):
- Real Quip API client for production
- Mock client for testing/development without API credentials
- Spreadsheet export via XLSX with HTML fallback

**Error Handling** (src/errors.ts):
- Comprehensive error hierarchy (QuipMCPError base class)
- Specific error types: InvalidParamsError, AuthenticationError, etc.
- Consistent error codes and messages

### Key Design Patterns

**Resource Management**:
- Resources use URI schemes: `quip://`, `file://`, `s3://`, `s3+https://`
- Resource templates for dynamic resource discovery
- Caching system for performance (CSV and metadata caches)

**Configuration**:
- Environment variables take precedence
- Command-line arguments override defaults
- Mock mode for development/testing

## AWS Deployment Options

### Lambda + API Gateway
Located in `infrastructure/api-gateway-lambda/`
- Serverless HTTP endpoint
- CDK infrastructure as code
- S3 integration for file storage

### Agent Core Runtime
Located in `infrastructure/agent-core/`
- Extended execution time (8 hours vs 15 min Lambda limit)
- Larger payload support (100MB vs 6MB)
- Built-in authentication and observability

## Development Notes

### Testing Strategy
- Unit tests in `tests/unit/` cover individual components
- Mock client enables testing without Quip API access
- Coverage excludes index.ts and version.ts entry points

### TypeScript Configuration
- Target: ES2020 with NodeNext modules
- Strict mode enabled
- Declaration files generated for npm publishing

### Transport Selection Logic (src/server.ts:534-541)
Server automatically chooses transport:
- HTTP if PORT/MCP_PORT environment variable is set or --port argument provided
- Stdio otherwise (default for Claude.app integration)

### Storage Path Resolution (src/cli.ts)
Storage paths resolved in order:
1. Command line --storage-path argument
2. QUIP_STORAGE_PATH environment variable  
3. Default: ~/.quip-mcp-server/storage

### Common Issues
- Ensure QUIP_TOKEN is set unless using --mock mode
- For S3 storage, AWS credentials must be configured
- Local storage requires write permissions to storage directory