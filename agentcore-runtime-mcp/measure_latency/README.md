# AgentCore Runtime レイテンシー計測

AgentCore Runtime 構成の MCP サーバーのレイテンシーを計測するためのコードです。

## 前提条件

- AgentCore Runtime がデプロイ済み
  - `test_mcp_server` ディレクトリ内のコードを利用して下さい。
- AgentCore Identity が作成済み
- Python 3.13+
- uv (推奨)

## セットアップ

1. 依存関係のインストール:

```bash
uv sync
```

2. 環境変数の設定:

`../../agentcore-identity/.env` に以下を設定:

```
OAUTH2_PROVIDER_NAME=your-provider-name
OAUTH2_SCOPE_READ=your-read-scope
OAUTH2_SCOPE_WRITE=your-write-scope
RUNTIME_ARN=arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/your-runtime-id
```

## 実行

```bash
uv run measure_latency.py
```

## 計測内容

各イテレーションで以下を計測:

- Connection: 接続確立時間
- Initialize: MCP セッション初期化時間
- List Tools: ツール一覧取得時間
- Call Tool: ツール実行時間
- Total: 合計時間

デフォルトで 50 回のイテレーションを実行し、統計情報(平均、中央値、最小、最大、標準偏差)を出力します。

## カスタマイズ

`measure_latency.py` の `main()` 関数で以下を変更可能:

- `iterations`: 実行回数
- `test_args`: ツールに渡す引数
