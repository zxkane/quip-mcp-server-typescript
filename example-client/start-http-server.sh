#!/bin/bash
#
# Helper script to start the Quip MCP server in HTTP mode
# Usage: ./start-http-server.sh [port] [storage_type]
#
# Examples:
#   ./start-http-server.sh 3000 local    # Use local storage with port 3000
#   ./start-http-server.sh 3000 s3       # Use S3 storage with port 3000
#   ./start-http-server.sh               # Use default port 3000 with local storage
#
# SSE Support:
#   Set MCP_SSE_ENABLED=true in your .env file to enable Server-Sent Events format

# Default port if not specified
PORT=${1:-3000}

# Default storage type if not specified
STORAGE_TYPE=${2:-local}

# Determine which env file to use based on storage type
ENV_FILE=".env.local"
if [ "$STORAGE_TYPE" == "s3" ]; then
    ENV_FILE=".env.s3.local"
fi

# Load environment variables from env file if it exists
if [ -f "$ENV_FILE" ]; then
    echo "Loading environment variables from $ENV_FILE"
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
    done < "$ENV_FILE"
else
    echo "Warning: $ENV_FILE file not found. Make sure QUIP_TOKEN and QUIP_BASE_URL are set in your environment."
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

# Create storage directory if using local storage
STORAGE_PATH=""
if [ "$STORAGE_TYPE" == "local" ]; then
    STORAGE_PATH="./tmp/mcp/quip-mcp-server"
    mkdir -p $STORAGE_PATH
    echo "Using local storage path: $STORAGE_PATH"
fi

echo "Starting Quip MCP server in HTTP mode on port $PORT..."

# Define base command
CMD="QUIP_TOKEN=\"$QUIP_TOKEN\" QUIP_BASE_URL=\"$QUIP_BASE_URL\" MCP_PORT=$PORT"

# Add storage type
CMD="$CMD STORAGE_TYPE=$STORAGE_TYPE"

# Add SSE flag if enabled
if [ "$MCP_SSE_ENABLED" == "true" ]; then
    echo "SSE (Server-Sent Events) format enabled"
    SSE_FLAG="--sse"
else
    SSE_FLAG=""
fi

# Add S3 specific environment variables if using S3 storage
if [ "$STORAGE_TYPE" == "s3" ]; then
    echo "Using S3 storage with bucket: $S3_BUCKET, region: $S3_REGION"
    CMD="$CMD S3_BUCKET=\"$S3_BUCKET\" S3_REGION=\"$S3_REGION\""
    
    # Add optional S3 parameters if they exist
    if [ ! -z "$S3_PREFIX" ]; then
        CMD="$CMD S3_PREFIX=\"$S3_PREFIX\""
    fi
    
    if [ ! -z "$S3_URL_EXPIRATION" ]; then
        CMD="$CMD S3_URL_EXPIRATION=$S3_URL_EXPIRATION"
    fi
    
    # Add AWS credentials if provided
    if [ ! -z "$AWS_PROFILE" ]; then
        CMD="$CMD AWS_PROFILE=\"$AWS_PROFILE\""
        echo "Using AWS profile: $AWS_PROFILE"
    elif [ ! -z "$AWS_ACCESS_KEY_ID" ] && [ ! -z "$AWS_SECRET_ACCESS_KEY" ]; then
        CMD="$CMD AWS_ACCESS_KEY_ID=\"$AWS_ACCESS_KEY_ID\" AWS_SECRET_ACCESS_KEY=\"$AWS_SECRET_ACCESS_KEY\""
        echo "Using AWS access key and secret key"
    else
        echo "Using default AWS credentials (EC2 instance profile or credentials file)"
    fi
fi

# Build the command with the appropriate parameters
SERVER_CMD="../dist/index.js"

# Always include storage type as a command-line argument to override defaults
SERVER_CMD="$SERVER_CMD --storage-type $STORAGE_TYPE"

# Add storage path parameter only for local storage
if [ "$STORAGE_TYPE" == "local" ]; then
    SERVER_CMD="$SERVER_CMD --storage-path $STORAGE_PATH"
fi

# Start the server with all the necessary environment variables
# Create a safe version of the command for logging by masking sensitive information
log_cmd=$(echo "$CMD" | sed -E 's/(QUIP_TOKEN=")[^"]*(")/ QUIP_TOKEN="********" /g' | \
    sed -E 's/(AWS_ACCESS_KEY_ID=")[^"]*(")/ AWS_ACCESS_KEY_ID="********" /g' | \
    sed -E 's/(AWS_SECRET_ACCESS_KEY=")[^"]*(")/ AWS_SECRET_ACCESS_KEY="********" /g')

echo "Starting server with command: $log_cmd node $SERVER_CMD $SSE_FLAG"
eval "$CMD node $SERVER_CMD --debug $SSE_FLAG"

# Note: This script will block until the server is stopped with Ctrl+C
