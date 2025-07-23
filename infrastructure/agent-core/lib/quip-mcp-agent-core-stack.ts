import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export interface QuipMcpAgentCoreStackProps extends cdk.StackProps {
  /**
   * Name of the Agent Core Runtime to create
   * @default 'quip-mcp-server'
   */
  readonly agentRuntimeName?: string;
  
  /**
   * S3 bucket name for Quip data storage
   * If not provided, will try to reference existing bucket or create new one
   */
  readonly s3BucketName?: string;
  
  /**
   * S3 key prefix for Quip data
   * @default 'quip-data/'
   */
  readonly s3Prefix?: string;
  
  /**
   * Secrets Manager secret ARN for Quip credentials
   * Must be a complete ARN in format: arn:aws:secretsmanager:region:account:secret:name
   */
  readonly secretARN: string;
}

export class QuipMcpAgentCoreStack extends cdk.Stack {
  public readonly agentRuntimeArn: string;
  public readonly agentRole: iam.Role;
  
  /**
   * Recursively get all files in a directory with specified extensions
   */
  private getAllFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getAllFiles(fullPath, extensions));
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }
  
  constructor(scope: Construct, id: string, props: QuipMcpAgentCoreStackProps) {
    super(scope, id, props);

    // Configuration
    const agentRuntimeName = props.agentRuntimeName || 'quip_mcp_server';
    const s3Prefix = props.s3Prefix || 'quip-data/';
    const secretARN = props.secretARN;


    // Reference or create S3 bucket for data storage
    let s3Bucket: s3.IBucket;
    if (props.s3BucketName) {
      // Reference existing bucket
      s3Bucket = s3.Bucket.fromBucketName(this, 'QuipDataBucket', props.s3BucketName);
    } else {
      // Create new bucket
      s3Bucket = new s3.Bucket(this, 'QuipDataBucket', {
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        lifecycleRules: [
          {
            id: 'QuipDataExpiration',
            expiration: cdk.Duration.days(180),
          },
        ],
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });
    }

    // Reference Secrets Manager secret for Quip credentials
    const quipSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this, 
      'QuipMcpSecrets', 
      secretARN
    );

    // Create IAM role for Agent Core Runtime
    // This role follows the official AWS documentation requirements
    this.agentRole = new iam.Role(this, 'QuipMcpAgentCoreRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: {
          StringEquals: {
            'aws:SourceAccount': this.account,
          },
          ArnLike: {
            'aws:SourceArn': `arn:${this.partition}:bedrock-agentcore:${this.region}:${this.account}:*`,
          },
        },
      }),
      description: 'IAM role for Quip MCP Server running in Agent Core Runtime - follows AWS documentation',
      inlinePolicies: {
        QuipMcpAgentCorePolicy: new iam.PolicyDocument({
          statements: [
            // ECR Image Access - Required for container image pulls
            new iam.PolicyStatement({
              sid: 'ECRImageAccess',
              effect: iam.Effect.ALLOW,
              actions: [
                'ecr:BatchGetImage',
                'ecr:GetDownloadUrlForLayer',
              ],
              resources: [
                `arn:${this.partition}:ecr:${this.region}:${this.account}:repository/*`,
              ],
            }),
            // ECR Token Access - Required for ECR authentication
            new iam.PolicyStatement({
              sid: 'ECRTokenAccess',
              effect: iam.Effect.ALLOW,
              actions: [
                'ecr:GetAuthorizationToken',
              ],
              resources: ['*'],
            }),
            // CloudWatch Logs - Required for Agent Core Runtime logging
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:DescribeLogStreams',
                'logs:CreateLogGroup',
              ],
              resources: [
                `arn:${this.partition}:logs:${this.region}:${this.account}:log-group:/aws/bedrock-agentcore/runtimes/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:DescribeLogGroups',
              ],
              resources: [
                `arn:${this.partition}:logs:${this.region}:${this.account}:log-group:*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: [
                `arn:${this.partition}:logs:${this.region}:${this.account}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*`,
              ],
            }),
            // X-Ray Tracing - Required for Agent Core Runtime observability
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'xray:PutTraceSegments',
                'xray:PutTelemetryRecords',
                'xray:GetSamplingRules',
                'xray:GetSamplingTargets',
              ],
              resources: ['*'],
            }),
            // CloudWatch Metrics - Required for Agent Core Runtime monitoring
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudwatch:PutMetricData',
              ],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'cloudwatch:namespace': 'bedrock-agentcore',
                },
              },
            }),
            // Agent Core Runtime Workload Identity - Required for authentication
            new iam.PolicyStatement({
              sid: 'GetAgentAccessToken',
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock-agentcore:GetWorkloadAccessToken',
                'bedrock-agentcore:GetWorkloadAccessTokenForJWT',
                'bedrock-agentcore:GetWorkloadAccessTokenForUserId',
              ],
              resources: [
                `arn:${this.partition}:bedrock-agentcore:${this.region}:${this.account}:workload-identity-directory/default`,
                `arn:${this.partition}:bedrock-agentcore:${this.region}:${this.account}:workload-identity-directory/default/workload-identity/${agentRuntimeName}-*`,
              ],
            }),
            // Bedrock Model Invocation - Required for AI model access
            new iam.PolicyStatement({
              sid: 'BedrockModelInvocation',
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ],
              resources: [
                `arn:${this.partition}:bedrock:*::foundation-model/*`,
                `arn:${this.partition}:bedrock:${this.region}:${this.account}:*`,
              ],
            }),
            // S3 permissions for data storage - Application specific
            new iam.PolicyStatement({
              sid: 'S3DataStorage',
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket',
              ],
              resources: [
                s3Bucket.bucketArn,
                `${s3Bucket.bucketArn}/${s3Prefix}*`,
              ],
            }),
            // Secrets Manager permissions - Application specific
            new iam.PolicyStatement({
              sid: 'SecretsManagerAccess',
              effect: iam.Effect.ALLOW,
              actions: [
                'secretsmanager:GetSecretValue',
                'secretsmanager:DescribeSecret',
              ],
              resources: [quipSecret.secretArn],
            }),
          ],
        }),
      },
    });

    // Calculate hash of critical source files to ensure Docker rebuilds on changes
    // This addresses the issue where CDK doesn't automatically detect changes to certain files
    // like infrastructure/api-gateway-lambda/lambda/run.js that are copied into the Docker image
    const projectRoot = path.join(__dirname, '../../..');
    const criticalFiles = [
      'infrastructure/api-gateway-lambda/lambda/run.js', // Lambda runtime wrapper script
      'Dockerfile.agent-core',                           // Docker build configuration
      'package.json',                                   // Dependencies and scripts
      'tsconfig.json',                                  // TypeScript configuration
    ];
    
    let combinedHash = '';
    console.log('Calculating source file hashes for Docker rebuild detection...');
    
    for (const file of criticalFiles) {
      const filePath = path.join(projectRoot, file);
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          combinedHash += hash;
          console.log(`File ${file} hash: ${hash.substring(0, 8)}...`);
        }
      } catch (error) {
        console.warn(`Warning: Could not read file ${file} for hash calculation:`, error);
      }
    }
    
    // Also include src directory files hash (recursive)
    // This ensures any changes to the main application code trigger rebuilds
    const srcDir = path.join(projectRoot, 'src');
    if (fs.existsSync(srcDir)) {
      const srcFiles = this.getAllFiles(srcDir, ['.ts', '.js', '.json']);
      console.log(`Including ${srcFiles.length} source files in hash calculation`);
      for (const file of srcFiles) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          combinedHash += hash;
        } catch (error) {
          console.warn(`Warning: Could not read src file ${file} for hash calculation:`, error);
        }
      }
    }
    
    const finalHash = crypto.createHash('sha256').update(combinedHash).digest('hex');
    console.log(`Combined source files hash: ${finalHash.substring(0, 16)}... (will force Docker rebuild on changes)`);

    // Build and push Docker image to ECR
    const dockerImageAsset = new DockerImageAsset(this, 'QuipMcpDockerImage', {
      directory: projectRoot,
      file: 'Dockerfile.agent-core',
      platform: Platform.LINUX_ARM64,
      exclude: [
        'node_modules',
        'coverage',
        'test*',
        '*.test.ts',
        '*.spec.ts',
        '.git',
        'README.md',
        'infrastructure/',
        '!infrastructure/api-gateway-lambda/lambda/run.js',
        'temp',
        'example-client',
        'memory-bank',
      ],
      // Force rebuild when critical source files change
      extraHash: finalHash,
    });

    // Custom resource policy for Agent Core Runtime operations
    // This Lambda needs explicit permissions to manage Agent Core Runtime
    const agentCorePolicy = cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          sid: 'AgentCoreRuntimeManagement',
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock-agentcore:CreateAgentRuntime',
            'bedrock-agentcore:CreateAgentRuntimeEndpoint',
            'bedrock-agentcore:UpdateAgentRuntime',
            'bedrock-agentcore:UpdateAgentRuntimeEndpoint', 
            'bedrock-agentcore:DeleteAgentRuntime',
            'bedrock-agentcore:DeleteAgentRuntimeEndpoint',
            'bedrock-agentcore:GetAgentRuntime',
            'bedrock-agentcore:GetAgentRuntimeEndpoint',
            'bedrock-agentcore:DescribeAgentRuntime',
            'bedrock-agentcore:ListAgentRuntimes',
            'bedrock-agentcore:ListAgentRuntimeEndpoints',
            // Workload Identity management - Required for Agent Core Runtime creation
            'bedrock-agentcore:CreateWorkloadIdentity',
            'bedrock-agentcore:DeleteWorkloadIdentity',
            'bedrock-agentcore:GetWorkloadIdentity',
            'bedrock-agentcore:UpdateWorkloadIdentity',
            'bedrock-agentcore:ListWorkloadIdentities',
          ],
          resources: [
            `arn:${this.partition}:bedrock-agentcore:${this.region}:${this.account}:*`,
            `arn:${this.partition}:bedrock-agentcore:${this.region}:${this.account}:runtime/*`,
            `arn:${this.partition}:bedrock-agentcore:${this.region}:${this.account}:workload-identity-directory/*`,
          ],
        }),
        // IAM pass role permissions for the Agent Core execution role
        new iam.PolicyStatement({
          sid: 'AgentCorePassRole',
          effect: iam.Effect.ALLOW,
          actions: [
            'iam:PassRole',
          ],
          resources: [this.agentRole.roleArn],
          conditions: {
            StringEquals: {
              'iam:PassedToService': 'bedrock-agentcore.amazonaws.com',
            },
          },
        }),
        // ECR permissions to validate container images
        new iam.PolicyStatement({
          sid: 'ECRValidateImages',
          effect: iam.Effect.ALLOW,
          actions: [
            'ecr:DescribeImages',
            'ecr:DescribeRepositories',
          ],
          resources: [
            `arn:${this.partition}:ecr:${this.region}:${this.account}:repository/*`,
          ],
        }),
      ]);

    // Shared configuration for Agent Core Runtime parameters
    const commonDescription = 'Quip MCP Server deployed to Agent Core Runtime';
    
    const commonAgentRuntimeArtifact = {
      containerConfiguration: {
        containerUri: dockerImageAsset.imageUri,
      },
    };
    
    const commonNetworkConfiguration = {
      networkMode: 'PUBLIC',
    };
    
    const commonProtocolConfiguration = {
      serverProtocol: 'MCP',
    };
    
    const commonRoleArn = this.agentRole.roleArn;
    
    // Base environment variables (common to both create and update)
    const baseEnvironmentVariables = {
      // MCP Configuration
      MCP_PORT: '8000',
      MCP_AUTH_ENABLED: 'false',
      MCP_SSE_ENABLED: 'false',  // Enable SSE format for responses
      
      // Storage Configuration
      STORAGE_TYPE: 's3',
      S3_BUCKET: s3Bucket.bucketName,
      S3_REGION: this.region,
      S3_PREFIX: s3Prefix,
      S3_URL_EXPIRATION: '3600',
      USE_PRESIGNED_URLS: 'true',
      
      // Secrets Configuration
      SECRET_ARN: quipSecret.secretArn,
      
      // Runtime Configuration
      NODE_ENV: 'production',
      LOG_LEVEL: 'debug',
      AWS_REGION: this.region,
    };

    // Create Agent Core Runtime using AwsCustomResource with enhanced rollback handling
    const agentRuntime = new cr.AwsCustomResource(this, 'QuipMcpAgentRuntime', {
      onCreate: {
        service: 'bedrock-agentcore-control',
        action: 'createAgentRuntime',
        parameters: {
          agentRuntimeName: agentRuntimeName,
          description: commonDescription,
          agentRuntimeArtifact: commonAgentRuntimeArtifact,
          networkConfiguration: commonNetworkConfiguration,
          protocolConfiguration: commonProtocolConfiguration,
          roleArn: commonRoleArn,
          environmentVariables: {
            ...baseEnvironmentVariables,
          },
        },
        physicalResourceId: cr.PhysicalResourceId.fromResponse('agentRuntimeId'),
      },
      onUpdate: {
        service: 'bedrock-agentcore-control',
        action: 'updateAgentRuntime',
        parameters: {
          agentRuntimeId: new cr.PhysicalResourceIdReference(),
          description: commonDescription,
          roleArn: commonRoleArn,
          agentRuntimeArtifact: commonAgentRuntimeArtifact,
          networkConfiguration: commonNetworkConfiguration,
          protocolConfiguration: commonProtocolConfiguration,
          environmentVariables: {
            ...baseEnvironmentVariables,
          },
        },
        physicalResourceId: cr.PhysicalResourceId.fromResponse('agentRuntimeId'),
      },
      onDelete: {
        service: 'bedrock-agentcore-control',
        action: 'deleteAgentRuntime',
        parameters: {
          agentRuntimeId: new cr.PhysicalResourceIdReference(),
        },
        // Comprehensive error handling for rollback scenarios
        // This prevents rollback failures when Agent Core Runtime creation fails or when resources don't exist
        ignoreErrorCodesMatching: 'ValidationException|InvalidParameterException|ResourceNotFoundException|BadRequestException|ConflictException|InternalServerException|.*agentRuntimeId.*|.*not.*found.*|.*does.*not.*exist.*',
      },
      policy: agentCorePolicy,
      timeout: cdk.Duration.minutes(10),
      installLatestAwsSdk: true, // Use the latest SDK version in the Lambda runtime for support agent core operations
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
      resourceType: 'Custom::QuipMcpAgentCoreRuntime',
    });

    // Add dependency to ensure image is built before creating runtime
    agentRuntime.node.addDependency(dockerImageAsset);
    agentRuntime.node.addDependency(this.agentRole);

    // Store the agent runtime ARN for use in other constructs
    this.agentRuntimeArn = agentRuntime.getResponseField('agentRuntimeArn');

    // Create outputs for easy reference
    new cdk.CfnOutput(this, 'AgentRuntimeArn', {
      value: this.agentRuntimeArn,
      description: 'ARN of the created Agent Core Runtime',
      exportName: `${this.stackName}-AgentRuntimeArn`,
    });

    new cdk.CfnOutput(this, 'AgentRuntimeId', {
      value: agentRuntime.getResponseField('agentRuntimeId'),
      description: 'ID of the created Agent Core Runtime',
      exportName: `${this.stackName}-AgentRuntimeId`,
    });


    new cdk.CfnOutput(this, 'S3BucketName', {
      value: s3Bucket.bucketName,
      description: 'Name of the S3 bucket for data storage',
      exportName: `${this.stackName}-S3Bucket`,
    });

    new cdk.CfnOutput(this, 'AgentCoreRoleArn', {
      value: this.agentRole.roleArn,
      description: 'ARN of the Agent Core Runtime execution role',
      exportName: `${this.stackName}-RoleArn`,
    });

    // MCP Invocation endpoint URL
    // encoded_arn = agent_arn.replace(':', '%3A').replace('/', '%2F')
    const colonReplaced = cdk.Fn.join('%3A', cdk.Fn.split(':', this.agentRuntimeArn));
    const encodedArn = cdk.Fn.join('%2F', cdk.Fn.split('/', colonReplaced));

    new cdk.CfnOutput(this, 'McpInvocationEndpoint', {
      value: `https://bedrock-agentcore.${this.region}.amazonaws.com/runtimes/${encodedArn}/invocations?qualifier=DEFAULT`,
      description: 'MCP Invocation endpoint URL for the deployed agent',
      exportName: `${this.stackName}-McpEndpoint`,
    });
  }
}