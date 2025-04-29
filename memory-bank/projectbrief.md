# Project Brief: Quip MCP Server (TypeScript)

## Project Overview
The Quip MCP Server is a TypeScript implementation of a Model Context Protocol (MCP) server that allows AI assistants to interact with Quip spreadsheets. It provides tools to retrieve, parse, and access spreadsheet data from Quip documents, returning the content in CSV format with appropriate metadata.

## Core Requirements

### Functional Requirements
- Retrieve spreadsheet content from Quip documents using their API
- Support selection of specific sheets by name within a document
- Return data in CSV format with metadata
- Handle authentication via Quip API token
- Provide appropriate error messages for non-spreadsheet documents
- Handle large spreadsheets by truncating content when necessary
- Store spreadsheet content locally for efficient access
- Provide resource URIs for accessing complete spreadsheet content

### Technical Requirements
- Implement MCP server standards compliant with the Model Context Protocol
- Support both stdio transport (for subprocess integration) and HTTP transport
- Provide authentication mechanisms for the HTTP transport
- Implement robust error handling with appropriate error types
- Include a caching mechanism for improved performance
- Support mock mode for testing without a real Quip API token
- Implement structured logging with different log levels

## Success Criteria
- AI assistants can seamlessly access and use Quip spreadsheet data
- The server reliably handles various spreadsheet formats and sizes
- Performance is optimized through caching and efficient storage
- The server is secure, with proper authentication mechanisms
- Error messages are clear and actionable
- The server is easy to deploy and configure

## Constraints
- Must work within the Quip API's limitations and rate limits
- Must handle potential timeout issues with large spreadsheets
- Must be compatible with the MCP standard for interoperability
