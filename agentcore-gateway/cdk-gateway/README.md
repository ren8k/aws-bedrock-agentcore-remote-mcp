# AgentCore Gateway Lambda MCP Stack

本プロジェクトは、AWS CDK を使用して Amazon Bedrock AgentCore Gateway と Lambda をデプロイし、OpenAI GPT5 を利用した Web 検索機能を MCP（Model Context Protocol）経由で利用するためのサンプルです。

## 概要

このスタックは以下の AWS リソースをデプロイします：

- **Lambda Function**: OpenAI GPT5 による Web 検索を実行するバックエンド
- **Lambda Layer**: Python 依存関係（fastapi、openai）
- **Amazon Cognito**: ユーザープール、リソースサーバー、M2M クライアント認証
- **Bedrock AgentCore Gateway**: MCP プロトコルによるゲートウェイ
- **Gateway Target**: Lambda 統合とツールスキーマ定義

## アーキテクチャ

![gateway](../../assets/fig_gateway_2.png)

> [!NOTE]
> AgentCore Identity は 2025/11/20 時点では CloudFormation でデプロイできないので、boto3 でデプロイします。詳細は[本ディレクトリ](https://github.com/ren8k/aws-bedrock-agentcore-remote-mcp/blob/main/agentcore-identity)を参照して下さい。

### 認証フロー

1. **Inbound 認証**: Cognito JWT トークンによるゲートウェイへのアクセス制御
2. **Outbound 認証**: ゲートウェイの IAM ロールによる Lambda 呼び出し

## 前提条件

- Node.js 18 以上
- AWS CLI 設定済み（`aws configure`）
- AWS CDK CLI（`npm install -g aws-cdk`）
- OpenAI API キー（GPT5 アクセス権限）
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
- Lambda 関数とレイヤー
- Cognito 認証リソース
- AgentCore ゲートウェイ

プロンプトで `y` を入力して続行してください。

### デプロイ出力

デプロイ成功後、以下の情報が出力されます：

```
Outputs:
AgentCoreGatewayLambdaMCPStack.CognitoDiscoveryUrl = https://cognito-idp.us-east-1.amazonaws.com/<user-pool-id>/.well-known/openid-configuration
AgentCoreGatewayLambdaMCPStack.CustomScopeRead = agentcore-gateway-m2m-server/gateway:read
AgentCoreGatewayLambdaMCPStack.CustomScopeWrite = agentcore-gateway-m2m-server/gateway:write
AgentCoreGatewayLambdaMCPStack.GatewayUrl = https://<gateway-id>.agentcore.us-east-1.amazonaws.com
AgentCoreGatewayLambdaMCPStack.UserPoolClientId = <client-id>
AgentCoreGatewayLambdaMCPStack.UserPoolClientSecret = <client-secret>
```

**重要**: これらの値は後で使用するため、[agentcore-identity](https://github.com/ren8k/aws-bedrock-agentcore-remote-mcp/tree/main/agentcore-identity)ディレクトリの `.env` に保存してください。`.env` の構成については、[.env.example](https://github.com/ren8k/aws-bedrock-agentcore-remote-mcp/blob/main/agentcore-identity/.env.example) を参考にしてください。

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
├── .env                               # 環境変数（未コミット）
├── package.json                       # Node.js依存関係
├── tsconfig.json                      # TypeScript設定
└── cdk.json                           # CDK設定
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
