#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AgentcoreRuntimeMcpStack } from '../lib/agentcore-runtime-mcp-stack';

const app = new cdk.App();
new AgentcoreRuntimeMcpStack(app, 'AgentcoreRuntimeMcpStack3', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
});
