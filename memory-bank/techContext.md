# Technical Context: Quip MCP Server

## Technologies Used

### Core Technologies
- **TypeScript**: Primary programming language for strong typing and improved maintainability
- **Node.js**: Runtime environment for server execution
- **MCP Protocol**: Implementation of the Model Context Protocol for AI integration
- **AWS SDK**: For S3 storage integration

### Key Libraries and Frameworks
- **@modelcontextprotocol/sdk**: Core SDK for implementing MCP servers and clients
- **axios**: HTTP client for making requests to the Quip API
- **cheerio**: HTML parsing library used for the fallback spreadsheet extraction method
- **commander**: Command-line interface parser for handling CLI arguments
- **dotenv**: Environment variable management
- **fs-extra**: Extended file system methods beyond Node's native fs module
- **winston**: Structured logging framework
- **xlsx**: Excel file processing library for converting XLSX to CSV
- **express**: Web framework for HTTP transport implementation
- **@aws-sdk/client-s3**: AWS SDK for S3 operations
- **@aws-sdk/s3-request-presigner**: For generating presigned URLs for S3 resources

### Development Tools
- **Jest**: Testing framework for unit and integration tests
- **ESLint**: Code quality and style enforcement
- **Prettier**: Code formatting
- **TypeScript**: Type checking and compilation
- **ts-node**: Running TypeScript code without pre-compilation during development
- **ts-jest**: TypeScript integration for Jest testing framework

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

# S3 Storage Configuration (when using S3)
STORAGE_TYPE=s3
S3_BUCKET=your-bucket-name
S3_REGION=your-aws-region
S3_PREFIX=optional/path/prefix/
S3_URL_EXPIRATION=3600
USE_PRESIGNED_URLS=true
```

### Running the Server
```bash
# Using npm (stdio transport)
npm start

# With HTTP transport
PORT=3000 npm start

# With command-line arguments
npm start -- --storage-path /path/to/storage --file-protocol --debug

# With S3 storage
npm start -- --storage-type s3 --s3-bucket your-bucket-name --s3-region your-region
```

### Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run in mock mode (no Quip credentials needed)
npm start -- --mock
```

## Technical Constraints

### Quip API Limitations
- **API Rate Limits**: Quip imposes rate limits that must be respected
- **Authentication**: Requires a valid API token with appropriate permissions
- **Large Documents**: API calls may timeout for very large spreadsheets
- **Export Formats**: Limited options for exporting data (XLSX or HTML)
- **Spreadsheet Format Detection**: Complex Quip documents may not be correctly identified

### Resource Constraints
- **Memory Usage**: Large spreadsheets must be handled efficiently to avoid excessive memory consumption
- **Storage Space**: Local storage of CSV files requires adequate disk space
- **Processing Time**: XLSX to CSV conversion can be CPU-intensive for large files
- **S3 Storage Costs**: When using S3 storage, standard AWS S3 costs apply
- **Presigned URL Generation**: S3 presigned URLs have expiration times that need management

### Transport Limitations
- **stdio Transport**: Limited control over process lifecycle when used as a subprocess
- **HTTP Transport**: Requires additional security considerations when exposed over network
- **StreamableHTTPServerTransport**: Operates in stateless mode for HTTP transport

### Error Handling Requirements
- Must gracefully handle network errors when communicating with Quip API
- Must provide clear error messages for configuration issues
- Must handle malformed input and unexpected document formats
- Should implement fallback mechanisms when primary methods fail

## Storage Architecture

### Local Storage
- **Storage Path**: File system directory for storing CSV files
- **File Naming**: `{threadId}-{sheetName}.csv` format for spreadsheet data
- **Metadata**: Separate `.meta` files with JSON metadata
- **File Protocol**: Optional `file://` protocol for direct file system access
- **Resource URI**: `quip://{threadId}?sheet={sheetName}` or `file://{path}`

