#!/bin/bash
#
# Deployment script for Quip MCP Server Agent Core Runtime
#
# Usage: ./deploy.sh [options]
#
# Options:
#   --agent-name <name>     Agent runtime name (default: quip_mcp_server)
#   --s3-bucket <bucket>    Existing S3 bucket name (optional, will create new if not specified)
#   --secret-arn <arn>      Secrets Manager secret ARN (required)
#   --region <region>       AWS region (default: us-west-2)
#   --profile <profile>     AWS profile to use (optional)
#   --skip-build           Skip npm install and build steps
#   --dry-run              Show what would be deployed without actually deploying
#   --help                 Show this help message

set -e

# Default values
AGENT_NAME="quip_mcp_server"
SECRET_ARN=""
REGION="us-west-2"
SKIP_BUILD=false
DRY_RUN=false
S3_BUCKET=""
AWS_PROFILE=""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show help
show_help() {
    cat << EOF
Deployment script for Quip MCP Server Agent Core Runtime

Usage: $0 [options]

Options:
  --agent-name <name>     Agent runtime name (default: quip_mcp_server)
  --s3-bucket <bucket>    Existing S3 bucket name (optional, will create new if not specified)
  --secret-arn <arn>      Secrets Manager secret ARN (required)
  --region <region>       AWS region (default: us-west-2)
  --profile <profile>     AWS profile to use (optional)
  --skip-build           Skip npm install and build steps
  --dry-run              Show what would be deployed without actually deploying
  --help                 Show this help message

Examples:
  $0                                          # Deploy with defaults
  $0 --agent-name my-agent --region us-east-1 # Deploy with custom name and region
  $0 --dry-run                                # Preview deployment
  $0 --s3-bucket existing-bucket              # Use existing S3 bucket

Prerequisites:
  - AWS CLI configured with appropriate permissions
  - Docker installed and running
  - Node.js 18+ and npm installed
  - aws-cdk installed as dependency (included in package.json)

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --agent-name)
            AGENT_NAME="$2"
            shift 2
            ;;
        --s3-bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        --secret-arn)
            SECRET_ARN="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --profile)
            AWS_PROFILE="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set AWS profile if specified
if [[ -n "$AWS_PROFILE" ]]; then
    export AWS_PROFILE="$AWS_PROFILE"
    print_status "Using AWS profile: $AWS_PROFILE"
fi

# Set AWS region
export AWS_DEFAULT_REGION="$REGION"
export CDK_DEFAULT_REGION="$REGION"

print_status "Starting deployment with the following configuration:"
echo "  Agent Name: $AGENT_NAME"
echo "  Region: $REGION"
echo "  Secret ARN: $SECRET_ARN"
if [[ -n "$S3_BUCKET" ]]; then
    echo "  S3 Bucket: $S3_BUCKET"
else
    echo "  S3 Bucket: (will create new)"
fi
if [[ -n "$AWS_PROFILE" ]]; then
    echo "  AWS Profile: $AWS_PROFILE"
fi
echo

# Check prerequisites
print_status "Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install it first."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npx is available (comes with Node.js)
if ! command -v npx &> /dev/null; then
    print_error "npx not found. Please install Node.js which includes npx."
    exit 1
fi

# Verify AWS credentials
print_status "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or invalid. Please run 'aws configure' first."
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
print_success "AWS credentials verified. Account: $AWS_ACCOUNT"

# Validate secret ARN is provided
if [[ -z "$SECRET_ARN" ]]; then
    print_error "Secret ARN is required. Please specify --secret-arn parameter."
    echo "Example: --secret-arn arn:aws:secretsmanager:us-west-2:123456789012:secret:quip-mcp-server/secrets-AbCdEf"
    exit 1
fi

# Check if secrets exist
print_status "Checking if Secrets Manager secret exists..."
if aws secretsmanager describe-secret --secret-id "$SECRET_ARN" --region "$REGION" &> /dev/null; then
    print_success "Secrets Manager secret found."
