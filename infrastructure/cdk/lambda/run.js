#!/usr/bin/env node

const { SecretsManager } = require('@aws-sdk/client-secrets-manager');
const { spawn } = require('child_process');
const path = require('path');

// Initialize Secrets Manager client
const secretsManager = new SecretsManager({
  region: process.env.AWS_REGION || 'us-east-1',
});

async function main() {
  try {
    // Check if QUIP_TOKEN_SECRET_ARN is set
    const secretArn = process.env.SECRET_ARN;
    if (!secretArn) {
      console.error('Error: SECRET_ARN environment variable is not set');
      process.exit(1);
    }

    // Retrieve the secret value from AWS Secrets Manager
    const response = await secretsManager.getSecretValue({ SecretId: secretArn });
    
    if (!response.SecretString) {
      console.error('Error: No secret string returned from AWS Secrets Manager');
      process.exit(1);
    }

    let quipToken;
    let mcpApiKey;
    let quipBaseUrl;
    
    // Try to parse the secret as JSON first
    try {
      const secretJson = JSON.parse(response.SecretString);
      // Extract QUIP_TOKEN according to documented format
      quipToken = secretJson.QUIP_TOKEN;
      // If not found, try alternative key names
      if (!quipToken) {
        quipToken = secretJson.token || secretJson.quipToken;
      }
      
      // Extract MCP_API_KEY according to documented format
      mcpApiKey = secretJson.MCP_API_KEY;
      // If not found, try alternative key names
      if (!mcpApiKey) {
        mcpApiKey = secretJson.apiKey || secretJson.mcpApiKey;
      }
      
      // Extract QUIP_BASE_URL according to documented format
      quipBaseUrl = secretJson.QUIP_BASE_URL;
      // If not found, try alternative key names
      if (!quipBaseUrl) {
        quipBaseUrl = secretJson.baseUrl || secretJson.quipBaseUrl;
      }
    } catch (e) {
      // If parsing fails, use the entire secret string as the token
      quipToken = response.SecretString;
    }

    // If we still don't have a token, try one more approach
    if (!quipToken && typeof response.SecretString === 'string') {
      // Try to extract token using regex
      const tokenMatch = response.SecretString.match(/"QUIP_TOKEN":"([^"]*)"/);
      if (tokenMatch && tokenMatch[1]) {
        quipToken = tokenMatch[1];
      } else {
        // Try alternative key names
        const altTokenMatch = response.SecretString.match(/"token":"([^"]*)"/);
        if (altTokenMatch && altTokenMatch[1]) {
          quipToken = altTokenMatch[1];
        } else {
          // Use the entire string as a last resort
          quipToken = response.SecretString;
        }
      }
    }

    // If we still don't have an API key, try regex approach
    if (!mcpApiKey && typeof response.SecretString === 'string') {
      const apiKeyMatch = response.SecretString.match(/"MCP_API_KEY":"([^"]*)"/);
      if (apiKeyMatch && apiKeyMatch[1]) {
        mcpApiKey = apiKeyMatch[1];
      }
    }
    
    // If we still don't have a base URL, try regex approach
    if (!quipBaseUrl && typeof response.SecretString === 'string') {
      const baseUrlMatch = response.SecretString.match(/"QUIP_BASE_URL":"([^"]*)"/);
      if (baseUrlMatch && baseUrlMatch[1]) {
        quipBaseUrl = baseUrlMatch[1];
      } else {
        // Try alternative key names
        const altBaseUrlMatch = response.SecretString.match(/"baseUrl":"([^"]*)"/);
        if (altBaseUrlMatch && altBaseUrlMatch[1]) {
          quipBaseUrl = altBaseUrlMatch[1];
        }
      }
    }

    // Check if we have a token
    if (!quipToken) {
      console.error('Error: Failed to extract Quip token from secret');
      process.exit(1);
    }

    // Set the environment variables
    process.env.QUIP_TOKEN = quipToken;
    
    // Set MCP_API_KEY if available
    if (mcpApiKey) {
      process.env.MCP_API_KEY = mcpApiKey;
    } else {
      console.warn('Warning: MCP_API_KEY not found in secret');
    }
    
    // Set QUIP_BASE_URL if available (optional, no warning if not found)
    if (quipBaseUrl) {
      process.env.QUIP_BASE_URL = quipBaseUrl;
    }

    // Execute the Node.js application
    // Using spawn to properly handle signals and exit codes
    const nodeProcess = spawn('node', ['index.js', '--storage-type', 's3'], {
      stdio: 'inherit',
      env: process.env
    });

    // Forward exit code from the child process
    nodeProcess.on('close', (code) => {
      process.exit(code);
    });

  } catch (error) {
    console.error('Error retrieving secret:', error);
    process.exit(1);
  }
}

// Run the main function
main();