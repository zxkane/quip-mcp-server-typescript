/**
 * Quip API client implementation
 */
import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as cheerio from 'cheerio';
import { logger } from './logger';

/**
 * Simple Quip API client implementation for the MCP server
 */
export class QuipClient {
  private accessToken: string;
  private baseUrl: string;
  private axiosInstance: any;
  
  /**
   * Initialize the Quip client with the given access token and base URL
   * 
   * @param accessToken Quip API access token
   * @param baseUrl Base URL for the Quip API (default: https://platform.quip.com)
   */
  constructor(accessToken: string, baseUrl: string = "https://platform.quip.com") {
    this.accessToken = accessToken;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.axiosInstance = axios.create({
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      },
      // Add timeout configuration to prevent hanging requests
      timeout: 30000 // 30 seconds timeout
    });
    logger.info(`QuipClient initialized with base URL: ${this.baseUrl}`);
  }
  
  /**
   * Get a thread by ID
   * 
   * @param threadId ID of the thread to retrieve
   * @returns Promise resolving to thread information
   * @throws Error if the request fails
   */
  async getThread(threadId: string): Promise<Record<string, any>> {
    logger.info(`Getting thread: ${threadId}`);
    try {
      const response = await this.axiosInstance.get(`${this.baseUrl}/1/threads/${threadId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error getting thread ${threadId}: ${error instanceof Error ? error.message : String(error)}`);
      // Check for timeout error based on error message or properties
      const err = error as any;
      if (err.code === 'ECONNABORTED' || (err.message && err.message.includes('timeout'))) {
        throw new Error(`Request timed out when trying to get thread ${threadId}`);
      }
      throw error;
    }
  }
  
  /**
   * Export a thread to XLSX format and save it locally
   * 
   * @param threadId ID of the thread to export
   * @param outputPath Local file path where the XLSX file should be saved
   * @returns Promise resolving to path to the saved XLSX file
   * @throws Error if the request fails
   */
  async exportThreadToXLSX(threadId: string, outputPath: string): Promise<string> {
    logger.info(`Exporting thread ${threadId} to XLSX`);
    try {
      const response = await this.axiosInstance.get(
        `${this.baseUrl}/1/threads/${threadId}/export/xlsx`,
        { 
          responseType: 'arraybuffer',  // Get binary data
          timeout: 45000 // 45 seconds timeout for export operation which may take longer
        }
      );
      
      // Ensure the directory exists
      await fs.mkdirp(path.dirname(path.resolve(outputPath)));
      
      // Write the file
      await fs.writeFile(outputPath, Buffer.from(response.data));
      
      logger.info(`Successfully exported XLSX to ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error(`Error exporting thread ${threadId} to XLSX: ${error instanceof Error ? error.message : String(error)}`);
      // Check for timeout error based on error message or properties
      const err = error as any;
      if (err.code === 'ECONNABORTED' || (err.message && err.message.includes('timeout'))) {
        throw new Error(`Request timed out when trying to export thread ${threadId} to XLSX`);
      }
      throw error;
    }
  }
  
  /**
   * Export a thread to CSV format using HTML parsing as fallback method
   * 
   * @param threadId ID of the thread to export
   * @param sheetName Name of the sheet to extract (optional)
   * @returns Promise resolving to CSV data as string
   * @throws Error if the thread is not found or does not contain a spreadsheet
   */
  async exportThreadToCSVFallback(threadId: string, sheetName?: string): Promise<string> {
    logger.info(`Using fallback method to export thread ${threadId} to CSV`);
    
    // Get thread data
    const thread = await this.getThread(threadId);
    if (!thread || !thread.html) {
      throw new Error("Could not retrieve thread or thread has no HTML content");
    }
    
    // Find and extract sheet data
    const sheet = findSheetByName(thread.html, sheetName);
    if (!sheet) {
      if (sheetName) {
        throw new Error(`Could not find sheet '${sheetName}' in the document`);
      } else {
        throw new Error("Could not find any spreadsheet in the document");
      }
    }
    
    // Extract and process data
    const data = extractSheetData(sheet);
    if (!data || data.length === 0) {
      throw new Error(`No data found in sheet '${sheetName || 'default'}'`);
    }
    
    // Convert to CSV string
    let csvContent = '';
    for (const row of data) {
      csvContent += row.map(cell => {
        // Escape quotes and wrap in quotes if needed
        if (cell.includes('"') || cell.includes(',') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',') + '\n';
    }
    
    return csvContent;
  }
  
  /**
   * Check if a thread is a spreadsheet
   * 
   * @param threadId ID of the thread to check
   * @returns Promise resolving to true if the thread is a spreadsheet, false otherwise
   */
  async isSpreadsheet(threadId: string): Promise<boolean> {
    try {
      const thread = await this.getThread(threadId);
      if (!thread || !thread.thread) {
        return false;
      }
      
      // Check if the thread type is 'spreadsheet'
      const threadType = thread.thread.type?.toLowerCase() || '';
      return threadType === 'spreadsheet';
    } catch (error) {
      logger.error(`Error checking if thread is spreadsheet: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}

/**
 * Find a spreadsheet with the given name in the document HTML
 * 
 * @param documentHtml HTML content of the document
 * @param sheetName Name of the sheet to find (optional)
 * @returns Cheerio element or null if not found
 */
export function findSheetByName(documentHtml: string, sheetName?: string): any {
  const $ = cheerio.load(documentHtml);
  
  // First try to find a table with the specified title attribute
  let table: any = null;
  if (sheetName) {
    table = $(`table[title="${sheetName}"]`).get(0) || null;
  }
  
  if (table) {
    return table;
  }
  
  // If not found and sheet_name is provided, look for a heading with the sheet name
  if (sheetName) {
    for (const heading of $('h1, h2, h3').get()) {
      if ($(heading).text().trim() === sheetName) {
        const nextTable = $(heading).nextAll('table').first().get(0);
        if (nextTable) {
          return nextTable;
        }
      }
    }
  }
  
  // If still not found or no sheet_name provided, return the first table
  return $('table').get(0) || null;
}

/**
 * Extract data from a sheet element
 * 
 * @param sheet Cheerio element
 * @returns Array of rows, where each row is an array of cell values
 */
export function extractSheetData(sheet: any): string[][] {
  if (!sheet) {
    return [];
  }
  
  const $ = cheerio.load(sheet);
  const rows: string[][] = [];
  
  // Process rows
  $('tr').each((_, tr) => {
    const rowData: string[] = [];
    $(tr).find('td').each((_, td) => {
      rowData.push($(td).text().trim());
    });
    
    // Skip empty rows
    if (rowData.some(text => text)) {
      rows.push(rowData);
    }
  });
  
  return rows;
}

/**
 * Convert XLSX file to CSV format, optionally extracting a specific sheet
 * 
 * @param xlsxPath Path to the XLSX file
 * @param sheetName Name of the sheet to extract (optional)
 * @returns CSV data as string
 * @throws Error if the sheet is not found
 */
export function convertXLSXToCSV(xlsxPath: string, sheetName?: string): string {
  logger.info(`Reading XLSX file from ${xlsxPath}`);
  
  // Load the workbook
  const workbook = XLSX.readFile(xlsxPath);
  
  // Get available sheet names
  const sheetNames = workbook.SheetNames;
  logger.info(`Available sheets: ${sheetNames.join(', ')}`);
  
  // Determine which sheet to use
  let sheetIndex = 0;
  if (sheetName) {
    // Try exact match first
    sheetIndex = sheetNames.findIndex(s => s === sheetName);
    
    // If not found, try case-insensitive match
    if (sheetIndex === -1) {
      const sheetLower = sheetName.toLowerCase();
      sheetIndex = sheetNames.findIndex(s => s.toLowerCase() === sheetLower);
    }
    
    if (sheetIndex === -1) {
      throw new Error(`Sheet '${sheetName}' not found. Available sheets: ${sheetNames.join(', ')}`);
    }
  }
  
  // Get the sheet
  const sheet = workbook.Sheets[sheetNames[sheetIndex]];
  
  // BUGFIX: Manually scan for all cell keys to determine the true sheet range
  // This fixes an issue where the sheet's !ref property might incorrectly report
  // a smaller range than the actual data in the file
  const cellKeys = Object.keys(sheet).filter(key => key[0] !== '!');
  let maxCol = 0;
  let maxRow = 0;
  
  // Find the maximum column and row by examining all cell keys
  cellKeys.forEach(key => {
    // Parse cell address (e.g., "A1", "B2", etc.)
    const match = key.match(/^([A-Z]+)(\d+)$/);
    if (match) {
      const colStr = match[1];
      const rowIdx = parseInt(match[2], 10);
      
      const colIdx = XLSX.utils.decode_col(colStr);
      if (colIdx > maxCol) maxCol = colIdx;
      if (rowIdx > maxRow) maxRow = rowIdx;
    }
  });
  
  // Create a custom range that includes all cells
  const customRange = {
    s: { c: 0, r: 0 },           // Start at A1
    e: { c: maxCol, r: maxRow-1 } // End at the furthest cell
  };
  
  // Log the detected range
  logger.info(`Detected full sheet range: from A1 to ${XLSX.utils.encode_col(maxCol)}${maxRow}`);
  logger.info(`Total columns: ${maxCol + 1}`);
  
  // Convert to JSON using our custom range to include all columns
  const data: Array<Array<any>> = XLSX.utils.sheet_to_json(sheet, { 
    header: 1, 
    raw: false,
    defval: '', // Ensure empty cells are included
    range: customRange // Use our custom range instead of sheet['!ref']
  });
  
  // Process data and build CSV with proper escaping
  let csvContent = '';
  for (const row of data) {
    if (!row || row.length === 0) continue; // Skip empty rows
    
    csvContent += row.map((cell: any) => {
      // Handle null or undefined cells
      const cellValue = cell === null || cell === undefined ? '' : String(cell);
      
      // If cell contains commas, quotes, or newlines, wrap in quotes and escape any quotes
      if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n') || cellValue.includes('\r')) {
        return `"${cellValue.replace(/"/g, '""')}"`;
      }
      return cellValue;
    }).join(',') + '\n';
  }
  
  return csvContent;
}
