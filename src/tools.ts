/**
 * Tool definitions and handlers for the Quip MCP Server
 */
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { logger } from './logger';
import { InvalidParamsError, QuipApiError } from './errors';
// Define interfaces for MCP types
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface TextContent {
  type: string;
  text: string;
}

export interface ImageContent {
  type: string;
  image: string;
}

export interface EmbeddedResource {
  type: string;
  uri: string;
}

import { QuipClient, convertXLSXToCSV } from './quipClient';
import { MockQuipClient } from './mockClient';
import { StorageInterface } from './types';
import { truncateCSVContent } from './storage';

/**
 * Get the list of Quip tools available in this MCP server
 *
 * @returns List of Tool objects
 */
export function getQuipTools(): Tool[] {
  return [
    {
      name: "quip_read_spreadsheet",
      description: "Read the content of a Quip spreadsheet by its thread ID. Returns a JSON object containing truncated CSV content (limited to 10KB) and metadata. For large spreadsheets, the returned content may be truncated. To access the complete CSV data, use the resource interface with URI format 'quip://spreadsheet/{threadId}/{sheetName}' or 'file:///<storage path>/{threadId}-{sheetName}.csv'. The returned data structure includes: { 'csv_content': string (possibly truncated CSV data), 'metadata': { 'rows': number, 'columns': number, 'is_truncated': boolean, 'resource_uri': string } }",
      inputSchema: {
        type: "object",
        properties: {
          threadId: {
            type: "string",
            description: "The Quip document thread ID"
          },
          sheetName: {
            type: "string",
            description: "Optional sheet or tab name to read from"
          }
        },
        required: ["threadId"]
      }
    }
  ];
}

/**
 * Handle the quip_read_spreadsheet tool
 *
 * @param args Tool arguments
 * @param storage Storage interface
 * @returns Promise resolving to array of content objects
 */
export async function handleQuipReadSpreadsheet(
  args: Record<string, any>,
  storage: StorageInterface,
  useMock: boolean = false
): Promise<(TextContent | ImageContent | EmbeddedResource)[]> {
  const threadId = args.threadId;
  const sheetName = args.sheetName;
  
  if (!threadId) {
    throw new InvalidParamsError("threadId is required");
  }
  
  logger.info(`Reading spreadsheet from thread ${threadId}`, {
    sheet: sheetName || 'default',
    mock: useMock
  });
  
  // Initialize client based on mode
  let client;
  
  if (useMock) {
    // Use mock client
    logger.info('Using mock Quip client');
    client = new MockQuipClient();
  } else {
    // Get Quip token from environment
    const quipToken = process.env.QUIP_TOKEN;
    const quipBaseUrl = process.env.QUIP_BASE_URL || "https://platform.quip.com";
    
    if (!quipToken) {
      logger.error('QUIP_TOKEN environment variable is not set');
      throw new QuipApiError("QUIP_TOKEN environment variable is not set");
    }
    
    // Initialize real Quip client
    client = new QuipClient(quipToken, quipBaseUrl);
  }
  
  // Variable to store CSV data
  let csvData: string | null = null;
  
  try {
    // Check if the thread is a spreadsheet
    if (!await client.isSpreadsheet(threadId)) {
      logger.error(`Thread ${threadId} is not a spreadsheet or does not exist`);
      throw new QuipApiError(`Thread ${threadId} is not a spreadsheet or does not exist`);
    }

    // Try primary export method first
    let errorMessage: string | null = null;
    
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
    
    if (!csvData) {
      throw new QuipApiError("Failed to export data: no CSV content generated");
    }
  } catch (error) {
    if (error instanceof QuipApiError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error handling quip_read_spreadsheet: ${errorMessage}`);
    throw new QuipApiError(`Error handling quip_read_spreadsheet: ${errorMessage}`);
  }

  // At this point, csvData should be populated
  if (!csvData) {
    throw new QuipApiError("Unexpected error: CSV data is null after successful export");
  }

  // Save the full CSV content to storage
  await storage.saveCSV(threadId, csvData, sheetName);
  
  // Get metadata
  const metadata = await storage.getMetadata(threadId, sheetName);
  
  // Truncate CSV content if it's too large (> 10KB)
  const MAX_SIZE = 10 * 1024; // 10KB
  const [truncatedCsv, isTruncated] = truncateCSVContent(csvData, MAX_SIZE);
  
  // Update metadata with truncation info
  metadata.is_truncated = isTruncated;
  
  // Create response with CSV content and metadata
  const responseData = {
    csv_content: truncatedCsv,
    metadata: metadata
  };
  
  logger.info(`Returning spreadsheet data for thread ${threadId}`, {
    sheet: sheetName || 'default',
    rows: metadata.total_rows,
    truncated: isTruncated
  });
  
  // Convert to JSON and return
  return [{ type: "text", text: JSON.stringify(responseData) }];
}