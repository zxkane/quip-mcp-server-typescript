#!/usr/bin/env node
/**
 * Main entry point for the Quip MCP Server
 */
import * as dotenv from 'dotenv';
import { main } from './server';

// Load environment variables
dotenv.config();

// Run the server
main().catch(error => {
  console.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});