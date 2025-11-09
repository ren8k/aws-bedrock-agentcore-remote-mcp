# AgentCore Gateway Lambda MCP Stack

このプロジェクトは、AWS CDK を使用して Amazon Bedrock AgentCore Gateway をデプロイし、OpenAI o3 モデルを利用した Web 検索機能を MCP（Model Context Protocol）経由で提供するインフラストラクチャです。

## 概要

このスタックは以下の AWS リソースをデプロイします：

- **Lambda Function**: OpenAI o3 による Web 検索を実行するバックエンド
- **Lambda Layer**: Python 依存関係（fastapi、openai）
- **Amazon Cognito**: ユーザープール、リソースサーバー、M2M クライアント認証
- **Bedrock AgentCore Gateway**: MCP プロトコルによるゲートウェイ
- **Gateway Target**: Lambda 統合とツールスキーマ定義

## アーキテクチャ

```
┌─────────────────┐
│  Bedrock Agent  │
└────────┬────────┘
         │ JWT Auth (Cognito)
         ↓
┌─────────────────────┐
│  AgentCore Gateway  │
│   (MCP Protocol)    │
└────────┬────────────┘
         │ IAM Role Auth
         ↓
┌─────────────────────┐
│  Lambda Function    │
│  (OpenAI o3 + Web)  │
└─────────────────────┘
```

### 認証フロー

1. **Inbound 認証**: Cognito JWT トークンによるゲートウェイへのアクセス制御
2. **Outbound 認証**: ゲートウェイの IAM ロールによる Lambda 呼び出し

## 前提条件

- Node.js 18 以上
- AWS CLI 設定済み（`aws configure`）
- AWS CDK CLI（`npm install -g aws-cdk`）
- OpenAI API キー（o3 アクセス権限）
- Docker デーモン起動中（Lambda Layer のビルドに必要）

## セットアップ

### 1. 環境変数の設定

```bash
cd agentcore-gateway/cdk-gateway

# .envファイルを作成
cp .env.example .env

# エディタで.envファイルを開き、OpenAI APIキーを設定
# OPENAI_API_KEY=sk-proj-...
```

### 2. 依存関係のインストール

```bash
npm ci
```

### 3. TypeScript のビルド

```bash
npm run build
```

### 4. CDK Bootstrap（初回のみ）

AWS アカウントとリージョンで初めて CDK を使用する場合：

```bash
npx cdk bootstrap
```

## デプロイ

### スタックのデプロイ

```bash
npx cdk deploy
```

デプロイ時に以下のリソースの作成が確認されます：

- IAM ロールとポリシー
- Lambda 関数とレイヤー
- Cognito 認証リソース
- AgentCore ゲートウェイ

プロンプトで `y` を入力して続行してください。

### デプロイ出力

デプロイ成功後、以下の情報が出力されます：

```
Outputs:
AgentCoreGatewayLambdaMCPStack.UserPoolClientId = <client-id>
AgentCoreGatewayLambdaMCPStack.UserPoolClientSecret = <client-secret>
AgentCoreGatewayLambdaMCPStack.CustomScopeRead = agentcore-gateway-m2m-server/gateway:read
AgentCoreGatewayLambdaMCPStack.CustomScopeWrite = agentcore-gateway-m2m-server/gateway:write
AgentCoreGatewayLambdaMCPStack.CognitoDiscoveryUrl = https://cognito-idp.us-east-1.amazonaws.com/<user-pool-id>/.well-known/openid-configuration
AgentCoreGatewayLambdaMCPStack.GatewayUrl = https://<gateway-id>.agentcore.us-east-1.amazonaws.com
```

**重要**: これらの値は後で使用するため、安全な場所に保存してください。

## 使用方法

### 1. Cognito トークンの取得

