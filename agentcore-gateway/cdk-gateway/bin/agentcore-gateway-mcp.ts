#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AgentCoreGatewayLambdaMCPStack } from '../lib/agentcore-gateway-mcp-stack';

const app = new cdk.App();
new AgentCoreGatewayLambdaMCPStack(app, 'AgentCoreGatewayLambdaMCPStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
});