### S3 Storage
- **Bucket Organization**: Optional prefix for organizing CSV files in S3
- **Object Keys**: `{prefix}{threadId}-{sheetName}.csv` format for spreadsheet data
- **Metadata Objects**: Separate `.meta` objects with JSON metadata
- **Resource URI**: `s3://{bucket}/{key}` or HTTPS presigned URLs
- **Security**: AWS credentials required for S3 access
- **Presigned URLs**: Optional generation of time-limited HTTPS access URLs

### Caching Architecture
- **Content Cache**: In-memory LRU cache for CSV content (10 minute TTL)
- **Metadata Cache**: In-memory LRU cache for metadata (30 minute TTL)
- **Cache Keys**: `{threadId}` or `{threadId}:{sheetName}` format
- **Cache Invalidation**: On content updates or TTL expiration

## Dependencies Management

### Direct Dependencies
- **@modelcontextprotocol/sdk**: ^1.10.2 - Core MCP implementation
- **@aws-sdk/client-s3**: ^3.420.0 - S3 client implementation
- **@aws-sdk/s3-request-presigner**: ^3.420.0 - S3 presigned URL generation
- **axios**: ^1.8.4 - HTTP client for API requests
- **cheerio**: ^1.0.0 - HTML parsing for fallback method
- **commander**: ^11.1.0 - Command-line argument parsing
- **dotenv**: ^16.5.0 - Environment variable management
- **express**: ^4.19.1 - Web framework for HTTP transport
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
- **supertest**: ^6.3.3 - HTTP testing library

### Versioning Strategy
- The project follows semantic versioning
- Node.js version >= 18.0.0 is required
- Dependencies are pinned to specific versions for stability
- Major version updates require careful compatibility testing

## Deployment Considerations

### Local Deployment
- Node.js runtime (v18 or higher)
- Adequate disk space for CSV storage
- Network access to Quip API servers
- Proper file permissions for storage directory
- Environment variables or .env file for configuration

### Cloud Deployment
#### S3-based Setup
- AWS credentials with S3 access
- S3 bucket with appropriate permissions
- IAM role configuration for server
- Configuration for presigned URLs if needed
- VPC endpoints for secure S3 access (recommended)

#### Container Deployment
- Docker containerization supported
- Volume mounting for local storage
- Environment variable injection for configuration
- Container orchestration (Kubernetes, ECS, etc.)
- Resource allocation based on expected load

### Security Considerations
- Quip API token must be securely stored
- HTTP transport should use API key authentication when exposed
- File permissions should restrict access to stored CSV files
- S3 bucket policies should enforce appropriate access control
- Environment variables should be properly secured
- HTTPS should be used for all external communication

### Monitoring and Observability
- Winston logs provide insight into server operations
- Health check endpoint available for monitoring server status
- Debug mode can be enabled for more detailed logging
- Log formatting options (JSON or text) for integration with log aggregation
- Error tracking and alerting integration points

### Performance Tuning
- Caching reduces redundant API calls and file system operations
- Timeouts can be adjusted for large spreadsheet operations
- Storage path can be configured for optimized I/O performance
- S3 region selection impacts latency and performance
- Presigned URL expiration can be tuned based on access patterns
- Memory allocation should be sized appropriately for expected spreadsheet sizes

## Environment-Specific Considerations

### Development Environment
- Mock mode for testing without Quip credentials
- Debug logging enabled for detailed information
- Local file storage for simplicity
- HTTP transport for easier debugging
- Watch mode for quick iteration

### Testing Environment
- Automated tests using Jest
- Mock mode for consistent test results
- Memory-based storage for speed
- CI/CD pipeline integration
- Coverage reporting

### Production Environment
- Secured API token management
- Optimized logging configuration (JSON format)
- S3 storage recommended for scalability
- HTTP transport with proper authentication
- Error monitoring and alerting
- Resource URI configuration based on client capabilities
