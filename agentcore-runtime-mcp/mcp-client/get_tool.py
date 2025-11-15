import asyncio
import os

from bedrock_agentcore.identity.auth import requires_access_token
from dotenv import load_dotenv
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

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
    required = ["RUNTIME_ARN", "OAUTH2_PROVIDER_NAME", "OAUTH2_SCOPE_READ", "OAUTH2_SCOPE_WRITE"]
    missing = [var for var in required if not os.getenv(var)]
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")


def get_mcp_endpoint(runtime_arn: str, region: str = "us-east-1") -> str:
    encoded_arn = runtime_arn.replace(":", "%3A").replace("/", "%2F")
    return f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations?qualifier=DEFAULT"


def print_tool_info(tool):
    print(f"🔧 {tool.name}")
    print(f"   Description: {tool.description}")
    if hasattr(tool, "inputSchema") and tool.inputSchema:
        properties = tool.inputSchema.get("properties", {})
        if properties:
            print(f"   Parameters: {list(properties.keys())}")
    print()


async def list_tools(endpoint: str, access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with streamablehttp_client(
        endpoint, headers, timeout=120, terminate_on_close=False
    ) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tool_result = await session.list_tools()
            for tool in tool_result.tools:
                print_tool_info(tool)


async def main():
    validate_env_vars()
    
    access_token = await get_access_token(access_token="")
    runtime_arn = os.getenv("RUNTIME_ARN", "")
    mcp_endpoint = get_mcp_endpoint(runtime_arn)
    
    await list_tools(mcp_endpoint, access_token)


if __name__ == "__main__":
    asyncio.run(main())
