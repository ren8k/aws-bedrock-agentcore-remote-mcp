import asyncio
import os
import time
from statistics import mean, median, stdev

from bedrock_agentcore.identity.auth import requires_access_token
from dotenv import load_dotenv
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

load_dotenv(override=True, dotenv_path="../../agentcore-identity/.env")
TEST_ARGS = {"name": "Jack"}


@requires_access_token(
    provider_name=os.getenv("OAUTH2_PROVIDER_NAME"),
    scopes=[
        os.getenv("OAUTH2_SCOPE_READ"),
        os.getenv("OAUTH2_SCOPE_WRITE"),
    ],
    auth_flow="M2M",
)
async def get_access_token(*, access_token: str):
    global ACCESS_TOKEN
    ACCESS_TOKEN = access_token


def get_mcp_endpoint(runtime_arn: str, region: str = "us-east-1") -> str:
    encoded_arn = runtime_arn.replace(":", "%3A").replace("/", "%2F")
    return f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations?qualifier=DEFAULT"


async def measure_latency(iterations: int = 10):
    await get_access_token(access_token="")

    runtime_arn = os.getenv("RUNTIME_ARN", "")
    mcp_endpoint = get_mcp_endpoint(runtime_arn)
    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}

    latencies = {
        "connection": [],
        "initialize": [],
        "list_tools": [],
        "call_tool": [],
        "total": [],
    }

    for i in range(iterations):
        print(f"\n📊 Iteration {i + 1}/{iterations}")

        start_total = time.perf_counter()

        start_conn = time.perf_counter()
        async with streamablehttp_client(
            mcp_endpoint, headers, timeout=120, terminate_on_close=False
        ) as (read_stream, write_stream, _):
            conn_time = time.perf_counter() - start_conn
            latencies["connection"].append(conn_time)

            async with ClientSession(read_stream, write_stream) as session:
                start_init = time.perf_counter()
                await session.initialize()
                init_time = time.perf_counter() - start_init
                latencies["initialize"].append(init_time)

                start_list = time.perf_counter()
                tools = await session.list_tools()
                list_time = time.perf_counter() - start_list
                latencies["list_tools"].append(list_time)

                if tools.tools:
                    tool = tools.tools[0]
                    start_call = time.perf_counter()
                    await session.call_tool(tool.name, arguments=TEST_ARGS)
                    call_time = time.perf_counter() - start_call
                    latencies["call_tool"].append(call_time)

        total_time = time.perf_counter() - start_total
        latencies["total"].append(total_time)

        print(f"  Connection: {conn_time * 1000:.2f}ms")
        print(f"  Initialize: {init_time * 1000:.2f}ms")
        print(f"  List Tools: {list_time * 1000:.2f}ms")
        if latencies["call_tool"]:
            print(f"  Call Tool:  {latencies['call_tool'][-1] * 1000:.2f}ms")
        print(f"  Total: {total_time * 1000:.2f}ms")
        time.sleep((2))

    print("\n" + "=" * 50)
    print("📈 LATENCY STATISTICS (ms)")
    print("=" * 50)

    for operation, times in latencies.items():
        times_ms = [t * 1000 for t in times]
        print(f"\n{operation.upper()}:")
        print(f"  Mean:   {mean(times_ms):.2f}ms")
        print(f"  Median: {median(times_ms):.2f}ms")
        print(f"  Min:    {min(times_ms):.2f}ms")
        print(f"  Max:    {max(times_ms):.2f}ms")
        if len(times_ms) > 1:
            print(f"  StdDev: {stdev(times_ms):.2f}ms")


if __name__ == "__main__":
    asyncio.run(measure_latency(iterations=10))
