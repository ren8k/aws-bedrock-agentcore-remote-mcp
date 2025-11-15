from mcp.server.fastmcp import FastMCP
from pydantic import Field

mcp = FastMCP(name="test-greet-mcp-server", host="0.0.0.0", stateless_http=True)


@mcp.tool()
def greet_user(
    name: str = Field(description="The name of the person to greet"),
) -> str:
    """Greet a user by name
    Args:
        name: The name of the user.
    """
    return f"Hello, {name}! Nice to meet you. This is a test message."


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
