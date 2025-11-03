import os

import boto3
from dotenv import load_dotenv


def create_oauth2_provider(
    name: str,
    client_id: str,
    client_secret: str,
    discovery_url: str,
    region: str = "us-east-1",
) -> None:
    identity_client = boto3.client("bedrock-agentcore-control", region_name=region)

    oauth2_config = {
        "customOauth2ProviderConfig": {
            "clientId": client_id,
            "clientSecret": client_secret,
            "oauthDiscovery": {"discoveryUrl": discovery_url},
        }
    }
    try:
        response = identity_client.create_oauth2_credential_provider(
            name=name,
            credentialProviderVendor="CustomOauth2",
            oauth2ProviderConfigInput=oauth2_config,
        )
        print(response)
    except Exception as e:
        print(f"Error creating OAuth2 provider: {e}")


def main():
    load_dotenv()
    create_oauth2_provider(
        name=os.getenv("OAUTH2_PROVIDER_NAME", ""),
        client_id=os.getenv("OAUTH2_CLIENT_ID", ""),
        client_secret=os.getenv("OAUTH2_CLIENT_SECRET", ""),
        discovery_url=os.getenv("OAUTH2_DISCOVERY_URL", ""),
    )


if __name__ == "__main__":
    main()
