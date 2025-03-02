import json
import aiohttp
from fastapi import FastAPI, Request, Response, Cookie, WebSocket
from fastapi.responses import RedirectResponse, StreamingResponse
from typing import Annotated
from request_helper import Requester

CORS_PATH = "/cors"

app = FastAPI()

def safe_json_loads(data: str, default=None):
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError):
        return default if default is not None else {}

async def stream_response(url, headers):
    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit_per_host=50, enable_cleanup_closed=True)) as session:
        async with session.get(url, headers=headers) as resp:
            if resp.status == 200:
                async for chunk in resp.content.iter_any(1024 * 128):  # 128KB chunks for faster streaming
                    yield chunk
            else:
                yield b""

def modify_m3u8(content: str, base_url: str) -> str:
    lines = content.split("\n")
    new_lines = []
    for line in lines:
        if line.startswith("#"):
            new_lines.append(line)
        elif line.strip():
            if not line.startswith("http"):
                line = f"{base_url}/{line}"  # Ensure relative paths are resolved
            if "?" not in line:  # Avoid duplicate requests due to query params
                new_lines.append(line)
    return "\n".join(new_lines)

async def cors(request: Request, origins: str, method: str = "GET") -> Response:
    current_domain = request.headers.get("origin", "*")
    allowed_origins = [o.strip() for o in origins.split(",")]
    if current_domain not in allowed_origins and origins != "*":
        return Response(status_code=403, content="Forbidden: Origin not allowed.")
    
    if "url" not in request.query_params:
        return Response(status_code=400, content="Missing 'url' parameter.")
    
    url = request.query_params.get("url")
    file_type = request.query_params.get("type")
    headers = {key: value for key, value in request.headers.items() if key.lower() not in ["host", "accept-encoding"]}
    if "range" in request.headers:
        headers["Range"] = request.headers["Range"]
    headers.update(safe_json_loads(request.query_params.get("headers", "{}")))
    
    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit_per_host=50, enable_cleanup_closed=True)) as session:
        async with session.get(url, headers=headers) as resp:
            if file_type == "m3u8":
                content = await resp.text()
                content = modify_m3u8(content, url.rsplit("/", 1)[0])
                return Response(content, headers={
                    'Content-Type': 'application/vnd.apple.mpegurl',
                    'Access-Control-Allow-Origin': current_domain,
                    'Cache-Control': "public, max-age=1800, stale-while-revalidate=60, must-revalidate",
                })
            return StreamingResponse(stream_response(url, headers), headers={
                'Access-Control-Allow-Origin': current_domain,
                'Cache-Control': "public, max-age=1800, stale-while-revalidate=60, must-revalidate",
            })

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Received: {data}")

def add_cors(app: FastAPI, origins: str, setup_with_no_url_param: bool = False):
    @app.get(CORS_PATH)
    async def cors_get(request: Request) -> Response:
        return await cors(request, origins)

    @app.post(CORS_PATH)
    async def cors_post(request: Request) -> Response:
        return await cors(request, origins, method="POST")

    if setup_with_no_url_param:
        @app.get("/{mistaken_relative:path}")
        async def cors_redirect_get(
            request: Request, mistaken_relative: str, _last_requested: Annotated[str, Cookie(...)]
        ) -> RedirectResponse:
            query_str = Requester(str(request.url)).query_string()
            redirect_url = f"/cors?url={_last_requested}/{mistaken_relative}{'&' + query_str if query_str else ''}"
            return RedirectResponse(redirect_url)

        @app.post("/{mistaken_relative:path}")
        async def cors_redirect_post(
            request: Request, mistaken_relative: str, _last_requested: Annotated[str, Cookie(...)]
        ) -> RedirectResponse:
            query_str = Requester(str(request.url)).query_string()
            redirect_url = f"/cors?url={_last_requested}/{mistaken_relative}{'&' + query_str if query_str else ''}"
            return RedirectResponse(redirect_url)
