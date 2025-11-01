<cdk>
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

export class LambdaOpenaiWebSearchStack extends cdk.Stack {
constructor(scope: Construct, id: string, props?: cdk.StackProps) {
super(scope, id, props);

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

    new lambda.Function(this, "OpenAIWebSearchFunction", {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: "index.lambda_handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/src")),
      layers: [layer],
      timeout: cdk.Duration.minutes(10),
      environment: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
      },
    });

}
}
</cdk>
<python-role>
import json
import time

import boto3

def create_agentcore_gateway_role(gateway_name, region: str = "us-east-1"):
iam_client = boto3.client("iam")
agentcore_gateway_role_name = f"agentcore-{gateway_name}-role"
account_id = boto3.client("sts").get_caller_identity()["Account"]
role_policy = {
"Version": "2012-10-17",
"Statement": [
{
"Sid": "VisualEditor0",
"Effect": "Allow",
"Action": [
"bedrock-agentcore:*",
"bedrock:*",
"agent-credential-provider:*",
"iam:PassRole",
"secretsmanager:GetSecretValue",
"lambda:InvokeFunction",
],
"Resource": "\*",
}
],
}

    assume_role_policy_document = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AssumeRolePolicy",
                "Effect": "Allow",
                "Principal": {"Service": "bedrock-agentcore.amazonaws.com"},
                "Action": "sts:AssumeRole",
                "Condition": {
                    "StringEquals": {"aws:SourceAccount": f"{account_id}"},
                    "ArnLike": {
                        "aws:SourceArn": f"arn:aws:bedrock-agentcore:{region}:{account_id}:*"
                    },
                },
            }
        ],
    }

    assume_role_policy_document_json = json.dumps(assume_role_policy_document)

    role_policy_document = json.dumps(role_policy)
    # Create IAM Role for the Lambda function
    try:
        agentcore_iam_role = iam_client.create_role(
            RoleName=agentcore_gateway_role_name,
            AssumeRolePolicyDocument=assume_role_policy_document_json,
        )

        # Pause to make sure role is created
        time.sleep(10)
    except iam_client.exceptions.EntityAlreadyExistsException:
        print("Role already exists -- deleting and creating it again")
        policies = iam_client.list_role_policies(
            RoleName=agentcore_gateway_role_name, MaxItems=100
        )
        print("policies:", policies)
        for policy_name in policies["PolicyNames"]:
            iam_client.delete_role_policy(
                RoleName=agentcore_gateway_role_name, PolicyName=policy_name
            )
        print(f"deleting {agentcore_gateway_role_name}")
        iam_client.delete_role(RoleName=agentcore_gateway_role_name)
        print(f"recreating {agentcore_gateway_role_name}")
        agentcore_iam_role = iam_client.create_role(
            RoleName=agentcore_gateway_role_name,
            AssumeRolePolicyDocument=assume_role_policy_document_json,
        )

    # Attach the AWSLambdaBasicExecutionRole policy
    print(f"attaching role policy {agentcore_gateway_role_name}")
    try:
        iam_client.put_role_policy(
            PolicyDocument=role_policy_document,
            PolicyName="AgentCorePolicy",
            RoleName=agentcore_gateway_role_name,
        )
    except Exception as e:
        print(e)

    return agentcore_iam_role

def main() -> None:
gateway_name = "sample-lambda-gateway"
role = create_agentcore_gateway_role(gateway_name)
print(f"Created role: {role['Role']['Arn']}")

if **name** == "**main**":
main()
</python-role>
<python-cognito>
import os

import boto3
import requests

REGION = "us-east-1"

def get_or_create_user_pool(cognito, USER_POOL_NAME):
response = cognito.list_user_pools(MaxResults=60)
for pool in response["UserPools"]:
if pool["Name"] == USER_POOL_NAME:
user_pool_id = pool["Id"]
response = cognito.describe_user_pool(UserPoolId=user_pool_id)

            # Get the domain from user pool description
            user_pool = response.get("UserPool", {})
            domain = user_pool.get("Domain")

            if domain:
                region = user_pool_id.split("_")[0] if "_" in user_pool_id else REGION
                domain_url = f"https://{domain}.auth.{region}.amazoncognito.com"
                print(
                    f"Found domain for user pool {user_pool_id}: {domain} ({domain_url})"
                )
            else:
                print(f"No domains found for user pool {user_pool_id}")
            return pool["Id"]
    print("Creating new user pool")
    created = cognito.create_user_pool(PoolName=USER_POOL_NAME)
    user_pool_id = created["UserPool"]["Id"]
    user_pool_id_without_underscore_lc = user_pool_id.replace("_", "").lower()
    cognito.create_user_pool_domain(
        Domain=user_pool_id_without_underscore_lc, UserPoolId=user_pool_id
    )
    print("Domain created as well")
    return created["UserPool"]["Id"]

