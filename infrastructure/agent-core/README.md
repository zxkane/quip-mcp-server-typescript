# Quip MCP Server - Agent Core Runtime Deployment

This directory contains the AWS CDK infrastructure for deploying the Quip MCP Server to AWS Agent Core Runtime.

## Overview

AWS Agent Core Runtime provides a serverless, secure hosting environment for AI agents and MCP (Model Context Protocol) servers with enhanced capabilities:

- **8-hour execution time** (vs 15-minute Lambda limit)
- **100MB payload support** (vs 6MB Lambda limit)
- **Session isolation** with dedicated microVMs
- **Built-in authentication** and observability
- **Consumption-based pricing**

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │────│  Agent Core      │────│  Quip MCP       │
│   (Claude, etc) │    │  Runtime         │    │  Server         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                         │
                              ▼                         ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ IAM Role &       │    │ S3 Bucket &     │
                       │ Permissions      │    │ Secrets Manager │
                       └──────────────────┘    └─────────────────┘
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **Node.js** (version 18 or higher)
4. **Docker** with buildx support for ARM64
5. **CDK CLI** installed globally (`npm install -g aws-cdk`)

## Required Resources

Before deployment, ensure the following resources exist:

### 1. Secrets Manager Secret

Create a secret containing your Quip API token and optional MCP API key:

```bash
aws secretsmanager create-secret \
  --name "quip-mcp-server/secrets" \
  --description "Quip MCP Server credentials" \
  --secret-string '{
    "QUIP_TOKEN":"your-quip-api-token-here",
    "MCP_API_KEY":"your-mcp-api-key-here",
    "QUIP_BASE_URL":"https://platform.quip.com"
  }' \
  --region us-west-2
```

**Secret Format Options:**
- **JSON Format** (recommended): Contains structured data with QUIP_TOKEN, MCP_API_KEY, and QUIP_BASE_URL
- **Simple String**: Just the Quip token as plain text (legacy support)
- **Alternative Keys**: Supports token, quipToken, apiKey, mcpApiKey, baseUrl, quipBaseUrl for flexibility

### 2. S3 Bucket (Optional)

The stack can create a new S3 bucket or use an existing one. To use an existing bucket, specify it in the deployment parameters.

## Deployment

### 1. Install Dependencies

```bash
cd infrastructure/agent-core
npm install
```

### 2. Bootstrap CDK (First Time Only)

```bash
npx cdk bootstrap
```

### 3. Deploy the Stack

```bash
# Deploy with default settings
npx cdk deploy

# Or deploy with custom parameters
npx cdk deploy \
  --context agentRuntimeName=my_quip_mcp_server \
  --context s3BucketName=my-existing-bucket \
  --context secretARN=arn:aws:secretsmanager:region:account:secret:name
```

**Required Parameter:**
- `secretARN`: Complete ARN of the Secrets Manager secret containing Quip credentials

**Optional Parameters:**
- `agentRuntimeName`: Name for the Agent Core Runtime (default: 'quip_mcp_server', pattern: a-zA-Z0-9_)
- `s3BucketName`: Existing S3 bucket name (creates new if not specified)
- `s3Prefix`: S3 key prefix for data storage (default: 'quip-data/')

### 4. Verify Deployment

After deployment, you'll see outputs similar to:

```
✅  QuipMcpAgentCoreStack

Outputs:
QuipMcpAgentCoreStack.AgentRuntimeArn = arn:aws:bedrock-agent-core:us-west-2:123456789012:runtime/quip_mcp_server_xyz123
QuipMcpAgentCoreStack.McpInvocationEndpoint = https://bedrock-agent-core.us-west-2.amazonaws.com/runtimes/...
QuipMcpAgentCoreStack.EcrRepositoryUri = 123456789012.dkr.ecr.us-west-2.amazonaws.com/quip_mcp_server_repository
```

## Configuration

The stack creates an Agent Core Runtime with the following configuration:

