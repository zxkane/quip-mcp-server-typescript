# Project Brief: Quip MCP Server (TypeScript)

## Project Overview
The Quip MCP Server is a TypeScript implementation of a Model Context Protocol (MCP) server that allows AI assistants to interact with Quip spreadsheets. It provides tools to retrieve, parse, and access spreadsheet data from Quip documents, returning the content in CSV format with appropriate metadata. The server supports flexible deployment options with multiple storage backends and transport mechanisms.

## Core Requirements

### Functional Requirements
- Retrieve spreadsheet content from Quip documents using their API
- Support selection of specific sheets by name within a document
- Return data in CSV format with comprehensive metadata
- Handle authentication via Quip API token
- Provide appropriate error messages for non-spreadsheet documents
- Handle large spreadsheets by truncating content when necessary
- Store spreadsheet content locally or in S3 for efficient access
- Provide resource URIs for accessing complete spreadsheet content
- Support both local filesystem and AWS S3 storage backends
- Enable resource discovery for available spreadsheet data
- Support mock mode for development and testing without credentials

### Technical Requirements
- Implement MCP server standards compliant with the Model Context Protocol
- Support both stdio transport (for subprocess integration) and HTTP transport
- Provide authentication mechanisms for the HTTP transport
- Implement robust error handling with hierarchical error types
- Include a dual caching mechanism for content and metadata
- Support mock mode for testing without a real Quip API token
- Implement structured logging with different log levels and formats
- Support multiple resource URI schemes (quip://, file://, s3://, https://)
- Ensure proper CSV structure preservation during truncation
- Implement both primary (XLSX) and fallback (HTML) extraction methods
- Generate presigned URLs for S3-stored resources when appropriate

## Success Criteria
- AI assistants can seamlessly access and use Quip spreadsheet data
- The server reliably handles various spreadsheet formats and sizes
- Performance is optimized through caching and efficient storage
- The server works well in both local and cloud environments
- The system handles errors gracefully with clear feedback
- CSV data maintains proper structure even when truncated
- Large spreadsheets are handled efficiently without memory issues
- Developers can easily configure and deploy the server
- Mock mode enables effective development without Quip credentials
- Users have flexibility in choosing storage and transport options

## Constraints
- Must work within the Quip API's limitations and rate limits
- Must handle potential timeout issues with large spreadsheets
- Must be compatible with the MCP standard for interoperability
- Resource URIs must follow appropriate schemes based on storage
- Mock mode must provide representative data for testing
- S3 storage requires appropriate AWS credentials and configuration
- HTTP transport must implement appropriate authentication
- Must handle special characters in sheet names appropriately
- Must respect the limited memory environment when processing large datasets
