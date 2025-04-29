# Quip MCP Server - Project Intelligence

This document captures key insights, patterns, and project intelligence for the Quip MCP Server that aren't immediately obvious from the code. As I work with this project, I'll continue to document important learnings here.

## Implementation Patterns

### Transport Mechanism Selection
- The server automatically selects between stdio and HTTP transport based on environment
- Prefer stdio for integration with AI assistants (e.g., Claude.app)
- Use HTTP when exposing as a standalone service or for development
- The PORT environment variable is the primary trigger for HTTP mode

### Error Handling Strategy
- All errors inherit from the base QuipMCPError class
- Specific error types (InvalidParamsError, ResourceNotFoundError, etc.) are used for different scenarios
- Error messages include actionable information for troubleshooting
- Errors are logged with contextual information before being thrown

### Data Flow Pattern
- Spreadsheet data always follows this path:
  1. Retrieve from Quip API
  2. Convert to CSV format
  3. Store locally with metadata
  4. Return truncated version with resource URI
  5. Make full version available via resource access

### Cache Invalidation
- Two separate caches with different TTLs:
  - CSV content: 10 minute TTL
  - Metadata: 30 minute TTL
- Cache keys follow the pattern: `{threadId}` or `{threadId}:{sheetName}`

## Code Organization

### File Structure Conventions
- `src/`: Core implementation files
- `tests/`: Test files mirroring the structure of src/
- `example-client/`: Example client implementation
- Support files at the root level

### Naming Conventions
- Interfaces end with "Interface" (e.g., StorageInterface)
- Error classes end with "Error" (e.g., QuipApiError)
- File names reflect their primary export/purpose

### Module Dependencies
- Logger is imported first to ensure logging is available
- Environment variables are loaded at the earliest possible point
- Storage is initialized before server startup

## Project Workflows

### Development Workflow
1. Make changes to TypeScript files
2. Run `npm run build` to compile
3. Test with example client or directly
4. Use `npm test` for unit tests

### Deployment Workflow
1. Configure environment variables or .env file
2. Build the project with `npm run build`
3. Run with appropriate command-line arguments
4. Set up as a service if running as HTTP server

### Integration Workflow
1. Install package in target environment
2. Configure with API token and other settings
3. Connect via stdio or HTTP transport
4. Implement MCP client to access tools and resources

## Known Workarounds

### Large Spreadsheet Handling
- The API may time out for very large exports
- The fallback method uses HTML parsing which is more reliable for large sheets
- For extremely large sheets, consider using resource access to get complete data in chunks

### Sheet Name Handling
- Sheet names with special characters are sanitized for file paths
- Unicode characters in sheet names may need special handling
- Case-insensitive matching is used for sheet name lookup

### XLSX Parsing Edge Cases
- The sheet range in XLSX files sometimes reports incorrectly
- Manual cell key scanning is used to determine the true range
- This fixes issues with truncated ranges in the XLSX file

## User Preferences

### Command Line Arguments
- `--storage-path`: Users often have specific storage requirements
- `--file-protocol`: Preference depends on deployment environment
- `--debug`: Commonly used during development and troubleshooting
- `--mock`: Essential for testing without Quip credentials

### Configuration Options
- Storage path is typically customized for production environments
- Debug mode usually disabled in production
- API authentication preferred when exposed over HTTP
- File protocol often preferred for direct file system access

## Performance Considerations

### Memory Optimization
- CSV content is truncated to 10KB in the tool response
- Complete CSV is stored on disk and accessible via resource URI
- Caching reduces disk I/O for frequently accessed content
- Buffer usage for binary XLSX data needs careful handling

### API Efficiency
- Limit concurrent requests to the Quip API
- Use caching to reduce redundant API calls
- Implement appropriate timeouts for API operations
- Export to XLSX is more efficient than HTML parsing for most cases

## Security Practices

### Credential Handling
- Quip API token passed via environment variable
- Never log or expose the token in responses
- API keys for HTTP transport should be secured
- No credentials stored in the code repository

### Transport Security
- HTTP transport should be used with TLS in production
- API key authentication required for HTTP transport
- stdio transport assumed to be in a controlled environment
- Consider additional security for sensitive spreadsheet data

## Testing Approaches

### Mock Mode
- Use `--mock` flag to test without real Quip credentials
- Mock data is predetermined and consistent
- Mock responses simulate various spreadsheet structures
- Useful for CI/CD environments where real credentials aren't available
