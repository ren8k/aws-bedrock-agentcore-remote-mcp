def greet_user(name: str) -> str:
    """Greet a user by name
    Args:
        name: The name of the user.
    """
    return f"Hello, {name}! Nice to meet you. This is a test message."


def lambda_handler(event, context):
    try:
        result = greet_user(event.get("name"))
        return {"statusCode": 200, "body": result}
    except Exception as e:
        return {"statusCode": 500, "body": f"Error occurred: {str(e)}"}
