# Technical Context: Quip MCP Server

## Technologies Used

### Core Technologies
- **TypeScript**: Primary programming language for strong typing and improved maintainability
- **Node.js**: Runtime environment for server execution
- **MCP Protocol**: Implementation of the Model Context Protocol for AI integration

### Key Libraries and Frameworks
- **@modelcontextprotocol/sdk**: Core SDK for implementing MCP servers and clients
- **axios**: HTTP client for making requests to the Quip API
- **cheerio**: HTML parsing library used for the fallback spreadsheet extraction method
- **commander**: Command-line interface parser for handling CLI arguments
- **dotenv**: Environment variable management
- **fs-extra**: Extended file system methods beyond Node's native fs module
- **winston**: Structured logging framework
- **xlsx**: Excel file processing library for converting XLSX to CSV

### Development Tools
- **Jest**: Testing framework for unit and integration tests
- **ESLint**: Code quality and style enforcement
- **Prettier**: Code formatting
- **TypeScript**: Type checking and compilation
- **ts-node**: Running TypeScript code without pre-compilation during development

## Development Setup

### Installation and Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/quip-mcp-server-typescript.git
cd quip-mcp-server-typescript

# Install dependencies
npm install

# Build the project
npm run build
```

### Environment Configuration
The server requires a `.env` file or environment variables for configuration:

```
# Required (unless in mock mode)
QUIP_TOKEN=your_quip_api_token_here

# Optional
QUIP_BASE_URL=https://platform.quip.com
QUIP_STORAGE_PATH=/path/to/storage
MCP_PORT=3000
QUIP_DEBUG=true
QUIP_MOCK=true
JSON_LOGS=true
MCP_AUTH_ENABLED=true
MCP_API_KEY=your_api_key_here
MCP_API_KEY_HEADER=X-API-Key
```

### Running the Server
```bash
# Using npm (stdio transport)
npm start

# With HTTP transport
PORT=3000 npm start

# With command-line arguments
npm start -- --storage-path /path/to/storage --file-protocol --debug
```

### Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Technical Constraints

### Quip API Limitations
- **API Rate Limits**: Quip imposes rate limits that must be respected
- **Authentication**: Requires a valid API token with appropriate permissions
- **Large Documents**: API calls may timeout for very large spreadsheets
- **Export Formats**: Limited options for exporting data

### Resource Constraints
- **Memory Usage**: Large spreadsheets must be handled efficiently to avoid excessive memory consumption
- **Storage Space**: Local storage of CSV files requires adequate disk space
- **Processing Time**: XLSX to CSV conversion can be CPU-intensive for large files

### Transport Limitations
- **stdio Transport**: Limited control over process lifecycle when used as a subprocess
- **HTTP Transport**: Requires additional security considerations when exposed over network

### Error Handling Requirements
- Must gracefully handle network errors when communicating with Quip API
- Must provide clear error messages for configuration issues
- Must handle malformed input and unexpected document formats

## Dependencies Management

### Direct Dependencies
- **@modelcontextprotocol/sdk**: ^1.10.2 - Core MCP implementation
- **axios**: ^1.8.4 - HTTP client for API requests
- **cheerio**: ^1.0.0 - HTML parsing for fallback method
- **commander**: ^11.1.0 - Command-line argument parsing
- **dotenv**: ^16.5.0 - Environment variable management
- **fs-extra**: ^11.3.0 - Enhanced file system operations
- **winston**: ^3.17.0 - Logging framework
- **xlsx**: Custom version from CDN - Excel processing

### Dev Dependencies
- **@types** packages: Type definitions for TypeScript
- **jest**: ^29.6.4 - Testing framework
- **prettier**: ^3.0.3 - Code formatting
- **eslint**: ^8.48.0 - Code linting
- **ts-jest**: ^29.1.1 - TypeScript support for Jest
- **typescript**: ^5.2.2 - TypeScript language support

### Versioning Strategy
- The project follows semantic versioning
- Node.js version >= 18.0.0 is required
- Dependencies are pinned to specific versions for stability

## Deployment Considerations

### Environmental Requirements
- Node.js runtime (v18 or higher)
- Adequate disk space for CSV storage
- Network access to Quip API servers
- Proper file permissions for storage directory

### Security Considerations
- Quip API token must be securely stored
- HTTP transport should use API key authentication when exposed
- File permissions should restrict access to stored CSV files
- Environment variables should be properly secured

### Monitoring
- Winston logs provide insight into server operations
- Health check endpoint available for monitoring server status
- Debug mode can be enabled for more detailed logging

### Performance Tuning
- Caching reduces redundant API calls and file system operations
- Timeouts can be adjusted for large spreadsheet operations
- Storage path can be configured for optimized I/O performance
