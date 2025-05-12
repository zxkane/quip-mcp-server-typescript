/**
 * Command-line interface for the Quip MCP Server
 */
import { Command } from 'commander';
import * as os from 'os';
import * as path from 'path';
import { version } from './version';
import { CommandLineOptions } from './types';
import { logger } from './logger';

/**
 * Parse command line arguments
 * 
 * @returns Parsed command line options
 */
export function parseCommandLineArgs(): CommandLineOptions {
  const program = new Command();
  
  program
    .name('quip-mcp-server')
    .description('MCP server for interacting with Quip spreadsheets')
    .version(version)
    .option(
      '--storage-type <type>',
      'Storage type (local or s3)',
      'local'
    )
    .option(
      '--storage-path <path>',
      'Path to store CSV files (default: from QUIP_STORAGE_PATH env var or ~/.quip-mcp-server/storage)'
    )
    .option(
      '--file-protocol',
      'Use file protocol for resource URIs',
      false
    )
    .option(
      '--s3-bucket <name>',
      'S3 bucket name (required for S3 storage)'
    )
    .option(
      '--s3-region <region>',
      'S3 region (required for S3 storage)'
    )
    .option(
      '--s3-prefix <prefix>',
      'S3 prefix (optional for S3 storage)'
    )
    .option(
      '--s3-url-expiration <seconds>',
      'S3 URL expiration in seconds (default: 3600)',
      (value) => parseInt(value, 10)
    )
    .option(
      '--debug',
      'Enable debug logging',
      false
    )
    .option(
      '--mock',
      'Use mock mode (no real Quip token required)',
      false
    )
    .option(
      '--json',
      'Output logs as JSON',
      false
    )
    .option(
      '--log-file <path>',
      'Path to log file (enables file logging)'
    )
    .option(
      '--auth',
      'Enable authentication',
      false
    )
    .option(
      '--api-key <key>',
      'API key for authentication (default: from MCP_API_KEY env var or auto-generated)'
    )
    .option(
      '--api-key-header <header>',
      'API key header name (default: from MCP_API_KEY_HEADER env var or X-API-Key)'
    )
    .option(
      '--port <port>',
      'HTTP port to listen on (default: from MCP_PORT env var or 3000)',
      (value) => parseInt(value, 10)
    );
  
  program.parse();
  
  return program.opts<CommandLineOptions>();
}

/**
 * Get storage path from command line options or environment variables
 *
 * @param options Command line options
 * @returns Storage path
 */
export function getStoragePath(options: { storagePath?: string }): string {
  // First try command line argument
  if (options.storagePath) {
    return options.storagePath;
  }
  
  // Then try environment variable
  const storagePath = process.env.QUIP_STORAGE_PATH;
  if (storagePath) {
    return storagePath;
  }
  
  // Default to ~/.quip-mcp-server/storage
  const defaultPath = path.join(os.homedir(), '.quip-mcp-server', 'storage');
  logger.info(`Using default storage path: ${defaultPath}`);
  return defaultPath;
}

/**
 * Get storage configuration from command line options or environment variables
 *
 * @param options Command line options
 * @returns Storage configuration
 */
export function getStorageConfig(options: CommandLineOptions): {
  storageType: string;
  s3Bucket?: string;
  s3Region?: string;
  s3Prefix?: string;
  s3UrlExpiration?: number;
} {
  // Get storage type
  const storageType = options.storageType || process.env.STORAGE_TYPE || 'local';
  
  // Get S3 configuration if needed
  if (storageType === 's3') {
    return {
      storageType,
      s3Bucket: options.s3Bucket || process.env.S3_BUCKET,
      s3Region: options.s3Region || process.env.S3_REGION,
      s3Prefix: options.s3Prefix || process.env.S3_PREFIX,
      s3UrlExpiration: options.s3UrlExpiration ||
        (process.env.S3_URL_EXPIRATION ? parseInt(process.env.S3_URL_EXPIRATION, 10) : undefined)
    };
  }
  
  return { storageType };
}

/**
 * Configure logging based on options
 * 
 * @param options Command line options
 */
export function configureLogging(options: { debug: boolean, json?: boolean, logFile?: string }): void {
  // Import the logger here to avoid circular dependencies
  const { configureLogger } = require('./logger');
  
  // Configure the logger
  configureLogger({
    debug: options.debug,
    json: options.json || false,
    logFile: options.logFile
  });
}