else
    print_warning "Secrets Manager secret not found or not accessible."
    echo "Please ensure the secret ARN is correct and the secret exists:"
    echo "  Secret ARN: $SECRET_ARN"
    echo
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if S3 bucket exists (if specified)
if [[ -n "$S3_BUCKET" ]]; then
    print_status "Checking if S3 bucket exists..."
    if aws s3 ls "s3://$S3_BUCKET" &> /dev/null; then
        print_success "S3 bucket '$S3_BUCKET' found."
    else
        print_error "S3 bucket '$S3_BUCKET' not found or not accessible."
        exit 1
    fi
fi

# Navigate to the infrastructure directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Install dependencies and build
if [[ "$SKIP_BUILD" == false ]]; then
    print_status "Installing dependencies..."
    npm install
    
    print_status "Building TypeScript..."
    npm run build
else
    print_status "Skipping build steps as requested."
fi

# Bootstrap CDK if needed
print_status "Checking if CDK is bootstrapped..."
BOOTSTRAP_STACK_NAME="CDKToolkit"
if ! aws cloudformation describe-stacks --stack-name "$BOOTSTRAP_STACK_NAME" --region "$REGION" &> /dev/null; then
    print_status "CDK not bootstrapped. Bootstrapping now..."
    npx cdk bootstrap --region "$REGION"
    print_success "CDK bootstrapped successfully."
else
    print_success "CDK already bootstrapped."
fi

# Prepare CDK command
CDK_CMD="npx cdk"
if [[ "$DRY_RUN" == true ]]; then
    CDK_CMD="$CDK_CMD synth"
    print_status "Dry run mode: Synthesizing CloudFormation template..."
else
    CDK_CMD="$CDK_CMD deploy"
    print_status "Deploying to AWS..."
fi

# Add context parameters
CDK_CMD="$CDK_CMD --context agentRuntimeName=$AGENT_NAME"
CDK_CMD="$CDK_CMD --context secretARN=$SECRET_ARN"
CDK_CMD="$CDK_CMD --context region=$REGION"

if [[ -n "$S3_BUCKET" ]]; then
    CDK_CMD="$CDK_CMD --context s3BucketName=$S3_BUCKET"
fi

# Add deployment parameters
if [[ "$DRY_RUN" == false ]]; then
    CDK_CMD="$CDK_CMD --require-approval never"
    CDK_CMD="$CDK_CMD --region $REGION"
fi

# Execute CDK command
echo "Executing: $CDK_CMD"
echo
eval "$CDK_CMD"

if [[ $? -eq 0 ]]; then
    if [[ "$DRY_RUN" == true ]]; then
        print_success "Dry run completed successfully!"
        echo "Review the synthesized template above to see what would be deployed."
    else
        print_success "Deployment completed successfully!"
        echo
        print_status "Deployment Summary:"
        echo "  Agent Runtime Name: $AGENT_NAME"
        echo "  Region: $REGION"
        echo "  Secret ARN: $SECRET_ARN"
        echo
        print_status "Next Steps:"
        echo "1. Note the AgentRuntimeArn from the outputs above"
        echo "2. Set up OAuth authentication (if not already done)"
        echo "3. Test the deployment using the MCP client or inspector"
        echo "4. Monitor logs in CloudWatch"
        echo
        print_status "Useful Commands:"
        echo "  # List agent runtimes"
        echo "  aws bedrock-agentcore-control list-agent-runtimes --region $REGION"
        echo
        echo "  # Check agent runtime status"
        echo "  aws bedrock-agentcore-control describe-agent-runtime --agent-runtime-arn <ARN>"
        echo
        echo "  # View logs"
        echo "  aws logs describe-log-groups --log-group-name-prefix '/aws/bedrock-agentcore'"
    fi
else
    print_error "Deployment failed!"
    exit 1
fi