#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LambdaOpenaiWebSearchStack } from '../lib/lambda-openai-web-search-stack';

const app = new cdk.App();
new LambdaOpenaiWebSearchStack(app, 'LambdaOpenaiWebSearchStack8', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
});