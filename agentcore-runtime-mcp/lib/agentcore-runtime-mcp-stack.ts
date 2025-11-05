import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import { ContainerImageBuild } from "deploy-time-build";
import * as agentcore from "@aws-cdk/aws-bedrock-agentcore-alpha";
import * as path from "path";
import * as dotenv from "dotenv";
import { ProtocolType } from "@aws-cdk/aws-bedrock-agentcore-alpha";

dotenv.config();

export class AgentcoreRuntimeMcpStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
        domainPrefix: `agentcore-${this.account}-${cdk.Names.uniqueId(this)
          .toLowerCase()
          .slice(-10)}`,
      },
    });
    // BUG: −８にするとダメ。

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

    // ========================================
    // ECR
    // ========================================
    // Build and publish Docker image to ECR
    const image = new ContainerImageBuild(this, "Image", {
      directory: path.join(__dirname, "../mcp_server"),
      platform: Platform.LINUX_ARM64,
    });

    // ========================================
    // AgentCore Runtime
    // ========================================
    const agentRuntimeArtifact =
      agentcore.AgentRuntimeArtifact.fromEcrRepository(
        image.repository,
        image.imageTag
      );

    // AgentCore Runtime (L2 Construct)
    const runtime = new agentcore.Runtime(this, "RuntimeMCP", {
      runtimeName: `runtime_mcp_${cdk.Names.uniqueId(this)
        .toLowerCase()
        .slice(-8)}`,
      agentRuntimeArtifact: agentRuntimeArtifact,
      description: "MCP Server",
      environmentVariables: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
      },
      protocolConfiguration: ProtocolType.MCP,
      authorizerConfiguration:
        agentcore.RuntimeAuthorizerConfiguration.usingCognito(
          userPool.userPoolId,
          userPoolClient.userPoolClientId
        ),
    });
    // TODO: Cognito認証設定に破壊的変更があった模様。
    // TODO: https://x.com/mazyu36/status/1985715176306622779

    // ========================================
    // CloudFormation Outputs
    // ========================================
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });

    // This secret should not be exposed in production environments
    new cdk.CfnOutput(this, "UserPoolClientSecret", {
      value: userPoolClient.userPoolClientSecret.unsafeUnwrap(),
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

    new cdk.CfnOutput(this, "CognitoDiscoveryUrl", {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}/.well-known/openid-configuration`,
      description: "Cognito OpenID Discovery URL",
    });

    new cdk.CfnOutput(this, "RuntimeArn", {
      value: runtime.agentRuntimeArn,
      description: "ARN of the AgentCore Runtime",
    });
  }
}
