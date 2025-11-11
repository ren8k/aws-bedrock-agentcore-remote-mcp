# AgentCore Gateway MCP Client

このクライアントは、Amazon Bedrock AgentCore Gateway 経由で MCP サーバーのツールを利用する Python アプリケーションです。

## 概要

- `get_tool.py`: Gateway 経由で利用可能なツール一覧を取得
- `agent.py`: Strands Agent を使用して、MCP ツールを実行

## 前提条件

以下の手順が完了していること：

1. [agentcore-gateway/cdk-gateway](../cdk-gateway) または [agentcore-runtime-mcp/cdk-runtime-mcp](../../agentcore-runtime-mcp/cdk-runtime-mcp) のデプロイ
2. [agentcore-identity](../../agentcore-identity) で OAuth2 プロバイダーの作成

## セットアップ

### 依存関係のインストール

```bash
cd agentcore-gateway/mcp-client
uv sync
```

## 使用方法

### ツール一覧の取得

Gateway 経由で利用可能な MCP ツールを確認：

```bash
uv run python get_tool.py
```

出力例：

```
🔧 web_search
   Description: Search the web for information
   Parameters: ['query', 'max_results']
```

### Agent の実行

MCP ツールを使用して質問に回答：

```bash
# デフォルトプロンプト
uv run python agent.py

# カスタムプロンプト
uv run python agent.py "Claude Skillsについて調べて。"
```

Agent は自動的に必要なツールを選択して実行します。

## 環境変数

`.env` ファイルは `agentcore-identity/.env` を参照します。

### Gateway を使用する場合

```bash
# MCP Endpoint (CDKデプロイ時の GatewayUrl 出力値)
GATEWAY_ENDPOINT_URL=https://<gateway-id>.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp

# OAuth2 Settings (CDKデプロイ時の出力値)
OAUTH2_PROVIDER_NAME=cognito-for-gateway
OAUTH2_SCOPE_READ=agentcore-gateway-m2m-server/gateway:read
OAUTH2_SCOPE_WRITE=agentcore-gateway-m2m-server/gateway:write
```

`GATEWAY_ENDPOINT_URL` は、[cdk-gateway](../cdk-gateway) デプロイ時の `GatewayUrl` 出力値に `/mcp` を追加したものです。

### Runtime を使用する場合

```bash
# Runtime ARN (CDKデプロイ時の RuntimeArn 出力値)
RUNTIME_ARN=arn:aws:bedrock-agentcore:us-east-1:<account-id>:runtime/<runtime-id>

# OAuth2 Settings (CDKデプロイ時の出力値)
OAUTH2_PROVIDER_NAME=cognito-for-runtime
OAUTH2_SCOPE_READ=agentcore-runtime-m2m-server/runtime:read
OAUTH2_SCOPE_WRITE=agentcore-runtime-m2m-server/runtime:write
```

`RUNTIME_ARN` は、[cdk-runtime-mcp](../../agentcore-runtime-mcp/cdk-runtime-mcp) デプロイ時の `RuntimeArn` 出力値です。Runtime を使用する場合、`GATEWAY_ENDPOINT_URL` は不要です。

## 認証フロー

1. `@requires_access_token` デコレーターが OAuth2 Client Credentials フローを実行
2. Cognito から JWT アクセストークンを取得
3. トークンを `Authorization: Bearer` ヘッダーに設定
4. Gateway に MCP リクエストを送信

## トラブルシューティング

### 401 Unauthorized エラー

**原因**: アクセストークンが無効または期限切れ

**解決方法**:
- OAuth2 プロバイダーが正しく作成されているか確認
- `.env` の `OAUTH2_PROVIDER_NAME` が正しいか確認

```bash
cd ../../agentcore-identity
uv run python create_identity.py
```

### 環境変数エラー

**原因**: 必須の環境変数が設定されていない

**解決方法**: `agentcore-identity/.env` を確認

```bash
cat ../../agentcore-identity/.env
```

### タイムアウトエラー

**原因**: Gateway または Lambda の応答が遅い

**解決方法**: `timeout` パラメータを増やす（デフォルト: 120-300秒）

## プロジェクト構造

```
mcp-client/
├── agent.py              # Strands Agentを使用したMCPクライアント
├── get_tool.py           # ツール一覧取得スクリプト
├── pyproject.toml        # Python依存関係
├── .agentcore.json       # AgentCore設定
└── README.md             # このファイル
```

## 参考資料

- [Strands Agents Documentation](https://github.com/anthropics/strands)
- [Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/)
- [Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html)