- **Protocol**: MCP (Model Context Protocol)
- **Port**: 8000 (MCP standard)
- **Network**: Public access
- **Platform**: ARM64 Linux container
- **Secret Handling**: Automatic retrieval from AWS Secrets Manager via run.js wrapper
- **Authentication**: Built-in MCP authentication with configurable API keys
- **Update Strategy**: Supports in-place updates without recreating runtime

### Environment Variables

The following environment variables are automatically configured:

| Variable | Value | Description |
|----------|-------|-------------|
| `MCP_PORT` | `8000` | MCP server port |
| `MCP_AUTH_ENABLED` | `true` | Enable MCP authentication |
| `MCP_API_KEY_HEADER` | `X-API-Key` | HTTP header for MCP API key |
| `STORAGE_TYPE` | `s3` | Use S3 for data storage |
| `S3_BUCKET` | `<bucket-name>` | S3 bucket for Quip data |
| `S3_REGION` | `<region>` | AWS region |
| `S3_PREFIX` | `quip-data/` | S3 key prefix |
| `S3_URL_EXPIRATION` | `3600` | S3 presigned URL expiration (seconds) |
| `USE_PRESIGNED_URLS` | `true` | Enable S3 presigned URLs |
| `SECRET_ARN` | `<secret-arn>` | Secrets Manager ARN |
| `NODE_ENV` | `production` | Node.js environment |
| `LOG_LEVEL` | `info` | Application log level |

**Runtime Variables** (Set by run.js from Secrets Manager):
- `QUIP_TOKEN`: Extracted from secret
- `MCP_API_KEY`: Extracted from secret (if available)
- `QUIP_BASE_URL`: Extracted from secret (if available)

## Testing the Deployment

### AWS IAM Authentication

The deployed MCP server uses AWS IAM authentication. You'll need to:

1. **Configure AWS Credentials**: Ensure your AWS CLI or SDK is configured with appropriate permissions
2. **Use AWS Signature Version 4**: All requests must be signed using AWS SigV4
3. **Access via AWS SDK**: Use AWS Bedrock Agent Runtime SDK or direct HTTP calls with proper signing

### Using AWS CLI to Test

```bash
# Get agent runtime status
aws bedrock-agent-core-control describe-agent-runtime \
  --agent-runtime-arn "arn:aws:bedrock-agent-core:us-west-2:123456789012:runtime/quip_mcp_server_xyz123" \
  --region us-west-2

# Test MCP endpoint (requires proper IAM permissions)
aws bedrock-agent-runtime invoke-agent \
  --agent-id "your-agent-id" \
  --agent-alias-id "your-alias-id" \
  --session-id "test-session" \
  --input-text "list available tools" \
  --region us-west-2
```

### Using MCP Inspector with AWS Authentication

```bash
# Install MCP Inspector
npx @modelcontextprotocol/inspector

# Note: MCP Inspector requires custom AWS IAM authentication setup
# Configure your AWS credentials before accessing the endpoint
```

## Stack Outputs

| Output | Description |
|--------|-------------|
| `AgentRuntimeArn` | ARN of the created Agent Core Runtime |
| `AgentRuntimeId` | ID of the Agent Core Runtime |
| `McpInvocationEndpoint` | Complete URL for MCP client connections |
| `EcrRepositoryUri` | ECR repository URI for the container image |
| `S3BucketName` | Name of the S3 bucket for data storage |
| `AgentCoreRoleArn` | ARN of the IAM execution role |

## Monitoring and Logs

- **CloudWatch Logs**: Automatically configured for application logs
- **Agent Runtime Status**: Check via AWS Console or CLI
- **Container Health**: Built-in health checks

```bash
# Check agent runtime status
aws bedrock-agent-core-control list-agent-runtimes --region us-west-2

# Get specific runtime details
aws bedrock-agent-core-control describe-agent-runtime \
  --agent-runtime-arn "arn:aws:bedrock-agent-core:us-west-2:123456789012:runtime/quip_mcp_server_xyz123"
```

