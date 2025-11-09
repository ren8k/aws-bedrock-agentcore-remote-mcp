#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import * as dotenv from 'dotenv';
import { AgentcoreRuntimeMcpStack } from '../lib/agentcore-runtime-mcp-stack';

// Load environment variables from .env file
dotenv.config();

const app = new cdk.App();

new AgentcoreRuntimeMcpStack(app, 'AgentcoreRuntimeMcpStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  openaiApiKey: process.env.OPENAI_API_KEY || '',
});
