```
$ uv run call_list_tools.py
{
  "jsonrpc": "2.0",
  "id": "list-tools",
  "result": {
    "tools": [
      {
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string"
            }
          },
          "required": [
            "query"
          ]
        },
        "name": "x_amz_bedrock_agentcore_search",
        "description": "A special tool that returns a trimmed down list of tools given a context. Use this tool only when there are many tools available and you want to get a subset that matches the provided context."
      },
      {
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": {
              "description": "The name of the user.",
              "type": "string"
            }
          },
          "required": [
            "name"
          ]
        },
        "name": "LambdaTarget___greet_user",
        "description": "Greet a user by name"
      }
    ]
  }
}

$ uv run call_semantic_search.py
{
  "jsonrpc": "2.0",
  "id": "search-tools-request",
  "result": {
    "structuredContent": {
      "tools": [
        {
          "inputSchema": {
            "type": "object",
            "properties": {
              "name": {
                "description": "The name of the user.",
                "type": "string"
              }
            },
            "required": [
              "name"
            ]
          },
          "name": "LambdaTarget___greet_user",
          "description": "Greet a user by name"
        }
      ]
    },
    "isError": false,
    "content": [
      {
        "type": "text",
        "text": "{\"tools\":[{\"inputSchema\":{\"type\":\"object\",\"properties\":{\"name\":{\"description\":\"The name of the user.\",\"type\":\"string\"}},\"required\":[\"name\"]},\"name\":\"LambdaTarget___greet_user\",\"description\":\"Greet a user by name\"}]}"
      }
    ]
  }
}
```
