import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { parse } from 'csv-parse/sync';
import { 
  ListToolsResultSchema, 
  CallToolResultSchema, 
  ReadResourceResultSchema 
} from "@modelcontextprotocol/sdk/types.js";

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
          
          console.log('\nCSV Content Preview:');
          console.log('-------------------');
          // Parse CSV content using csv-parse library
          const records = parse(responseData.csv_content, {
            columns: true,
            skip_empty_lines: true
          });
          
          // Display first 5 rows of parsed CSV
          console.log('First', Math.min(5, records.length), 'rows (parsed as objects):');
          const previewRows = records.slice(0, Math.min(5, records.length));
          console.table(previewRows);
          
          if (responseData.metadata.is_truncated && responseData.metadata.resource_uri) {
            console.log('... (content truncated)');
            
            // Access the complete content through resource URI
            console.log('\nAccessing complete content through resource URI...');
            
            try {
              console.log('Sending read_resource request...');
              const resourceResult = await client.request(
                { 
                  method: "resources/read",
                  params: { uri: responseData.metadata.resource_uri }
                },
                ReadResourceResultSchema
              );
              console.log('Received read_resource response');
              
              // Debug the response structure
              console.log('Resource result:', JSON.stringify(resourceResult, null, 2));
              
              if (resourceResult && resourceResult.contents && Array.isArray(resourceResult.contents) && resourceResult.contents.length > 0) {
                const resourceContent = resourceResult.contents[0];
                console.log('Resource content:', JSON.stringify(resourceContent, null, 2));
                
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