## Troubleshooting

### Common Issues

1. **Container Build Failures**
   - Ensure Docker is running and has build-x support
   - Check platform architecture: `docker build-x ls`
   - Verify all dependencies are installed (including @aws-sdk/client-secrets-manager)

2. **Permission Errors**
   - Verify IAM permissions for CDK deployment
   - Check Agent Core Runtime service permissions
   - Ensure secrets manager permissions are correctly configured

3. **Secret Not Found**
   - Ensure Secrets Manager secret exists in the correct region
   - Verify secret ARN matches the configuration
   - Check secret format is valid JSON or plain text

4. **MCP Connection Failures**
   - Check AWS IAM permissions for bedrock-agent-core service
   - Verify endpoint URL encoding
   - Confirm agent runtime status is "READY"
   - Ensure AWS credentials are properly configured
   - Validate MCP_API_KEY if authentication is enabled

5. **Deployment Update Issues**
   - Stack now uses updateAgentRuntime for updates (not create)
   - Check agent runtime ID consistency during updates
   - Verify container image updates are properly applied

6. **Missing Dependencies**
   - Error: "Cannot find module '@aws-sdk/client-secrets-manager'"
   - Solution: Dependency is now included in package.json
   - Rebuild container if using cached images

### Debug Commands

```bash
# View CDK diff before deployment
npx cdk diff

# Synthesize CloudFormation template
npx cdk synth

# View stack events
aws cloudformation describe-stack-events --stack-name QuipMcpAgentCoreStack

# Check agent runtime logs
aws logs describe-log-groups --log-group-name-prefix "/aws/bedrock-agent-core"
```

## Cleanup

To remove all resources:

```bash
npx cdk destroy
```

This will delete:
- Agent Core Runtime
- ECR repository and images
- IAM roles and policies
- S3 bucket (if created by the stack)

**Note**: Secrets Manager secrets are not automatically deleted and may incur charges.

## Cost Optimization

- **Container Images**: Lifecycle policies automatically clean up old images
- **S3 Storage**: 180-day expiration policy for data files
- **Consumption Pricing**: Pay only for actual runtime usage
- **Session Isolation**: Automatic resource cleanup after sessions

## Security Features

- **IAM Least Privilege**: Minimal required permissions with specific resource ARNs
- **VPC Isolation**: Optional VPC deployment support
- **Encrypted Storage**: S3 server-side encryption
- **Secret Management**: AWS Secrets Manager integration with automatic retrieval
- **Container Security**: Image vulnerability scanning enabled
- **Workload Identity**: Secure authentication using Agent Core Runtime workload identity
- **Service Principal Conditions**: Strict IAM assume role conditions with source account/ARN validation
- **Secret Extraction**: Multiple fallback mechanisms for secret format compatibility
- **Process Isolation**: Dedicated microVM execution environment

## Implementation Details

### Secret Handling Architecture

The deployment uses a two-stage secret handling approach:

1. **Build Time**: CDK deploys the infrastructure with SECRET_ARN environment variable
2. **Runtime**: The run.js wrapper script:
   - Retrieves secrets from AWS Secrets Manager
   - Supports multiple secret formats (JSON, plain text)
   - Sets environment variables before starting the MCP server
   - Handles graceful fallbacks for different key naming conventions

### Container Structure

```
/app/
├── dist/           # Compiled TypeScript code
├── run.js          # Secret management wrapper
├── package.json    # Dependencies including AWS SDK
└── node_modules/   # Production dependencies only
```

### Update Behavior

The CDK stack is designed for safe updates:
- Uses `updateAgentRuntime` instead of `createAgentRuntime` for re-deployments
- Maintains physical resource ID consistency
- Supports in-place container image updates
- Comprehensive error handling for rollback scenarios