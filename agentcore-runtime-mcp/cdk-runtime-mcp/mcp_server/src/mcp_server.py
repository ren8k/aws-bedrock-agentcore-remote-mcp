from mcp.server.fastmcp import FastMCP
from openai import OpenAI
from pydantic import Field

INSTRUCTIONS = """
- You must answer the question using web_search tool.
- You must respond in japanese.
"""

mcp = FastMCP(name="openai-web-search-mcp-server", host="0.0.0.0", stateless_http=True)


@mcp.tool()
def openai_gpt5_web_search(
    question: str = Field(
        description="""Question text to send to OpenAI o3. It supports natural language queries.
        Write in Japanese. Be direct and specific about your requirements.
        Avoid chain-of-thought instructions like "think step by step" as o3 handles reasoning internally."""
    ),
) -> str:
    """An AI agent with advanced web search capabilities. Useful for finding the latest information,
    troubleshooting errors, and discussing ideas or design challenges. Supports natural language queries.

    Args:
        question: The search question to perform.

    Returns:
        str: The search results with advanced reasoning and analysis.
    """
    try:
        client = OpenAI()
        response = client.responses.create(
            model="gpt-5",
            tools=[{"type": "web_search"}],
            instructions=INSTRUCTIONS,
            input=question,
        )
        return response.output_text
    except Exception as e:
        return f"Error occurred: {str(e)}"


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
