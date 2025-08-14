# Quip MCP Server - AWS Deployment Options

This directory contains different deployment options for running the Quip MCP Server on AWS.

## Available Deployment Methods

### API Gateway + Lambda
- **Directory**: `api-gateway-lambda/`
- **Description**: Deploy the MCP server as an AWS Lambda function behind API Gateway
- **Use Case**: Serverless deployment with automatic scaling and pay-per-request pricing
- **Features**:
  - HTTP endpoint accessible via API Gateway
  - Automatic scaling based on demand
  - Integration with AWS services (S3, Secrets Manager)
  - API key authentication
  - Cost-effective for variable workloads

### Agent Core Runtime
- **Directory**: `agent-core/`
- **Description**: Deploy the MCP server as a containerized application on AWS Agent Core Runtime
- **Use Case**: Advanced AI agent hosting with enhanced capabilities and session isolation
- **Features**:
  - Extended execution time (up to 8 hours)
  - Large payload support (100MB)
  - Dedicated microVM session isolation
  - Built-in OAuth authentication
  - Enhanced observability and tracing
  - Consumption-based pricing
  - ARM64 container deployment

## Getting Started

Choose the deployment method that best fits your needs and follow the instructions in the respective directory's README.md file.

### Comparison

| Feature | API Gateway + Lambda | Agent Core Runtime |
|---------|---------------------|-------------------|
| **Execution Time** | 15 minutes max | 8 hours max |
| **Payload Size** | 6MB max | 100MB max |
| **Cold Start** | Yes | Minimal (dedicated sessions) |
| **Session Isolation** | Process-level | MicroVM-level |
| **Authentication** | API Key | OAuth + Identity Integration |
| **Pricing Model** | Pay-per-request | Consumption-based |
| **Best For** | Simple integrations | Complex AI workflows |

### Recommendations

- **API Gateway + Lambda**: Recommended for most users who need a simple, cost-effective serverless deployment
- **Agent Core Runtime**: Recommended for advanced use cases requiring long-running sessions, large payloads, or enhanced security isolation