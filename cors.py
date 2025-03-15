import json
import aiohttp
from fastapi import FastAPI, Request, Response, WebSocket, HTTPException
from fastapi.responses import StreamingResponse

app = FastAPI()

def safe_json_loads(data: str, default=None):
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError):
        return default if default is not None else {}

async def stream_response(url, headers):
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    async for chunk in resp.content.iter_any(1024 * 512):  # Increased chunk size for better streaming
                        yield chunk
                else:
                    raise HTTPException(status_code=resp.status, detail=f"Error fetching URL: {resp.status}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

def modify_m3u8(content: str, base_url: str) -> str:
    lines = content.split("\n")
    new_lines = []
    for line in lines:
        if line.startswith("#"):
            new_lines.append(line)
        elif line.strip():
            if not line.startswith("http"):
                line = f"{base_url}/{line}"
            new_lines.append(line)
    return "\n".join(new_lines)

@app.get("/cors")
async def cors(request: Request) -> Response:
    url = request.query_params.get("url")
    file_type = request.query_params.get("type")
    headers = {key: value for key, value in request.headers.items() if key.lower() not in ["host", "accept-encoding"]}
    headers.update(safe_json_loads(request.query_params.get("headers", "{}")))

    if not url:
        raise HTTPException(status_code=400, detail="URL parameter is required.")

    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url, headers=headers) as resp:
                if file_type == "m3u8":
                    content = await resp.text()
                    content = modify_m3u8(content, url.rsplit("/", 1)[0])
                    return Response(content, headers={
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': "public, max-age=1800, stale-while-revalidate=60, must-revalidate",
                    })
                return StreamingResponse(stream_response(url, headers), headers={
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': "public, max-age=1800, stale-while-revalidate=60, must-revalidate",
                })
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        try:
            data = await websocket.receive_text()
            await websocket.send_text(f"Received: {data}")
        except Exception as e:
            await websocket.close(code=1011)
            break

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
