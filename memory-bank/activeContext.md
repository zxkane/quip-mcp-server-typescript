# Active Context: Quip MCP Server

## Current Development Focus

The Quip MCP Server is currently focused on providing reliable and efficient access to Quip spreadsheet data for AI assistants through the Model Context Protocol (MCP). The core functionality of retrieving, processing, and serving spreadsheet data is operational, with particular attention being given to:

1. **Robust Data Extraction**: The server implements both primary (XLSX export) and fallback (HTML parsing) methods for extracting data from Quip spreadsheets
2. **Flexible Storage Options**: Support for both local filesystem and S3 storage with appropriate URI handling
3. **Efficient Storage and Caching**: Local/S3 storage combined with in-memory caching optimizes performance
4. **Dual Transport Mechanisms**: Support for both stdio and HTTP transport for different integration scenarios
5. **Error Handling and Reliability**: Comprehensive error handling to ensure graceful failure modes

## Recent Developments

### Core Functionality
- Implementation of the `quip_read_spreadsheet` tool for retrieving spreadsheet data
- Support for specific sheet selection by name
- Resource URI generation for accessing complete spreadsheet content
- Truncation handling for large spreadsheets with proper CSV structure preservation

### Infrastructure
- Dual storage implementation with LocalStorage and S3Storage classes
- Caching mechanism with TTL (Time To Live) for improved performance
- Metadata storage alongside CSV content for efficient querying
- Mock mode for testing without a real Quip API token
- Support for presigned URLs when using S3 storage

### API and Integration
- Support for both stdio and HTTP transports with automatic selection
- Resource templates for standardized URI formats
- Structured logging with different log levels and formats
- Comprehensive command-line interface for configuration

## Active Decisions and Considerations

### Primary vs. Fallback Data Extraction
The server attempts to use the XLSX export method first due to its reliability and efficiency, but falls back to HTML parsing if that fails. This dual approach ensures maximum compatibility with different Quip document configurations.

```typescript
try {
  // Export thread to XLSX first
  logger.info(`Attempting primary export method: XLSX for thread ${threadId}`);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quip-mcp-'));
  const xlsxPath = path.join(tempDir, `${threadId}.xlsx`);
  
  await client.exportThreadToXLSX(threadId, xlsxPath);
  
  // Convert XLSX to CSV
  logger.info(`Converting sheet '${sheetName || 'default'}' from XLSX to CSV`);
  csvData = convertXLSXToCSV(xlsxPath, sheetName);
  
  // Clean up temporary XLSX file
  await fs.remove(xlsxPath);
  await fs.remove(tempDir);
} catch (error) {
  errorMessage = error instanceof Error ? error.message : String(error);
  logger.warn(`Primary export method failed: ${errorMessage}`);
  logger.info("Attempting fallback export method");
  
  try {
    // Try fallback method
    csvData = await client.exportThreadToCSVFallback(threadId, sheetName);
    logger.info("Successfully exported using fallback method");
  } catch (fallbackError) {
    const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
    logger.error(`Fallback export method also failed: ${fallbackErrorMsg}`);
    throw new QuipApiError(`Failed to export spreadsheet. Primary error: ${errorMessage}, Fallback error: ${fallbackErrorMsg}`);
  }
}
```

### Flexible Storage Architecture
The system uses a factory pattern to create the appropriate storage implementation based on configuration, supporting both local filesystem and S3 storage with a unified interface:

```typescript
export function createStorage(storageType: string, options: StorageOptions): StorageInterface {
  // Export the storage type to environment for other components to check
  process.env.STORAGE_TYPE = storageType;
  
  logger.info(`Creating storage implementation for type: ${storageType}`);
  
  if (storageType === 'local') {
    return new LocalStorage(options.storagePath, options.isFileProtocol);
  } else if (storageType === 's3') {
    if (!options.s3Bucket) {
      throw new Error('S3 bucket name is required for S3 storage');
    }
    if (!options.s3Region) {
      throw new Error('S3 region is required for S3 storage');
    }
    
    return new S3Storage(
      options.s3Bucket,
      options.s3Region,
      options.s3Prefix || '',
      options.s3UrlExpiration || 3600
    );
  }
  throw new Error(`Unsupported storage type: ${storageType}`);
}
```

