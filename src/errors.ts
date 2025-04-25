/**
 * Error handling for the Quip MCP Server
 */

/**
 * Base error class for the Quip MCP Server
 */
export class QuipMCPError extends Error {
  /**
   * Error code for JSON-RPC response
   */
  public code: number;
  
  /**
   * Additional error data
   */
  public data?: any;
  
  constructor(message: string, code: number = -32000, data?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.data = data;
    
    // Ensure instanceof works correctly
    Object.setPrototypeOf(this, QuipMCPError.prototype);
  }
  
  /**
   * Convert error to JSON-RPC error object
   */
  toJsonRpcError() {
    const error: any = {
      code: this.code,
      message: this.message
    };
    
    if (this.data !== undefined) {
      error.data = this.data;
    }
    
    return error;
  }
}

/**
 * Error for invalid request parameters
 */
export class InvalidParamsError extends QuipMCPError {
  constructor(message: string, data?: any) {
    super(message, -32602, data);
    Object.setPrototypeOf(this, InvalidParamsError.prototype);
  }
}

/**
 * Error for method not found
 */
export class MethodNotFoundError extends QuipMCPError {
  constructor(method: string) {
    super(`Method not found: ${method}`, -32601);
    Object.setPrototypeOf(this, MethodNotFoundError.prototype);
  }
}

/**
 * Error for parse errors
 */
export class ParseError extends QuipMCPError {
  constructor(message: string = 'Parse error') {
    super(message, -32700);
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

/**
 * Error for authentication failures
 */
export class AuthenticationError extends QuipMCPError {
  constructor(message: string = 'Authentication failed') {
    super(message, -32001);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Error for resource not found
 */
export class ResourceNotFoundError extends QuipMCPError {
  constructor(uri: string) {
    super(`Resource not found: ${uri}`, -32002);
    Object.setPrototypeOf(this, ResourceNotFoundError.prototype);
  }
}

/**
 * Error for Quip API errors
 */
export class QuipApiError extends QuipMCPError {
  constructor(message: string, data?: any) {
    super(message, -32003, data);
    Object.setPrototypeOf(this, QuipApiError.prototype);
  }
}

/**
 * Error for storage errors
 */
export class StorageError extends QuipMCPError {
  constructor(message: string, data?: any) {
    super(message, -32004, data);
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

/**
 * Error for timeout errors
 */
export class TimeoutError extends QuipMCPError {
  constructor(message: string = 'Request timed out') {
    super(message, -32005);
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}