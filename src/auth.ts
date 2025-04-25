/**
 * Authentication for the Quip MCP Server
 */
import * as crypto from 'crypto';
import { AuthenticationError } from './errors';
import { logger } from './logger';

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /**
   * Whether authentication is enabled
   */
  enabled: boolean;
  
  /**
   * API key for authentication
   */
  apiKey?: string;
  
  /**
   * API key header name
   */
  apiKeyHeader: string;
}

/**
 * Default authentication configuration
 */
const DEFAULT_AUTH_CONFIG: AuthConfig = {
  enabled: false,
  apiKeyHeader: 'X-API-Key'
};

/**
 * Authentication service
 */
export class AuthService {
  private config: AuthConfig;
  
  /**
   * Create a new authentication service
   * 
   * @param config Authentication configuration
   */
  constructor(config: Partial<AuthConfig> = {}) {
    this.config = {
      ...DEFAULT_AUTH_CONFIG,
      ...config
    };
    
    // Generate a random API key if enabled but not provided
    if (this.config.enabled && !this.config.apiKey) {
      this.config.apiKey = this.generateApiKey();
      logger.info(`Generated random API key: ${this.config.apiKey}`);
    }
  }
  
  /**
   * Check if authentication is enabled
   * 
   * @returns True if authentication is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * Get the API key header name
   * 
   * @returns API key header name
   */
  getApiKeyHeader(): string {
    return this.config.apiKeyHeader;
  }
  
  /**
   * Get the API key
   * 
   * @returns API key or undefined if authentication is disabled
   */
  getApiKey(): string | undefined {
    return this.config.apiKey;
  }
  
  /**
   * Authenticate a request
   * 
   * @param headers Request headers
   * @throws AuthenticationError if authentication fails
   */
  authenticate(headers: Record<string, string | string[] | undefined>): void {
    if (!this.config.enabled) {
      return;
    }
    
    const apiKey = this.getApiKeyFromHeaders(headers);
    
    if (!apiKey) {
      logger.warn('Authentication failed: API key missing');
      throw new AuthenticationError('API key missing');
    }
    
    if (apiKey !== this.config.apiKey) {
      logger.warn('Authentication failed: Invalid API key');
      throw new AuthenticationError('Invalid API key');
    }
    
    logger.debug('Authentication successful');
  }
  
  /**
   * Get the API key from request headers
   * 
   * @param headers Request headers
   * @returns API key or undefined if not found
   */
  private getApiKeyFromHeaders(headers: Record<string, string | string[] | undefined>): string | undefined {
    const headerName = this.config.apiKeyHeader.toLowerCase();
    
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === headerName) {
        if (Array.isArray(value)) {
          return value[0];
        }
        return value;
      }
    }
    
    return undefined;
  }
  
  /**
   * Generate a random API key
   * 
   * @returns Random API key
   */
  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

/**
 * Create an authentication service from environment variables
 * 
 * @returns Authentication service
 */
export function createAuthServiceFromEnv(): AuthService {
  const enabled = process.env.MCP_AUTH_ENABLED === 'true';
  const apiKey = process.env.MCP_API_KEY;
  const apiKeyHeader = process.env.MCP_API_KEY_HEADER || 'X-API-Key';
  
  return new AuthService({
    enabled,
    apiKey,
    apiKeyHeader
  });
}