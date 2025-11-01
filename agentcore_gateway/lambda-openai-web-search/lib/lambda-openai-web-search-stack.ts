import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

export class LambdaOpenaiWebSearchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const resourceServerId = "sample-agentcore-gateway-id";

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
    const uniqueId = cdk.Names.uniqueId(this).toLowerCase().slice(-8);
    const userPoolDomain = userPool.addDomain("AgentCoreUserPoolDomain", {
      cognitoDomain: {
        domainPrefix: `agentcore-${this.account}-${uniqueId}`,
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
        identifier: resourceServerId,
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
    // CloudFormation Outputs
    // ========================================
    new cdk.CfnOutput(this, "LambdaFunctionArn", {
      value: openAIFunction.functionArn,
      description: "ARN of the OpenAI Web Search Lambda function",
    });

    new cdk.CfnOutput(this, "AgentCoreRoleArn", {
      value: agentCoreRole.roleArn,
      description: "ARN of the AgentCore Gateway IAM role",
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "UserPoolArn", {
      value: userPool.userPoolArn,
      description: "Cognito User Pool ARN",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });

    new cdk.CfnOutput(this, "CognitoDiscoveryUrl", {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}/.well-known/openid-configuration`,
      description: "Cognito OpenID Discovery URL",
    });

    new cdk.CfnOutput(this, "CognitoDomainUrl", {
      value: userPoolDomain.baseUrl(),
      description: "Cognito User Pool Domain URL",
    });

    new cdk.CfnOutput(this, "TokenEndpoint", {
      value: `${userPoolDomain.baseUrl()}/oauth2/token`,
      description: "Cognito OAuth2 Token Endpoint",
    });

    new cdk.CfnOutput(this, "ResourceServerIdentifier", {
      value: resourceServer.userPoolResourceServerId,
      description: "Resource Server Identifier",
    });
  }
}