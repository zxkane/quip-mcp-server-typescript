#!/usr/bin/env node
/**
 * Main entry point for the Quip MCP Server
 */
import * as dotenv from 'dotenv';
import { main } from './server';
import { logger } from './logger';

// Load environment variables
dotenv.config();

// Run the server
main().catch(error => {
  logger.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
