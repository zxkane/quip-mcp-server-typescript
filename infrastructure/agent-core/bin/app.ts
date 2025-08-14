#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { QuipMcpAgentCoreStack, QuipMcpAgentCoreStackProps } from '../lib/quip-mcp-agent-core-stack';

const app = new cdk.App();

// Get required parameters from CDK context
const secretARN = app.node.tryGetContext('secretARN');
const agentRuntimeName = app.node.tryGetContext('agentRuntimeName');
const s3BucketName = app.node.tryGetContext('s3BucketName');

// Validate required parameters
if (!secretARN) {
  throw new Error('secretARN context parameter is required. Pass it via --context secretARN=<arn>');
}

// Validate agentRuntimeName if provided
if (agentRuntimeName !== undefined && agentRuntimeName !== null) {
  if (typeof agentRuntimeName !== 'string' || agentRuntimeName.trim() === '') {
    throw new Error('agentRuntimeName must be a non-empty string');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(agentRuntimeName)) {
    throw new Error('agentRuntimeName must contain only letters, numbers, and underscores (pattern: a-zA-Z0-9_)');
  }
}

// Validate s3BucketName if provided
if (s3BucketName !== undefined && s3BucketName !== null) {
  if (typeof s3BucketName !== 'string' || s3BucketName.trim() === '') {
    throw new Error('s3BucketName must be a non-empty string');
  }
}

// Stack configuration
const stackProps: QuipMcpAgentCoreStackProps = {
  description: 'Quip MCP Server deployment to AWS Agent Core Runtime',
  secretARN: secretARN,
  agentRuntimeName: agentRuntimeName,
  s3BucketName: s3BucketName,
  tags: {
    Project: 'QuipMcpServer',
    Environment: 'production',
    DeploymentType: 'AgentCoreRuntime'
  }
};

// Create the Agent Core Runtime stack
new QuipMcpAgentCoreStack(app, 'QuipMcpAgentCoreStack', stackProps);

// Add standard CDK tags
cdk.Tags.of(app).add('CreatedBy', 'CDK');
cdk.Tags.of(app).add('Repository', 'quip-mcp-server-typescript');