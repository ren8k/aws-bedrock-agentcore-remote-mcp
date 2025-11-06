import asyncio
import os

from bedrock_agentcore.identity.auth import requires_access_token
from dotenv import load_dotenv
from mcp.client.streamable_http import streamablehttp_client
from strands import Agent
from strands.tools.mcp import MCPClient

PROMPT = "Claudeのskillsについて調べて。もしエラーが発生した場合、そのエラーの内容を教えて。また、このエラーはOpenAIのAPIで発生しているの？"

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


def get_mcp_endpoint(agent_arn: str, region: str = "us-east-1") -> str:
    encoded_arn = agent_arn.replace(":", "%3A").replace("/", "%2F")
    return f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations?qualifier=DEFAULT"


async def main() -> None:
    await get_access_token(access_token="")

    runtime_arn = os.getenv("RUNTIME_ARN", "")
    print(f"Using Runtime ARN: {runtime_arn}")
    mcp_endpoint = get_mcp_endpoint(runtime_arn)
    print(f"MCP Endpoint: {mcp_endpoint}")
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
