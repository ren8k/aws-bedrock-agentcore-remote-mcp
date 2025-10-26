<lambda-code>

```py
from openai import OpenAI

INSTRUCTIONS = """
- You must answer the question using web_search tool.
- You must respond in japanese.
"""


def openai_o3_web_search(question: str) -> str:
    """An AI agent with advanced web search capabilities. Useful for finding the latest information,
    troubleshooting errors, and discussing ideas or design challenges. Supports natural language queries.

    Args:
        question: The search question to perform.

    Returns:
        str: The search results with advanced reasoning and analysis.
    """
    client = OpenAI()
    response = client.responses.create(
        model="gpt-5",
        tools=[{"type": "web_search_preview"}],
        instructions=INSTRUCTIONS,
        input=question,
    )
    return response.output_text


def lambda_handler(event, context):
    try:
        result = openai_o3_web_search(event.get("question"))
        return {"statusCode": 200, "body": result}
    except Exception as e:
        return {"statusCode": 500, "body": f"Error occurred: {str(e)}"}
```

</lambda-code>
<requirements>
fastapi==0.99.0
openai
<requirements>
<instruction>
上記のPythonコードをhandlerとするLambdaをCDK（TypeScript）で実装してほしい。
ただし、以下を厳守すること。

- 環境変数には、`OPENAI_API_KEY` を設定すること。デプロイ時、`OPENAI_API_KEY` には、ローカルファイル上の.env ファイル、もしくは相応しいファイルから読み込むこと。
- タイムアウト時間は 10 分とすること。

</instruction>
