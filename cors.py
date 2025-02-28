import json
from fastapi import Request, Response, Cookie
from fastapi.responses import RedirectResponse
from request_helper import Requester
from typing import Annotated

CORS_PATH = "/cors"  # Cloudflare doesn't support os.getenv() reliably

async def cors(request: Request, origins: str, method: str = "GET") -> Response:
    """Handles CORS requests, allowing proxied requests with CORS headers."""
    
    current_domain = request.headers.get("origin", "*")  # Default to '*'
    
    # Validate origin
    allowed_origins = origins.replace(", ", ",").split(",")
    if current_domain not in allowed_origins and origins != "*":
        return Response()

    # Ensure the request has a 'url' parameter
    if "url" not in request.query_params:
        return Response()

    file_type = request.query_params.get("type")
    requested = Requester(str(request.url))
    main_url = f"{requested.host}{requested.path}?url="
    
    # Extract URL
    url = requested.query_params.get("url", "")
    if url:
        url += "?" + requested.query_string(requested.remaining_params)

    requested = Requester(url)
    headers = request.headers.mutablecopy()
    headers["Accept-Encoding"] = ""

    # Parse custom headers from query params
    try:
        headers.update(json.loads(request.query_params.get("headers", "{}").replace("'", '"')))
    except json.JSONDecodeError:
        headers.update({})

    # Perform the actual request
    content, headers, code, cookies = requested.get(
        data=None,
        headers=headers,
        cookies=request.cookies,
        method=request.query_params.get("method", method),
        json_data=json.loads(request.query_params.get("json", "{}")),
        additional_params=json.loads(request.query_params.get("params", "{}")),
    )

    # Set CORS response headers
    headers.update({
        'Access-Control-Allow-Origin': current_domain,
        'Access-Control-Allow-Methods': "GET, POST, OPTIONS",
        'Access-Control-Allow-Headers': "Content-Type, Authorization",
    })

    # Remove unnecessary headers
    for key in ['Vary', 'Content-Encoding', 'Transfer-Encoding', 'Content-Length']:
        headers.pop(key, None)

    # Modify M3U8 content if applicable
    if (file_type == "m3u8" or ".m3u8" in url) and code != 404:
        content = content.decode("utf-8")
        new_content = []
        
        for line in content.split("\n"):
            if line.startswith("#"):
                new_content.append(line)
            elif line.startswith('/'):
                new_content.append(main_url + requested.safe_sub(requested.host + line))
            elif line.startswith('http'):
                new_content.append(main_url + requested.safe_sub(line))
            elif line.strip():
                base_path = requested.host + '/'.join(requested.path.split('?')[0].split('/')[:-1])
                new_content.append(main_url + requested.safe_sub(f"{base_path}/{requested.safe_sub(line)}"))
        
        content = "\n".join(new_content)

    # Handle redirects
    if "location" in headers:
        location = headers["location"]
        headers["location"] = main_url + (requested.host + location if location.startswith("/") else location)

    # Prepare response
    response = Response(content, code, headers=headers)
    response.set_cookie("_last_requested", requested.host, max_age=3600, httponly=True)
    
    return response


def add_cors(app, origins: str, setup_with_no_url_param: bool = False):
    """Registers CORS routes with the FastAPI app."""

    @app.get(CORS_PATH)
    async def cors_get(request: Request) -> Response:
        return await cors(request, origins)

    @app.post(CORS_PATH)
    async def cors_post(request: Request) -> Response:
        return await cors(request, origins, method="POST")

    if setup_with_no_url_param:
        @app.get("/{mistaken_relative:path}")
        async def cors_redirect_get(
            request: Request, mistaken_relative: str, _last_requested: Annotated[str, Cookie(...)]) -> RedirectResponse:
            query_str = Requester(str(request.url)).query_string()
            redirect_url = f"/cors?url={_last_requested}/{mistaken_relative}{'&' + query_str if query_str else ''}"
            return RedirectResponse(redirect_url)

        @app.post("/{mistaken_relative:path}")
        async def cors_redirect_post(
            request: Request, mistaken_relative: str, _last_requested: Annotated[str, Cookie(...)]) -> RedirectResponse:
            query_str = Requester(str(request.url)).query_string()
            redirect_url = f"/cors?url={_last_requested}/{mistaken_relative}{'&' + query_str if query_str else ''}"
            return RedirectResponse(redirect_url)
