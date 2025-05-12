import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { parse } from 'csv-parse/sync';
import { URL } from 'url';
import { 
  ListToolsResultSchema, 
  CallToolResultSchema, 
  ReadResourceResultSchema 
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Extract thread ID and sheet name from a resource URI
 * 
 * @param uri Resource URI (quip://, file://, s3://, or https:// for presigned S3 URLs)
 * @returns Object containing threadId and optional sheetName
 * @throws Error if URI protocol is not supported
 */
export function extractResourceInfo(uri: string): { threadId: string, sheetName?: string } {
  // Parse the URI
  const parsedUri = new URL(uri);
  
  // Extract thread_id and sheet_name based on protocol
  let threadId: string;
  let sheetName: string | undefined;
  
  if (parsedUri.protocol === 'file:') {
    // Format: file:///path/to/{threadId}-{sheetName}.csv
    const pathParts = parsedUri.pathname.split('/');
    const filename = pathParts[pathParts.length - 1].replace(".csv", "").split("-");
    threadId = filename[0];
    sheetName = filename.length > 1 ? filename.slice(1).join("-") : undefined;
  } else if (parsedUri.protocol === 's3:') {
    // Format: s3://{bucket}/{prefix}{threadId}-{sheetName}.csv
    const pathParts = parsedUri.pathname.split('/');
    const filename = pathParts[pathParts.length - 1].replace(".csv", "").split("-");
    threadId = filename[0];
    sheetName = filename.length > 1 ? filename.slice(1).join("-") : undefined;
  } else if (parsedUri.protocol === 'https:') {
    // Format: https://{bucket}.s3.{region}.amazonaws.com/{prefix}{threadId}-{sheetName}.csv?...
    // or other variations of presigned S3 URLs
    
    // Extract the path part (ignoring query parameters)
    const pathParts = parsedUri.pathname.split('/');
    const filename = pathParts[pathParts.length - 1].replace(".csv", "").split("-");
    
    if (filename.length === 0) {
      throw new Error(`Invalid HTTPS resource URI: ${uri}`);
    }
    
    threadId = filename[0];
    sheetName = filename.length > 1 ? filename.slice(1).join("-") : undefined;
  } else if (parsedUri.protocol === 'quip:') {
    // Format: quip://{threadId}?sheet={sheetName}
    threadId = parsedUri.hostname;
    const searchParams = new URLSearchParams(parsedUri.search);
    sheetName = searchParams.get('sheet') || undefined;
  } else {
    throw new Error(`Unsupported URI protocol: ${parsedUri.protocol}`);
  }
  
  return { threadId, sheetName };
}

/**
 * Common client functionality shared between different transport types
 */
export async function runClientLogic(client: Client, threadId: string, sheetName?: string): Promise<void> {
  console.log('Starting Quip MCP client example');
  console.log('-------------------------------');
  
  try {
    // List available tools
    console.log('Getting available tools...');
    try {
      console.log('Sending list_tools request...');
      const toolsResult = await client.request(
        { 
          method: "tools/list",
          params: {}
        },
        ListToolsResultSchema
      );
      console.log('Received list_tools response');
      
      if (toolsResult && toolsResult.tools && Array.isArray(toolsResult.tools)) {
        console.log(`Found ${toolsResult.tools.length} tools:`);
        for (const tool of toolsResult.tools) {
          console.log(`- ${tool.name}: ${tool.description}`);
        }
      } else {
        console.log('No tools available or unexpected response structure');
        console.log('Response:', JSON.stringify(toolsResult, null, 2));
      }
    } catch (toolsError) {
      console.error('Error listing tools:', toolsError);
    }
    
    // Call the quip_read_spreadsheet tool
    console.log('\nReading spreadsheet data...');
    console.log(`Thread ID: ${threadId}`);
    if (sheetName) {
      console.log(`Sheet Name: ${sheetName}`);
    }
    
    const toolParams: Record<string, any> = { threadId };
    if (sheetName) {
      toolParams.sheetName = sheetName;
    }
    
    const startTime = new Date();
    console.log(`Request started at: ${startTime.toISOString()}`);
    
    try {
      console.log('Sending call_tool request...');
      const toolResult = await client.request(
        {
          method: "tools/call",
          params: {
            name: "quip_read_spreadsheet",
            arguments: toolParams
          },
        },
        CallToolResultSchema
      );
      console.log('Received call_tool response');
      
      // Log end time and duration
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      // Parse the response
      if (toolResult && toolResult.content && Array.isArray(toolResult.content) && toolResult.content.length > 0) {
        const content = toolResult.content[0];
        
        if (content.type === "text" && content.text) {
          const responseData = JSON.parse(content.text);
          
          // Display results
          console.log('\nSpreadsheet Data:');
          console.log('----------------');
          console.log(`Total Rows: ${responseData.metadata.total_rows}`);
          console.log(`Total Size: ${responseData.metadata.total_size} bytes`);
          console.log(`Truncated: ${responseData.metadata.is_truncated ? 'Yes' : 'No'}`);
          console.log(`Resource URI: ${responseData.metadata.resource_uri}`);
          
          // Check if CSV content exceeds 10,000 characters and truncate if necessary
          const MAX_DISPLAY_LENGTH = 10000;
          let displayContent = responseData.csv_content;
          let clientTruncated = false;
          
          if (displayContent.length > MAX_DISPLAY_LENGTH) {
            displayContent = displayContent.substring(0, MAX_DISPLAY_LENGTH);
            clientTruncated = true;
            console.log(`\nNote: CSV content truncated to ${MAX_DISPLAY_LENGTH} characters for display`);
            console.log(`Original content length: ${responseData.csv_content.length} characters`);
          }
          
          console.log('\nCSV Content Preview:');
          console.log('-------------------');
          // Parse CSV content using csv-parse library (using the possibly truncated content)
          const records = parse(displayContent, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true // More tolerant parsing for truncated content
          });
          
          // Display first 5 rows of parsed CSV
          console.log('First', Math.min(5, records.length), 'rows (parsed as objects):');
          const previewRows = records.slice(0, Math.min(5, records.length));
          console.table(previewRows);
          
          if (clientTruncated) {
            console.log('... (content truncated for display purposes)');
          }
          
          if (responseData.metadata.is_truncated && responseData.metadata.resource_uri) {
            console.log('... (server-side content truncated)');
            
            // Access the complete content through resource URI
            console.log('\nAccessing complete content through resource URI...');
            
            try {
              console.log('Sending read_resource request...');
              console.log(`Resource URI: ${responseData.metadata.resource_uri}`);
              
              // Log the protocol of the resource URI
              const resourceUri = responseData.metadata.resource_uri;
              const parsedUri = new URL(resourceUri);
              console.log(`Resource URI protocol: ${parsedUri.protocol}`);
              
              // Extract thread ID and sheet name from resource URI
              try {
                const { threadId: resourceThreadId, sheetName: resourceSheetName } = extractResourceInfo(resourceUri);
                console.log(`Extracted Thread ID: ${resourceThreadId}`);
                if (resourceSheetName) {
                  console.log(`Extracted Sheet Name: ${resourceSheetName}`);
                }
              } catch (extractError) {
                console.warn(`Could not extract resource info: ${extractError instanceof Error ? extractError.message : String(extractError)}`);
              }
              
              const resourceResult = await client.request(
                { 
                  method: "resources/read",
                  params: { uri: responseData.metadata.resource_uri }
                },
                ReadResourceResultSchema
              );
              console.log('Received read_resource response');
              
              // Debug the response structure - truncate if too large
              const resourceResultJson = JSON.stringify(resourceResult, null, 2);
              if (resourceResultJson.length > MAX_DISPLAY_LENGTH) {
                console.log(`Resource result (truncated to ${MAX_DISPLAY_LENGTH} characters):`,
                  resourceResultJson.substring(0, MAX_DISPLAY_LENGTH));
                console.log(`Original resource result length: ${resourceResultJson.length} characters`);
              } else {
                console.log('Resource result:', resourceResultJson);
              }
              
              if (resourceResult && resourceResult.contents && Array.isArray(resourceResult.contents) && resourceResult.contents.length > 0) {
                const resourceContent = resourceResult.contents[0];
                
                // Truncate resource content JSON if too large
                const resourceContentJson = JSON.stringify(resourceContent, null, 2);
                if (resourceContentJson.length > MAX_DISPLAY_LENGTH) {
                  console.log(`Resource content (truncated to ${MAX_DISPLAY_LENGTH} characters):`,
                    resourceContentJson.substring(0, MAX_DISPLAY_LENGTH));
                  console.log(`Original resource content length: ${resourceContentJson.length} characters`);
                } else {
                  console.log('Resource content:', resourceContentJson);
                }
                
                if (resourceContent.type === "text" && typeof resourceContent.text === 'string') {
                  console.log(`Complete CSV has ${resourceContent.text.split('\n').length} lines`);
                } else {
                  console.log('Could not retrieve complete CSV content');
                  console.log('Content type:', resourceContent.type);
                  console.log('Text type:', typeof resourceContent.text);
                  console.log('Text value:', resourceContent.text);
                }
              } else {
                console.log('No content returned from resource');
                console.log('Response:', JSON.stringify(resourceResult, null, 2));
              }
            } catch (resourceError) {
              console.error('Error reading resource:', resourceError);
            }
          } else if (responseData.metadata.is_truncated) {
            console.log('... (content truncated, but no resource URI available)');
          }
        } else {
          console.log('Unexpected response type:', content.type);
        }
      } else {
        console.log('No content returned from tool call');
        console.log('Response:', JSON.stringify(toolResult, null, 2));
      }
      
      console.log(`\nRequest completed at: ${endTime.toISOString()}`);
      console.log(`Total duration: ${duration}ms`);
      
    } catch (toolError) {
      console.error('Error calling tool:', toolError);
    }
    
    console.log('\nTest completed successfully');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}
