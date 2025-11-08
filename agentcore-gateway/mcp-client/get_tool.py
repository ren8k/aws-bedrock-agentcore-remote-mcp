import asyncio
import os

from bedrock_agentcore.identity.auth import requires_access_token
from dotenv import load_dotenv
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

# load different .env file
load_dotenv(override=True, dotenv_path="../../agentcore-identity/.env")


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


async def main():
    await get_access_token(access_token="")

    mcp_endpoint = os.getenv("GATEWAY_ENDPOINT_URL")
    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}

    async with streamablehttp_client(
        mcp_endpoint, headers, timeout=120, terminate_on_close=False
    ) as (
        read_stream,
        write_stream,
        _,
    ):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
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
