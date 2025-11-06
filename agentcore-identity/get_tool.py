import asyncio
import os

from bedrock_agentcore.identity.auth import requires_access_token
from dotenv import load_dotenv
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

load_dotenv()


@requires_access_token(
    provider_name=os.getenv("OAUTH2_PROVIDER_NAME"),
    scopes=[
        os.getenv("OAUTH2_SCOPE_READ"),
        os.getenv("OAUTH2_SCOPE_WRITE"),
    ],
    auth_flow="M2M",
)
async def get_access_token(*, access_token: str):
    global ACCESS_TOKEN
    print("received access token for async func")
    ACCESS_TOKEN = access_token


def get_mcp_endpoint(runtime_arn: str, region: str = "us-east-1") -> str:
    encoded_arn = runtime_arn.replace(":", "%3A").replace("/", "%2F")
    return f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations?qualifier=DEFAULT"


async def main():
    await get_access_token(access_token="")

    runtime_arn = os.getenv("RUNTIME_ARN", "")
    print(f"Using Runtime ARN: {runtime_arn}")
    mcp_endpoint = get_mcp_endpoint(runtime_arn)
    print(f"MCP Endpoint: {mcp_endpoint}")
    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}

    async with streamablehttp_client(
        mcp_endpoint, headers, timeout=120, terminate_on_close=False
    ) as (
        read_stream,
        write_stream,
        _,
    ):
        async with ClientSession(read_stream, write_stream) as session:
            print("\n🔄 Initializing MCP session...")
            await session.initialize()
            print("\n🔄 Listing available tools...")
            tool_result = await session.list_tools()
            for tool in tool_result.tools:
                print(f"🔧 {tool.name}")
                print(f"   Description: {tool.description}")
                if hasattr(tool, "inputSchema") and tool.inputSchema:
                    properties = tool.inputSchema.get("properties", {})
                    if properties:
                        print(f"   Parameters: {list(properties.keys())}")
                print()


if __name__ == "__main__":
    asyncio.run(main())
