import asyncio
import os
import sys

from bedrock_agentcore.identity.auth import requires_access_token
from dotenv import load_dotenv
from mcp.client.streamable_http import streamablehttp_client
from strands import Agent
from strands.tools.mcp import MCPClient

load_dotenv(override=True, dotenv_path="../../agentcore-identity/.env")


@requires_access_token(
    provider_name=os.getenv("OAUTH2_PROVIDER_NAME"),
    scopes=[
        os.getenv("OAUTH2_SCOPE_READ"),
        os.getenv("OAUTH2_SCOPE_WRITE"),
    ],
    auth_flow="M2M",
)
async def get_access_token(*, access_token: str) -> str:
    return access_token


def validate_env_vars():
    required = [
        "RUNTIME_ARN",
        "OAUTH2_PROVIDER_NAME",
        "OAUTH2_SCOPE_READ",
        "OAUTH2_SCOPE_WRITE",
    ]
    missing = [var for var in required if not os.getenv(var)]
    if missing:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing)}"
        )


def get_mcp_endpoint(runtime_arn: str, region: str = "us-east-1") -> str:
    encoded_arn = runtime_arn.replace(":", "%3A").replace("/", "%2F")
    return f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations?qualifier=DEFAULT"


def create_mcp_client(endpoint: str, access_token: str) -> MCPClient:
    headers = {"Authorization": f"Bearer {access_token}"}
    return MCPClient(
        lambda: streamablehttp_client(endpoint, headers=headers, timeout=300)
    )


def run_agent(mcp_client: MCPClient, prompt: str):
    with mcp_client:
        tools = mcp_client.list_tools_sync()
        for tool in tools:
            print(f"Loaded tool: {tool._agent_tool_name}")
        agent = Agent(tools=tools)
        agent(prompt)


async def main():
    validate_env_vars()
    prompt = sys.argv[1] if len(sys.argv) > 1 else "Claude Skillsについて調べて。"
    access_token = await get_access_token(access_token="")
    runtime_arn = os.getenv("RUNTIME_ARN", "")
    mcp_endpoint = get_mcp_endpoint(runtime_arn)

    mcp_client = create_mcp_client(mcp_endpoint, access_token)
    run_agent(mcp_client, prompt)


if __name__ == "__main__":
    asyncio.run(main())
