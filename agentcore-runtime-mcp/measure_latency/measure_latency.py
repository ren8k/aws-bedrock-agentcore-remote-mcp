import asyncio
import os
import time
from statistics import mean, median, stdev

from bedrock_agentcore.identity.auth import requires_access_token
from dotenv import load_dotenv
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

load_dotenv(override=True, dotenv_path="../../agentcore-identity/.env")


@requires_access_token(
    provider_name=os.getenv("OAUTH2_PROVIDER_NAME"),
    scopes=[
        os.getenv("OAUTH2_SCOPE_READ"),
        os.getenv("OAUTH2_SCOPE_WRITE"),
    ],
    auth_flow="M2M",
)
async def get_access_token(*, access_token: str) -> str:
    return access_token


def validate_env_vars():
    required = [
        "RUNTIME_ARN",
        "OAUTH2_PROVIDER_NAME",
        "OAUTH2_SCOPE_READ",
        "OAUTH2_SCOPE_WRITE",
    ]
    missing = [var for var in required if not os.getenv(var)]
    if missing:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing)}"
        )


def get_mcp_endpoint(runtime_arn: str, region: str = "us-east-1") -> str:
    encoded_arn = runtime_arn.replace(":", "%3A").replace("/", "%2F")
    return f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations?qualifier=DEFAULT"


def print_iteration_results(iteration: int, total: int, times: dict):
    print(f"\n📊 Iteration {iteration}/{total}")
    print(f"  Connection: {times['connection'] * 1000:.2f}ms")
    print(f"  Initialize: {times['initialize'] * 1000:.2f}ms")
    print(f"  List Tools: {times['list_tools'] * 1000:.2f}ms")
    if times.get("call_tool"):
        print(f"  Call Tool:  {times['call_tool'] * 1000:.2f}ms")
    print(f"  Total: {times['total'] * 1000:.2f}ms")


def print_statistics(latencies: dict):
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


async def run_mcp_operations(session: ClientSession, test_args: dict):
    times = {}

    start = time.perf_counter()
    await session.initialize()
    times["initialize"] = time.perf_counter() - start

    start = time.perf_counter()
    tools = await session.list_tools()
    times["list_tools"] = time.perf_counter() - start

    if tools.tools:
        start = time.perf_counter()
        await session.call_tool(tools.tools[0].name, arguments=test_args)
        times["call_tool"] = time.perf_counter() - start

    return times


async def run_single_iteration(endpoint: str, access_token: str, test_args: dict):
    headers = {"Authorization": f"Bearer {access_token}"}

    start_total = time.perf_counter()

    async with streamablehttp_client(
        endpoint, headers, timeout=120, terminate_on_close=False
    ) as (read_stream, write_stream, _):
        conn_time = time.perf_counter() - start_total

        async with ClientSession(read_stream, write_stream) as session:
            operation_times = await run_mcp_operations(session, test_args)

    return {
        "connection": conn_time,
        "total": time.perf_counter() - start_total,
        **operation_times,
    }


async def measure_latency(
    endpoint: str, access_token: str, iterations: int, test_args: dict
):
    latencies = {
        "connection": [],
        "initialize": [],
        "list_tools": [],
        "call_tool": [],
        "total": [],
    }

    for i in range(iterations):
        times = await run_single_iteration(endpoint, access_token, test_args)

        latencies["connection"].append(times["connection"])
        latencies["initialize"].append(times["initialize"])
        latencies["list_tools"].append(times["list_tools"])
        latencies["total"].append(times["total"])
        if times.get("call_tool"):
            latencies["call_tool"].append(times["call_tool"])

        print_iteration_results(i + 1, iterations, times)
        time.sleep(2)

    print_statistics(latencies)


async def main():
    validate_env_vars()

    access_token = await get_access_token(access_token="")
    runtime_arn = os.getenv("RUNTIME_ARN", "")
    mcp_endpoint = get_mcp_endpoint(runtime_arn)
    test_args = {"name": "Jack"}

    await measure_latency(
        mcp_endpoint, access_token, iterations=50, test_args=test_args
    )


if __name__ == "__main__":
    asyncio.run(main())
