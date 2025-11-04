import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { ContainerImageBuild } from 'deploy-time-build';
import * as agentcore from "@aws-cdk/aws-bedrock-agentcore-alpha";
import * as path from "path";


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
        domainPrefix: `agentcore-${this.account}-${cdk.Names.uniqueId(this).toLowerCase().slice(-10)}`,
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

    // Ensure resource server is created before the client
    userPoolClient.node.addDependency(resourceServer);

    // ========================================
    // ECR
    // ========================================
    // ECR Repository
    const image = new ContainerImageBuild(this, 'Image', {
      directory: path.join(__dirname, "../mcp_server"),
      platform: Platform.LINUX_ARM64,
    });

    // ========================================
    // AgentCore Runtime
    // ========================================
    const agentRuntimeArtifact = agentcore.AgentRuntimeArtifact.fromEcrRepository(image.repository, image.imageTag);
    // const agentRuntimeArtifact = agentcore.AgentRuntimeArtifact.fromAsset(
    //   path.join(__dirname, "../mcp_server"),
    // );

    // AgentCore Runtime (L2 Construct)
    const runtime = new agentcore.Runtime(this, "StrandsAgentRuntime", {
      runtimeName: "simpleStrandsAgent",
      agentRuntimeArtifact: agentRuntimeArtifact,
      description: "MCP Server",
      authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.usingCognito(userPool.userPoolId, userPoolClient.userPoolClientId),
    });

    //TODO: Environment Variables
    //TODO: Docker Build をローカルで実施する場合、ARM64対応が必要
    runtime.node.addDependency(image);
    image.repository.grantPull(runtime.role);
    // buildはできてるが、ECRからのpullができてない。
    /**
     * ❌  AgentcoreRuntimeMcpStack2 failed: ToolkitError: The stack named AgentcoreRuntimeMcpStack2 failed creation, it may need to be manually deleted from the AWS console: ROLLBACK_COMPLETE: Resource handler returned message: "Invalid request provided: The specified image identifier does not exist in the repository. Verify the image tag format and repository name. (Service: BedrockAgentCoreControl, Status Code: 400, Request ID: af6272bf-7dcc-45b1-a09e-621d77cef9a0) (SDK Attempt Count: 1)" (RequestToken: 411584cb-fa8b-dce0-661f-d37e0450c573, HandlerErrorCode: InvalidRequest)
     */

    // 出力
    new cdk.CfnOutput(this, "RuntimeArn", {
      value: runtime.agentRuntimeArn,
    });

  }
}
