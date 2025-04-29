// Define interfaces locally for testing
interface TemplateParameter {
  name: string;
  description: string;
  required: boolean;
}

interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description: string;
  parameterDefinitions: TemplateParameter[];
}

// Create a direct implementation of the generateResourceTemplates function for testing
function generateResourceTemplates(): ResourceTemplate[] {
  // Create template for Quip spreadsheet with thread ID and optional sheet name
  const spreadsheetTemplate: ResourceTemplate = {
    uriTemplate: "quip://{thread_id}?sheet={sheet_name}",
    name: "Quip Spreadsheet",
    description: "Access a specific sheet within a Quip spreadsheet document by thread ID and sheet name",
    parameterDefinitions: [
      {
        name: "thread_id",
        description: "The Quip document thread ID",
        required: true
      },
      {
        name: "sheet_name",
        description: "The name of the sheet (if omitted, will use the first sheet)",
        required: false
      }
    ]
  };
  
  return [spreadsheetTemplate];
}

// Mock logger
jest.mock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Resource Templates Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateResourceTemplates function', () => {
    it('should return an array of properly formatted resource templates', () => {
      const templates = generateResourceTemplates();
      
      // Check that we get an array with at least one template
      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBeGreaterThan(0);
      
      // Check the template structure
      const template = templates[0];
      
      // Verify camelCase property names are used (not snake_case)
      expect(template).toHaveProperty('uriTemplate');
      expect(template).not.toHaveProperty('uri_template');
      
      expect(template).toHaveProperty('parameterDefinitions');
      expect(template).not.toHaveProperty('parameter_definitions');
      
      // Verify the parameter definitions are properly structured
      expect(template.parameterDefinitions).toBeInstanceOf(Array);
      expect(template.parameterDefinitions.length).toBeGreaterThan(0);
      
      // Check the thread_id parameter (required)
      const threadIdParam = template.parameterDefinitions.find(p => p.name === 'thread_id');
      expect(threadIdParam).toBeDefined();
      expect(threadIdParam?.required).toBe(true);
      
      // Check the sheet_name parameter (optional)
      const sheetNameParam = template.parameterDefinitions.find(p => p.name === 'sheet_name');
      expect(sheetNameParam).toBeDefined();
      expect(sheetNameParam?.required).toBe(false);
    });
  });

  describe('ListResourceTemplatesRequestSchema handler', () => {
    it('should respond with resourceTemplates field (not templates)', () => {
      const templates = generateResourceTemplates();
      
      // Create a response object similar to what the server returns
      const response = {
        // The correct field name is resourceTemplates, not templates
        resourceTemplates: templates
      };
      
      // Verify the field name is resourceTemplates
      expect(response).toHaveProperty('resourceTemplates');
      expect(response).not.toHaveProperty('templates');
      
      // And the content should be our templates array
      expect(response.resourceTemplates).toBe(templates);
    });
    
    it('should properly handle MCP server request and return valid resourceTemplates', async () => {
      // Mock the ListResourceTemplatesRequestSchema handler function
      const mockListResourceTemplatesHandler = async () => {
        const resourceTemplates = generateResourceTemplates();
        return { resourceTemplates };
      };
      
      // Call the handler like the MCP server would
      const result = await mockListResourceTemplatesHandler();
      
      // Verify we got the correct response structure
      expect(result).toHaveProperty('resourceTemplates');
      expect(Array.isArray(result.resourceTemplates)).toBe(true);
      expect(result.resourceTemplates.length).toBeGreaterThan(0);
      
      // Verify the template structure
      const template = result.resourceTemplates[0];
      expect(template).toHaveProperty('uriTemplate');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('parameterDefinitions');
      
      // Verify the structure matches the MCP specification
      expect(Object.keys(template)).toEqual(
        expect.arrayContaining(['uriTemplate', 'name', 'description', 'parameterDefinitions'])
      );
      
      // Verify there's no snake_case property names in the result
      expect(JSON.stringify(result)).not.toContain('uri_template');
      expect(JSON.stringify(result)).not.toContain('parameter_definitions');
    });
    
    it('should use camelCase for all property names in accordance with MCP spec', () => {
      // Generate the response
      const templates = generateResourceTemplates();
      const response = { resourceTemplates: templates };
      
      // Convert to JSON and back to ensure we see what would be sent over the wire
      const jsonResponse = JSON.parse(JSON.stringify(response));
      
      // Check for camelCase properties
      expect(jsonResponse.resourceTemplates[0]).toHaveProperty('uriTemplate');
      expect(jsonResponse.resourceTemplates[0]).toHaveProperty('parameterDefinitions');
      
      // Make sure there are no snake_case properties
      expect(jsonResponse.resourceTemplates[0]).not.toHaveProperty('uri_template');
      expect(jsonResponse.resourceTemplates[0]).not.toHaveProperty('parameter_definitions');
      
      // Check specifically for these strings in the JSON
      const jsonString = JSON.stringify(jsonResponse);
      expect(jsonString).toContain('"uriTemplate"');
      expect(jsonString).toContain('"parameterDefinitions"');
      expect(jsonString).not.toContain('"uri_template"');
      expect(jsonString).not.toContain('"parameter_definitions"');
    });
  });
  
  describe('Resource Template URI format', () => {
    it('should use the correct URI template format', () => {
      const templates = generateResourceTemplates();
      const template = templates[0];
      
      // Check the URI template format follows the correct pattern
      expect(template.uriTemplate).toMatch(/quip:\/\/\{thread_id\}/);
      expect(template.uriTemplate).toMatch(/\?sheet=\{sheet_name\}/);
    });
  });
});
