#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as dotenv from 'dotenv';
import { AgentCoreGatewayLambdaMCPStack } from '../lib/agentcore-gateway-mcp-stack';

// Load environment variables from .env file
dotenv.config();

const app = new cdk.App();

new AgentCoreGatewayLambdaMCPStack(app, 'AgentCoreGatewayLambdaMCPStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  gatewayTargetName: 'LambdaTarget',
});