def get_or_create_resource_server(
cognito, user_pool_id, RESOURCE_SERVER_ID, RESOURCE_SERVER_NAME, SCOPES
):
try:
existing_server_info = cognito.describe_resource_server(
UserPoolId=user_pool_id, Identifier=RESOURCE_SERVER_ID
)
return existing_server_info
except cognito.exceptions.ResourceNotFoundException:
print("creating new resource server")
created_server_info = cognito.create_resource_server(
UserPoolId=user_pool_id,
Identifier=RESOURCE_SERVER_ID,
Name=RESOURCE_SERVER_NAME,
Scopes=SCOPES,
)
return created_server_info

def get_or_create_m2m_client(
cognito, user_pool_id, CLIENT_NAME, RESOURCE_SERVER_ID, SCOPES=None
):
response = cognito.list_user_pool_clients(UserPoolId=user_pool_id, MaxResults=60)
for client in response["UserPoolClients"]:
if client["ClientName"] == CLIENT_NAME:
describe = cognito.describe_user_pool_client(
UserPoolId=user_pool_id, ClientId=client["ClientId"]
)
return client["ClientId"], describe["UserPoolClient"]["ClientSecret"]
print("creating new m2m client")

    # Default scopes if not provided (for backward compatibility)
    if SCOPES is None:
        SCOPES = [
            f"{RESOURCE_SERVER_ID}/gateway:read",
            f"{RESOURCE_SERVER_ID}/gateway:write",
        ]

    created = cognito.create_user_pool_client(
        UserPoolId=user_pool_id,
        ClientName=CLIENT_NAME,
        GenerateSecret=True,
        AllowedOAuthFlows=["client_credentials"],
        AllowedOAuthScopes=SCOPES,
        AllowedOAuthFlowsUserPoolClient=True,
        SupportedIdentityProviders=["COGNITO"],
        ExplicitAuthFlows=["ALLOW_REFRESH_TOKEN_AUTH"],
    )
    return created["UserPoolClient"]["ClientId"], created["UserPoolClient"][
        "ClientSecret"
    ]

def get*token(
user_pool_id: str,
client_id: str,
client_secret: str,
scope_string: str,
region: str,
) -> dict:
try:
user_pool_id_without_underscore = user_pool_id.replace("*", "")
url = f"https://{user_pool_id_without_underscore}.auth.{region}.amazoncognito.com/oauth2/token"
headers = {"Content-Type": "application/x-www-form-urlencoded"}
data = {
"grant_type": "client_credentials",
"client_id": client_id,
"client_secret": client_secret,
"scope": scope_string,
}
print(client_id)
response = requests.post(url, headers=headers, data=data)
response.raise_for_status()
return response.json()

    except requests.exceptions.RequestException as err:
        return {"error": str(err)}

def main(): # Creating Cognito User Pool
REGION = os.environ["AWS_DEFAULT_REGION"]
USER_POOL_NAME = "sample-agentcore-gateway-pool"
RESOURCE_SERVER_ID = "sample-agentcore-gateway-id"
RESOURCE_SERVER_NAME = "sample-agentcore-gateway-name"
CLIENT_NAME = "sample-agentcore-gateway-client"
SCOPES = [
{"ScopeName": "gateway:read", "ScopeDescription": "Read access"},
{"ScopeName": "gateway:write", "ScopeDescription": "Write access"},
]
scopeString = (
f"{RESOURCE_SERVER_ID}/gateway:read {RESOURCE_SERVER_ID}/gateway:write"
)

    cognito = boto3.client("cognito-idp", region_name=REGION)

    print("Creating or retrieving Cognito resources...")
    user_pool_id = get_or_create_user_pool(cognito, USER_POOL_NAME)
    print(f"User Pool ID: {user_pool_id}")

    get_or_create_resource_server(
        cognito, user_pool_id, RESOURCE_SERVER_ID, RESOURCE_SERVER_NAME, SCOPES
    )
    print("Resource server ensured.")

    client_id, client_secret = get_or_create_m2m_client(
        cognito, user_pool_id, CLIENT_NAME, RESOURCE_SERVER_ID
    )
    print(f"Client ID: {client_id}")

    # Get discovery URL
    cognito_discovery_url = f"https://cognito-idp.{REGION}.amazonaws.com/{user_pool_id}/.well-known/openid-configuration"
    print(cognito_discovery_url)

    # get token
    print(
        "Requesting the access token from Amazon Cognito authorizer...May fail for some time till the domain name propogation completes"
    )

    token_response = get_token(
        user_pool_id, client_id, client_secret, scopeString, REGION
    )

    token = token_response["access_token"]
    print("Token response:", token)

if **name** == "**main**":
main()

</python-cognito>
<instruction>
上記のCDKのコードに、python-roleタグ、および、python-cognitoタグ内のPythonコードで生成されるリソースを追加しなさい。
CDKのコードではTypeScriptを利用すること。
</instruction>
