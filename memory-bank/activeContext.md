# Active Context: Quip MCP Server

## Current Development Focus

The Quip MCP Server is currently focused on providing reliable and efficient access to Quip spreadsheet data for AI assistants through the Model Context Protocol (MCP). The core functionality of retrieving, processing, and serving spreadsheet data is operational, with particular attention being given to:

1. **Robust Data Extraction**: The server implements both primary and fallback methods for extracting data from Quip spreadsheets
2. **Efficient Storage and Caching**: Local storage combined with in-memory caching optimizes performance
3. **Flexible Deployment Options**: Support for both stdio and HTTP transport mechanisms
4. **Error Handling and Reliability**: Comprehensive error handling to ensure graceful failure modes

## Recent Developments

### Core Functionality
- Implementation of the `quip_read_spreadsheet` tool for retrieving spreadsheet data
- Support for specific sheet selection by name
- Resource URI generation for accessing complete spreadsheet content
- Truncation handling for large spreadsheets

### Infrastructure
- Caching mechanism with TTL (Time To Live) for improved performance
- Metadata storage alongside CSV content
- Mock mode for testing without a real Quip API token
- Health check endpoint for monitoring server status

### API and Integration
- Support for both stdio and HTTP transports
- API key authentication for HTTP transport
- Structured logging with different log levels
- Example client implementation for demonstration and testing

## Active Decisions and Considerations

### Primary vs. Fallback Data Extraction
The server attempts to use the XLSX export method first due to its reliability and efficiency, but falls back to HTML parsing if that fails. This dual approach ensures maximum compatibility with different Quip document configurations.

```typescript
try {
  // Export thread to XLSX first
  await client.exportThreadToXLSX(threadId, xlsxPath);
  csvData = convertXLSXToCSV(xlsxPath, sheetName);
} catch (error) {
  // Try fallback method
  csvData = await client.exportThreadToCSVFallback(threadId, sheetName);
}
```

### Resource URI Design
The server supports two URI schemes:
1. `quip://` scheme for internal MCP resource references
2. `file://` scheme for direct file system access

This design decision balances flexibility with security:

```typescript
getResourceURI(threadId: string, sheetName?: string): string {
  if (this.isFileProtocol) {
    return `file://${this.getFilePath(threadId, sheetName)}`;
  }
  if (sheetName) {
    return `quip://${threadId}?sheet=${encodeURIComponent(sheetName)}`;
  }
  return `quip://${threadId}`;
}
```

### Large Spreadsheet Handling
The server addresses the challenge of large spreadsheets by:
1. Truncating content in the initial response to prevent memory issues
2. Providing resource URIs for accessing complete content
3. Including metadata about truncation in the response

```typescript
// Truncate CSV content if it's too large (> 10KB)
const MAX_SIZE = 10 * 1024; // 10KB
const [truncatedCsv, isTruncated] = truncateCSVContent(csvData, MAX_SIZE);

// Update metadata with truncation info
metadata.is_truncated = isTruncated;
```

### Authentication Strategy
The server uses a hybrid authentication approach:
- Quip API token for server-to-Quip authentication
- Optional API key for client-to-server authentication when using HTTP transport
- No authentication required for stdio transport (assumed to be used in a controlled environment)

## Next Steps

### Short-Term Priorities
1. **Additional Tool Implementation**
   - Add a tool for listing available spreadsheets in a user's Quip account
   - Implement write capability for updating spreadsheet data

2. **Performance Optimization**
   - Explore streaming approaches for very large spreadsheets
   - Implement background processing for data extraction

3. **Enhanced Error Recovery**
   - Add automatic retry logic for transient API failures
   - Implement circuit breaking for Quip API calls

### Medium-Term Goals
1. **Advanced Sheet Processing**
   - Support for formulas and calculated values
   - Ability to interpret and handle merged cells
   - Format preservation options

2. **Security Enhancements**
   - Row/column level access control
   - Data masking for sensitive information
   - OAuth integration for token management

3. **Ecosystem Integration**
   - Additional MCP servers for other Quip document types
   - Integration with data processing pipelines
   - WebSocket support for real-time updates

### Long-Term Vision
1. **Comprehensive Quip Suite**
   - Expand to support all Quip document types (documents, slides, etc.)
   - Bidirectional sync between AI systems and Quip

2. **Advanced AI Integration**
   - Specialized data processing for AI consumption
   - Schema detection and automatic type conversion
   - Semantic understanding of spreadsheet structure and purpose
