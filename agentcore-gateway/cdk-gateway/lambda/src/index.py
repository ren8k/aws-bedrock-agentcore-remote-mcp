from openai import OpenAI

INSTRUCTIONS = """
- You must answer the question using web_search tool.
- You must respond in japanese.
"""


def openai_web_search(question: str) -> str:
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
        tools=[{"type": "web_search"}],
        # reasoning={"effort": "high"},
        instructions=INSTRUCTIONS,
        input=question,
    )
    return response.output_text


def lambda_handler(event, context):
    try:
        result = openai_web_search(event.get("question"))
        return {"statusCode": 200, "body": result}
    except Exception as e:
        return {"statusCode": 500, "body": f"Error occurred: {str(e)}"}