```bash
# Client IDとClient Secretを環境変数に設定
export CLIENT_ID="<UserPoolClientId>"
export CLIENT_SECRET="<UserPoolClientSecret>"
export USER_POOL_DOMAIN="agentcore-<stack-id>"
export REGION="us-east-1"

# アクセストークンを取得
TOKEN=$(curl -X POST \
  "https://${USER_POOL_DOMAIN}.auth.${REGION}.amazoncognito.com/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&scope=agentcore-gateway-m2m-server/gateway:read agentcore-gateway-m2m-server/gateway:write" \
  | jq -r '.access_token')

echo "Token: $TOKEN"
```

### 2. Bedrock Agent からの利用

Bedrock Agent の設定で以下を指定：

- **Gateway URL**: デプロイ出力の`GatewayUrl`
- **Authentication**: Custom JWT
- **Token**: 上記で取得したトークン

### 3. ツールの呼び出し

Bedrock Agent から`openai_deep_research`ツールを呼び出すことで、OpenAI o3 の Web 検索機能を利用できます。

```json
{
  "name": "openai_deep_research",
  "parameters": {
    "question": "最新のAWS Bedrockの機能について教えてください"
  }
}
```

## プロジェクト構造

```
cdk-gateway/
├── bin/
│   └── agentcore-gateway-mcp.ts       # CDKアプリケーションのエントリーポイント
├── lib/
│   └── agentcore-gateway-mcp-stack.ts # メインスタック定義
├── lambda/
│   ├── src/
│   │   └── index.py                   # Lambda関数コード
│   └── layers/
│       └── requirements.txt           # Python依存関係
├── .env.example                       # 環境変数のサンプル
├── .env                              # 環境変数（未コミット）
├── package.json                       # Node.js依存関係
├── tsconfig.json                      # TypeScript設定
└── cdk.json                          # CDK設定
```

## CDK コマンド

```bash
# TypeScriptのビルド
npm run build

# ウォッチモード（自動ビルド）
npm run watch

# テストの実行
npm run test

# CloudFormationテンプレートの確認
npx cdk synth

# デプロイ前の差分確認
npx cdk diff

# デプロイ
npx cdk deploy

# スタックの削除
npx cdk destroy
```

## トラブルシューティング

### Lambda Layer のビルドエラー

**症状**: `bundling failed` エラー

**解決方法**: Docker デーモンが起動していることを確認してください。

```bash
docker ps
```

### OpenAI API キーエラー

**症状**: デプロイ時に `openaiApiKey must be provided` エラー

**解決方法**: `.env`ファイルに正しい API キーが設定されているか確認してください。

```bash
cat .env
# OPENAI_API_KEY=sk-proj-... が正しく設定されているか確認
```

### Cognito 認証エラー

**症状**: `401 Unauthorized` エラー

**解決方法**:

1. トークンの有効期限を確認（デフォルト 1 時間）
2. スコープが正しいか確認（`gateway:read` と `gateway:write`）
3. トークンをデコードして検証：

```bash
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq
```

## セキュリティに関する注意事項

1. **Client Secret**: 本番環境では、AWS Secrets Manager などに保存することを推奨します。CloudFormation 出力には含めないでください。
2. **OpenAI API キー**: Lambda 環境変数に暗号化して保存されますが、より厳重な管理には Secrets Manager を使用してください。
3. **IAM ポリシー**: 本スタックは開発用に広範な権限を付与しています。本番環境では最小権限の原則に従って制限してください。

## クリーンアップ

リソースの削除：

```bash
npx cdk destroy
```

削除の確認プロンプトで `y` を入力してください。

**注意**:

- Cognito User Pool は `RemovalPolicy.DESTROY` が設定されているため、スタック削除時に自動的に削除されます。
- Lambda 関数と Layer も削除されます。
- S3 バケット（CDK Assets）は手動削除が必要な場合があります。

## 参考資料

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html)
- [Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)
- [Amazon Cognito OAuth 2.0](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html)

## ライセンス

This project is licensed under the MIT License.
