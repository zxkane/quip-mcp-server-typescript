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

## Getting Started

Choose the deployment method that best fits your needs and follow the instructions in the respective directory's README.md file.

For most users, the **API Gateway + Lambda** deployment is recommended as it provides a serverless, scalable solution with minimal operational overhead.