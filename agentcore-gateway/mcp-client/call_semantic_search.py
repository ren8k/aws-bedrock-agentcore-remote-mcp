import asyncio
import json
import os

import requests
from bedrock_agentcore.identity.auth import requires_access_token
from dotenv import load_dotenv

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
        "GATEWAY_ENDPOINT_URL",
        "OAUTH2_PROVIDER_NAME",
        "OAUTH2_SCOPE_READ",
        "OAUTH2_SCOPE_WRITE",
    ]
    missing = [var for var in required if not os.getenv(var)]
    if missing:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing)}"
        )


def search_tools(gateway_url, access_token, query):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}",
    }

    payload = {
        "jsonrpc": "2.0",
        "id": "search-tools-request",
        "method": "tools/call",
        "params": {
            "name": "x_amz_bedrock_agentcore_search",
            "arguments": {"query": query},
        },
    }

    response = requests.post(gateway_url, headers=headers, json=payload)
    return response.json()


async def main():
    validate_env_vars()

    access_token = await get_access_token(access_token="")
    mcp_endpoint = os.getenv("GATEWAY_ENDPOINT_URL", "")

    results = search_tools(mcp_endpoint, access_token, "search information")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
