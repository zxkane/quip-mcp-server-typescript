import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { LayerVersion } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { DockerImage } from 'aws-cdk-lib';

export class QuipMcpServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket for storing Quip data
    const bucket = new s3.Bucket(this, 'QuipMcpStorage', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(180),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Secrets Manager secret for storing sensitive information
    const quipSecret = secretsmanager.Secret.fromSecretNameV2(this, 'QuipMcpSecrets', 'quip-mcp-server/secrets');

    const s3_prefix = 'quip-data/';
    // Create Lambda function
    const lambdaFunction = new lambda.Function(this, 'QuipMcpServerFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      layers: [
        LayerVersion.fromLayerVersionArn(this, 'aws-lambda-web-adapter-layer', `arn:aws:lambda:${this.region}:753240598075:layer:LambdaAdapterLayerArm64:24`),
      ],
      code: lambda.Code.fromAsset(path.resolve(__dirname, '../../../'), {
        bundling: {
          image: DockerImage.fromRegistry('public.ecr.aws/docker/library/node:latest'),
          command: [
            'bash', '-c', [
              'npm ci',
              'npm run build',
              'cp -r dist/* /asset-output/',
              'cp -r node_modules /asset-output/',
              'cp package.json /asset-output/',
              'cp infrastructure/cdk/lambda/run.js /asset-output/',
            ].join(' && ')
          ],
          platform: '--linux/arm64',
        },
      }),
      handler: 'run.js',
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/bootstrap',
        STORAGE_TYPE: 's3',
        S3_BUCKET: bucket.bucketName,
        S3_REGION: this.region,
        S3_PREFIX: s3_prefix,
        USE_PRESIGNED_URLS: 'true',
        S3_URL_EXPIRATION: '3600',
        MCP_PORT: '8080',
        MCP_AUTH_ENABLED: 'true',
        MCP_API_KEY_HEADER: 'X-API-Key',
        MCP_SSE_ENABLED: 'false',  // Can be set to 'true' to enable SSE format
        SECRET_ARN: quipSecret.secretArn,
      },
    });

    // Grant Lambda function access to S3 bucket
    bucket.grantReadWrite(lambdaFunction, `${s3_prefix}*`);

    // Grant Lambda function access to Secrets Manager
    quipSecret.grantRead(lambdaFunction);

    // Create REST API Gateway
    const api = new apigateway.RestApi(this, 'QuipMcpApi', {
      restApiName: 'Quip MCP Server API',
      description: 'API Gateway for Quip MCP Server',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-API-Key'],
      },
    });

    // Add Lambda integration to API Gateway
    const mcpResource = api.root.addResource('mcp');
    const mcpIntegration = new apigateway.LambdaIntegration(lambdaFunction);
    mcpResource.addMethod('POST', mcpIntegration, {
      apiKeyRequired: true,
    });

    // Create API key and usage plan
    const apiKey = new apigateway.ApiKey(this, 'QuipMcpApiKey', {
      apiKeyName: 'QuipMcpServerApiKey',
      description: 'API Key for Quip MCP Server',
    });

    const usagePlan = new apigateway.UsagePlan(this, 'QuipMcpUsagePlan', {
      name: 'QuipMcpServerUsagePlan',
      apiStages: [
        {
          api: api,
          stage: api.deploymentStage,
        },
      ],
    });

    usagePlan.addApiKey(apiKey);

    // Output the API Gateway URL
    new cdk.CfnOutput(this, 'MCP Server Endpoint', {
      value: `${api.url}mcp`,
      description: 'URL of the API Gateway endpoint',
    });

    // Output the API key ID (to be retrieved from AWS Console or CLI)
    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'ID of the API key (retrieve value from AWS Console or CLI)',
    });
  }
}