import asyncio
import os

from bedrock_agentcore.identity.auth import requires_access_token
from dotenv import load_dotenv
from mcp.client.streamable_http import streamablehttp_client
from strands import Agent
from strands.tools.mcp import MCPClient

PROMPT = "Claude Skillsについて調べて。"

load_dotenv(override=True, dotenv_path="../../agentcore-identity/.env")


@requires_access_token(
    provider_name=os.getenv("OAUTH2_PROVIDER_NAME", ""),
    scopes=[
        os.getenv("OAUTH2_SCOPE_READ", ""),
        os.getenv("OAUTH2_SCOPE_WRITE", ""),
    ],
    auth_flow="M2M",
)
async def get_access_token(*, access_token: str):
    global ACCESS_TOKEN
    print("received access token for async func")
    ACCESS_TOKEN = access_token


async def main():
    await get_access_token(access_token="")

    mcp_endpoint = os.getenv("GATEWAY_ENDPOINT_URL", "")
    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}

    mcp_client = MCPClient(
        lambda: streamablehttp_client(
            mcp_endpoint,
            headers=headers,
            timeout=300,
        )
    )

    try:
        with mcp_client:
            tools = mcp_client.list_tools_sync()
            for tool in tools:
                print(f"Loaded tool: {tool._agent_tool_name}")
            agent = Agent(tools=tools)
            agent(PROMPT)
    except Exception as e:
        raise RuntimeError(f"Failed to connect to MCP server or execute agent: {e}")


if __name__ == "__main__":
    asyncio.run(main())