### Resource URI Design
The server supports multiple URI schemes:
1. `quip://` scheme for internal MCP resource references
2. `file://` scheme for direct file system access
3. `s3://` scheme for S3 storage references
4. `https://` scheme for presigned S3 URLs

This design decision balances flexibility with security and provides appropriate access methods for different deployment scenarios:

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
2. Ensuring truncation preserves CSV structure by respecting row boundaries
3. Providing resource URIs for accessing complete content
4. Including metadata about truncation in the response

```typescript
export function truncateCSVContent(csvContent: string, maxSize: number = 10 * 1024): [string, boolean] {
  if (csvContent.length <= maxSize) {
    return [csvContent, false]; // No truncation needed
  }
  
  // Parse the CSV properly to handle quoted fields with embedded newlines
  // First, identify the header row
  let headerEndIndex = 0;
  let inQuote = false;
  
  // Find where the header row ends by tracking quotes
  for (let i = 0; i < csvContent.length; i++) {
    if (csvContent[i] === '"') {
      // Toggle quote state (accounting for escaped quotes)
      if (i + 1 < csvContent.length && csvContent[i + 1] === '"') {
        i++; // Skip escaped quote
      } else {
        inQuote = !inQuote;
      }
    } else if (csvContent[i] === '\n' && !inQuote) {
      headerEndIndex = i;
      break;
    }
  }
  
  // Get header row
  const header = csvContent.substring(0, headerEndIndex);
  
  // Now parse the CSV to find complete rows
  let currentPos = headerEndIndex + 1; // Start after header
  const completedRows = [header]; // Start with header
  let rowStartPos = currentPos;
  let currentSize = header.length + 1; // +1 for newline
  inQuote = false;
  
  while (currentPos < csvContent.length) {
    // Intelligent truncation that respects CSV structure
    // (preserves quotes, doesn't break rows mid-way)
    // ...
  }
}
```

### Transport Selection Strategy
The server automatically selects between stdio and HTTP transport based on environment variables and command-line arguments:

```typescript
// Choose transport based on options
if (options.port || process.env.PORT) {
  // Using Streamable HTTP transport with Express
  const port = options.port || parseInt(process.env.PORT || '3000', 10);
  logger.info(`Using HTTP transport on port ${port}`);
  
  // Create Express app
  const app = express();
  // ...
} else {
  // Using stdio transport
  logger.info("Using stdio transport");
  const transport = new StdioServerTransport();
  // ...
}
```

## Next Steps

### Short-Term Priorities
1. **Additional Tool Implementation**
   - Add a tool for listing available spreadsheets in a user's Quip account
   - Implement write capability for updating spreadsheet data
   - Add support for listing sheets within a spreadsheet

2. **Performance Optimization**
   - Optimize the CSV truncation algorithm for very large spreadsheets
   - Implement streaming responses for HTTP transport
   - Further optimize S3 storage interactions

3. **Enhanced Error Recovery**
   - Add automatic retry logic for transient API failures
   - Implement circuit breaking for Quip API calls
   - Add more detailed error diagnostics and recovery suggestions

### Medium-Term Goals
1. **Advanced Sheet Processing**
   - Support for formulas and calculated values
   - Ability to interpret and handle merged cells
   - Format preservation options
   - Support for cell formatting information

2. **Security Enhancements**
   - Row/column level access control
   - Data masking for sensitive information
   - Enhanced HTTP transport authentication options
   - OAuth integration for token management

3. **Ecosystem Integration**
   - Additional MCP servers for other Quip document types
   - Integration with data processing pipelines
   - WebSocket support for real-time updates

### Long-Term Vision
1. **Comprehensive Quip Suite**
   - Expand to support all Quip document types (documents, slides, etc.)
   - Bidirectional sync between AI systems and Quip
   - Collaborative editing features

2. **Advanced AI Integration**
   - Specialized data processing for AI consumption
   - Schema detection and automatic type conversion
   - Semantic understanding of spreadsheet structure and purpose
   - Natural language queries for spreadsheet data
