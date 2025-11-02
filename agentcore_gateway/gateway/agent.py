identity_arn = "arn:aws:bedrock-agentcore:us-east-1:869603330160:token-vault/default/oauth2credentialprovider/cognito-oauth-client-tm29k"

from bedrock_agentcore.identity.auth import requires_access_token
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client


@requires_access_token(
    provider_name="cognito-oauth-client-tm29k",  # AgentCore IdentityのName
    scopes=[
        "sample-agentcore-gateway-id6/gateway:read",
        "sample-agentcore-gateway-id6/gateway:write",
    ],
    auth_flow="M2M",
)
async def need_api_key(*, access_token: str):
    global ACCESS_TOKEN
    print("received api key for async func")
    ACCESS_TOKEN = access_token


async def main():
    await need_api_key(access_token="")

    mcp_url = "https://sampleagentcoregateway6-kfgkc46ysx.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp"
    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}

    async with streamablehttp_client(
        mcp_url, headers, timeout=120, terminate_on_close=False
    ) as (
        read_stream,
        write_stream,
        _,
    ):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tool_result = await session.list_tools()
            print(tool_result)


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
