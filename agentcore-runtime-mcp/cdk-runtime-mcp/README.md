# AgentCore Runtime MCP Stack

このプロジェクトは、AWS CDK を使用して Amazon Bedrock AgentCore Runtime をデプロイし、OpenAI GPT-5 モデルを利用した Web 検索機能を MCP（Model Context Protocol）経由で提供するインフラストラクチャです。

## 概要

このスタックは以下の AWS リソースをデプロイします：

- **ECR Repository**: Docker イメージの保存
- **Deploy-Time-Build (L3 Construct)**: CodeBuild と Lambda を使用したコンテナイメージのビルドとデプロイ
- **Amazon Cognito**: ユーザープール、リソースサーバー、M2M クライアント認証
- **Bedrock AgentCore Runtime**: MCP プロトコルによるランタイム環境

## アーキテクチャ

```
┌─────────────────┐
│  Bedrock Agent  │
└────────┬────────┘
         │ JWT Auth (Cognito)
         ↓
┌─────────────────────┐
│  AgentCore Runtime  │
│   (MCP Protocol)    │
└────────┬────────────┘
         │
         ↓
┌─────────────────────┐
│   MCP Server        │
│  (GPT-5 + Web)      │
└─────────────────────┘
```

## 前提条件

- Node.js 18 以上
- AWS CLI 設定済み（`aws configure`）
- AWS CDK CLI（`npm install -g aws-cdk`）
- OpenAI API キー（GPT-5 アクセス権限）

## セットアップ

### 1. 環境変数の設定

```bash
cd agentcore-runtime-mcp/cdk-runtime-mcp

# .envファイルを作成
cp .env.example .env

# エディタで.envファイルを開き、OpenAI APIキーを設定
# OPENAI_API_KEY=sk-proj-...
```

### 2. 依存関係のインストール

```bash
npm ci
```

### 3. CDK Bootstrap（初回のみ）

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
- ECR リポジトリ
- CodeBuild プロジェクト（コンテナイメージのビルド用）
- Lambda 関数（デプロイ時のビルド実行用）
- Cognito 認証リソース
- AgentCore Runtime

プロンプトで `y` を入力して続行してください。

### デプロイ出力

デプロイ成功後、以下の情報が出力されます：

```
Outputs:
AgentcoreRuntimeMcpStack.CognitoDiscoveryUrl = https://cognito-idp.us-east-1.amazonaws.com/<user-pool-id>/.well-known/openid-configuration
AgentcoreRuntimeMcpStack.CustomScopeRead = agentcore-gateway-m2m-server/gateway:read
AgentcoreRuntimeMcpStack.CustomScopeWrite = agentcore-gateway-m2m-server/gateway:write
AgentcoreRuntimeMcpStack.RuntimeArn = arn:aws:bedrock-agentcore:us-east-1:<account-id>:runtime/<runtime-id>
AgentcoreRuntimeMcpStack.UserPoolClientId = <client-id>
AgentcoreRuntimeMcpStack.UserPoolClientSecret = <client-secret>
```

**重要**: これらの値は後で使用するため、[agentcore-identity](../../agentcore-identity) ディレクトリの `.env` に保存してください。`.env` の構成については、[.env.example](../../agentcore-identity/.env.example) を参考にしてください。

## プロジェクト構造

```
cdk-runtime-mcp/
├── bin/
│   └── agentcore-runtime-mcp.ts      # CDKアプリケーションのエントリーポイント
├── lib/
│   └── agentcore-runtime-mcp-stack.ts # メインスタック定義
├── mcp_server/
│   ├── src/
│   │   └── mcp_server.py             # MCPサーバーコード
│   ├── Dockerfile                    # コンテナイメージ定義
│   └── pyproject.toml                # Python依存関係
├── .env.example                      # 環境変数のサンプル
├── .env                             # 環境変数（未コミット）
├── package.json                      # Node.js依存関係
├── tsconfig.json                     # TypeScript設定
└── cdk.json                         # CDK設定
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

### CodeBuild イメージビルドエラー

**症状**: デプロイ時にコンテナイメージのビルドが失敗する

**解決方法**: CodeBuild のログを確認してください。

```bash
aws codebuild list-projects
aws codebuild batch-get-builds --ids <build-id>
```

### OpenAI API キーエラー

**症状**: デプロイ時に `openaiApiKey must be provided` エラー

**解決方法**: `.env` ファイルに正しい API キーが設定されているか確認してください。

```bash
cat .env
# OPENAI_API_KEY=sk-proj-... が正しく設定されているか確認
```

### Runtime 起動エラー

**症状**: Runtime が正常に動作しない

**解決方法**: CloudWatch Logs で Runtime のログを確認してください。

```bash
aws logs describe-log-groups --log-group-name-prefix /aws/bedrock/agentcore
```

## セキュリティに関する注意事項

1. **Client Secret**: 本番環境では、AWS Secrets Manager などに保存することを推奨します。CloudFormation 出力には含めないでください。
2. **OpenAI API キー**: Runtime の環境変数に設定されますが、より厳重な管理には Secrets Manager を使用してください。
3. **IAM ポリシー**: 本スタックは開発用に広範な権限を付与しています。本番環境では最小権限の原則に従って制限してください。

## クリーンアップ

リソースの削除：

```bash
npx cdk destroy
```

削除の確認プロンプトで `y` を入力してください。

**注意**:

- Cognito User Pool は `RemovalPolicy.DESTROY` が設定されているため、スタック削除時に自動的に削除されます。
- ECR リポジトリとイメージも削除されます。
- CodeBuild プロジェクトと Lambda 関数も削除されます。

## 参考資料

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html)
- [Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)
- [Deploy-Time-Build CDK Construct](https://github.com/aws-samples/deploy-time-build)
