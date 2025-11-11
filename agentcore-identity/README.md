# AgentCore Identity Provider Setup

このツールは、Amazon Bedrock AgentCore Gateway で使用する OAuth2 認証プロバイダーを作成します。

## 概要

`create_identity.py` は、Cognito で作成した OAuth2 クライアント情報を使用して、Bedrock AgentCore の認証プロバイダーを登録するスクリプトです。

## 前提条件

以下のいずれかの CDK スタックをデプロイ済みであること：

- [agentcore-gateway/cdk-gateway](../agentcore-gateway/cdk-gateway)
- [agentcore-runtime-mcp/cdk-runtime-mcp](../agentcore-runtime-mcp/cdk-runtime-mcp)

CDK デプロイ後に出力される以下の情報が必要です：

- `CognitoDiscoveryUrl`
- `UserPoolClientId`
- `UserPoolClientSecret`
- `GatewayUrl` または `RuntimeArn`

## セットアップ

### 1. 環境変数の設定

CDK デプロイ出力を `.env` ファイルに記述します：

```bash
cd agentcore-identity

# .envファイルを作成
cp .env.example .env
```

`.env` ファイルを編集し、CDK の出力値を設定。なお、`# Remote MCP Settings` には、AgentCore Gateway, AgentCore Runtime のどちらか：

```bash
# Cognito Settings
OAUTH2_PROVIDER_NAME=cognito-for-gateway
OAUTH2_CLIENT_ID=<UserPoolClientId>
OAUTH2_CLIENT_SECRET=<UserPoolClientSecret>
OAUTH2_DISCOVERY_URL=<CognitoDiscoveryUrl>
OAUTH2_SCOPE_READ=agentcore-gateway-m2m-server/gateway:read
OAUTH2_SCOPE_WRITE=agentcore-gateway-m2m-server/gateway:write

# Remote MCP Settings
GATEWAY_ENDPOINT_URL=<GatewayUrl>
RUNTIME_ARN=<RuntimeArn>
AWS_REGION=us-east-1
```

### 2. 依存関係のインストール

```bash
uv sync
```

## 実行

### OAuth2 プロバイダーの作成

```bash
uv run python create_identity.py
```

成功すると、以下のような出力が表示されます：

```json
{
  "credentialProviderId": "oauth2-provider-xxxxx",
  "name": "cognito-for-gateway",
  "credentialProviderVendor": "CustomOauth2",
  ...
}
```

## プロジェクト構造

```
agentcore-identity/
├── create_identity.py    # OAuth2プロバイダー作成スクリプト
├── .env.example          # 環境変数のサンプル
├── .env                  # 環境変数（未コミット）
├── pyproject.toml        # Python依存関係
└── README.md             # このファイル
```

## トラブルシューティング

### 環境変数エラー

**症状**: 空の値でプロバイダーが作成される

**解決方法**: `.env` ファイルに正しい値が設定されているか確認してください。

```bash
cat .env
```

### AWS 認証エラー

**症状**: `NoCredentialsError` または `AccessDenied`

**解決方法**: AWS CLI が正しく設定されているか確認してください。

```bash
aws sts get-caller-identity
```

### リージョンエラー

**症状**: `bedrock-agentcore-control` サービスが見つからない

**解決方法**: `.env` の `AWS_REGION` が正しいか確認してください。Bedrock AgentCore は特定のリージョンでのみ利用可能です。

## 次のステップ

OAuth2 プロバイダー作成後、以下のディレクトリで MCP クライアントを実行できます：

- [agentcore-gateway/mcp-client](../agentcore-gateway/mcp-client)
- [agentcore-runtime-mcp/mcp-client](../agentcore-runtime-mcp/mcp-client)

## 参考資料

- [Amazon Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html)
- [OAuth 2.0 Client Credentials Flow](https://oauth.net/2/grant-types/client-credentials/)
- [Amazon Cognito OAuth 2.0](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html)
