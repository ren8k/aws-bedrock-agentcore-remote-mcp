import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import { Construct } from "constructs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

export class LambdaOpenaiWebSearchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const gatewayName = `AgentCoreGateway-${cdk.Names.uniqueId(this).toLowerCase().slice(-8)}`;
    const gatewayTargetName = "AgentCoreGatewayTarget";

    // Lambda Layer for dependencies
    const layer = new lambda.LayerVersion(this, "DependenciesLayer", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/layers"), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_13.bundlingImage,
          command: [
            "bash",
            "-c",
            "pip install -r requirements.txt -t /asset-output/python/",
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_13],
    });

    // Lambda Function
    const openAIFunction = new lambda.Function(this, "OpenAIWebSearchFunction", {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: "index.lambda_handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/src")),
      layers: [layer],
      timeout: cdk.Duration.minutes(10),
      environment: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
      },
    });

    // ========================================
    // IAM Role for AgentCore Gateway
    // ========================================
    const agentCoreRole = new iam.Role(this, "AgentCoreGatewayRole", {
      assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com", {
        conditions: {
          StringEquals: {
            "aws:SourceAccount": this.account,
          },
          ArnLike: {
            "aws:SourceArn": `arn:aws:bedrock-agentcore:${this.region}:${this.account}:*`,
          },
        },
      }),
      description: "IAM role for AgentCore Gateway to access Bedrock and Lambda",
    });

    // Attach inline policy to the role
    agentCoreRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AgentCorePermissions",
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock-agentcore:*",
          "bedrock:*",
          "agent-credential-provider:*",
          "iam:PassRole",
          "secretsmanager:GetSecretValue",
          "lambda:InvokeFunction",
        ],
        resources: ["*"],
      })
    );

    // ========================================
    // Cognito User Pool
    // ========================================
    const userPool = new cognito.UserPool(this, "AgentCoreUserPool", {
      selfSignUpEnabled: false,
      signInAliases: {
        email: false,
        username: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev/test environments
    });

    // Create User Pool Domain
    const userPoolDomain = userPool.addDomain("AgentCoreUserPoolDomain", {
      cognitoDomain: {
        domainPrefix: `agentcore-${this.account}-${cdk.Names.uniqueId(this).toLowerCase().slice(-8)}`,
      },
    });

    // ========================================
    // Cognito Resource Server
    // ========================================
    const resourceServer = new cognito.UserPoolResourceServer(
      this,
      "AgentCoreResourceServer",
      {
        userPool: userPool,
        identifier: `agentcore-gateway-m2m-server`,
        scopes: [
          {
            scopeName: "gateway:read",
            scopeDescription: "Read access to the gateway",
          },
          {
            scopeName: "gateway:write",
            scopeDescription: "Write access to the gateway",
          },
        ],
      }
    );

    // ========================================
    // Cognito User Pool Client (M2M)
    // ========================================
    const userPoolClient = new cognito.UserPoolClient(
      this,
      "AgentCoreM2MClient",
      {
        userPool: userPool,
        userPoolClientName: "sample-agentcore-gateway-client",
        generateSecret: true,
        oAuth: {
          flows: {
            clientCredentials: true,
          },
          scopes: [
            cognito.OAuthScope.resourceServer(resourceServer, {
              scopeName: "gateway:read",
              scopeDescription: "Read access to the gateway",
            }),
            cognito.OAuthScope.resourceServer(resourceServer, {
              scopeName: "gateway:write",
              scopeDescription: "Write access to the gateway",
            }),
          ],
        },
        authFlows: {
          userPassword: false,
          userSrp: false,
          custom: false,
        },
        supportedIdentityProviders: [
          cognito.UserPoolClientIdentityProvider.COGNITO,
        ],
      }
    );

    // Ensure resource server is created before the client
    userPoolClient.node.addDependency(resourceServer);

    // ========================================
    // AgentCore Gateway
    // ========================================
    const gateway = new agentcore.CfnGateway(this, 'Gateway', {
      name: gatewayName,
      description: 'Gateway for OpenAI Web Search Lambda',
      protocolType: 'MCP',
      protocolConfiguration: {
        mcp: {
          searchType: 'SEMANTIC',
        },
      },
      authorizerType: 'CUSTOM_JWT', // Inbound authentication using Cognito JWT
      authorizerConfiguration: {
        customJwtAuthorizer: {
          discoveryUrl: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}/.well-known/openid-configuration`,
          allowedClients: [userPoolClient.userPoolClientId],
        },
      },
      roleArn: agentCoreRole.roleArn,
      exceptionLevel: 'DEBUG',
    });

    // Create target
    new agentcore.CfnGatewayTarget(this, 'AccountingTarget', {
      name: gatewayTargetName,
      description: 'Lambda Target',
      gatewayIdentifier: gateway.attrGatewayIdentifier,
      credentialProviderConfigurations: [
        {
          credentialProviderType: 'GATEWAY_IAM_ROLE', // Outbound authentication using IAM Role
        },
      ],
      targetConfiguration: {
        mcp: {
          lambda: {
            lambdaArn: openAIFunction.functionArn,
            toolSchema: {
              // https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-bedrockagentcore-gatewaytarget-tooldefinition.html
              inlinePayload: [
                {
                  name: "openai_deep_research",
                  description: "An AI agent with advanced web search capabilities. Useful for finding the latest information, troubleshooting errors, and discussing ideas or design challenges. Supports natural language queries.",
                  inputSchema: {
                    type: 'object',
                    properties: {
                      question: {
                        type: 'string',
                        description: 'Question text to send to OpenAI o3. It supports natural language queries. Write in Japanese. Be direct and specific about your requirements. Avoid chain-of-thought instructions like `think step by step` as o3 handles reasoning internally.',
                      },
                    },
                    required: ['question'],
                  },
                },
              ],
            },
          },
        },
      },
    });

    // ========================================
    // CloudFormation Outputs
    // ========================================
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });

    // This secret should not be exposed in production environments
    new cdk.CfnOutput(this, 'UserPoolClientSecret', {
      value: userPoolClient.userPoolClientSecret.unsafeUnwrap()
    });

    new cdk.CfnOutput(this, "CognitoDiscoveryUrl", {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}/.well-known/openid-configuration`,
      description: "Cognito OpenID Discovery URL",
    });

    new cdk.CfnOutput(this, 'GatewayUrl', {
      value: gateway.attrGatewayUrl,
      description: 'URL of the AgentCore Gateway',
    });

    // Custom Scopes Output
    new cdk.CfnOutput(this, "CustomScopeRead", {
      value: `${resourceServer.userPoolResourceServerId}/gateway:read`,
      description: "Custom scope for read access",
    });

    new cdk.CfnOutput(this, "CustomScopeWrite", {
      value: `${resourceServer.userPoolResourceServerId}/gateway:write`,
      description: "Custom scope for write access",
    });
  }
}