#!/bin/bash
#
# Helper script to start the Quip MCP server in HTTP mode
# Usage: ./start-http-server.sh [port]
#

# Default port if not specified
PORT=${1:-3000}

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
    echo "Loading environment variables from .env.local"
    # Parse .env file line by line to handle special characters in values
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        [[ $line =~ ^# ]] || [[ -z $line ]] && continue
        
        # Extract variable name and value, preserving special characters
        if [[ $line =~ ^([^=]+)=(.*)$ ]]; then
            key="${BASH_REMATCH[1]}"
            value="${BASH_REMATCH[2]}"
            
            # Remove surrounding quotes if present
            value="${value%\"}"
            value="${value#\"}"
            value="${value%\'}"
            value="${value#\'}"
            
            # Export the variable
            export "$key=$value"
        fi
    done < .env.local
else
    echo "Warning: .env.local file not found. Make sure QUIP_TOKEN and QUIP_BASE_URL are set in your environment."
fi

# Check for required environment variables
if [ -z "$QUIP_TOKEN" ]; then
    echo "Error: QUIP_TOKEN environment variable is not set."
    echo "Please create a .env.local file with QUIP_TOKEN=your_token or set it in your environment."
    exit 1
fi

if [ -z "$QUIP_BASE_URL" ]; then
    echo "Warning: QUIP_BASE_URL is not set, defaulting to https://platform.quip.com"
    QUIP_BASE_URL="https://platform.quip.com"
fi

# Create storage directory if it doesn't exist
STORAGE_PATH="./tmp/mcp/quip-mcp-server"
mkdir -p $STORAGE_PATH

echo "Starting Quip MCP server in HTTP mode on port $PORT..."
echo "Using storage path: $STORAGE_PATH"

# Start the server with the specified port
QUIP_TOKEN="$QUIP_TOKEN" \
QUIP_BASE_URL="$QUIP_BASE_URL" \
PORT=$PORT \
node ../dist/index.js --storage-path $STORAGE_PATH

# Note: This script will block until the server is stopped with Ctrl+C
