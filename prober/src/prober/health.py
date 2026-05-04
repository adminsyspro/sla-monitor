from typing import Callable
from aiohttp import web


def make_health_app(get_last_poll_at: Callable[[], int | None]) -> web.Application:
    async def handler(_request: web.Request) -> web.Response:
        return web.json_response({
            "status": "ok",
            "last_poll_at": get_last_poll_at(),
        })
    app = web.Application()
    app.router.add_get("/health", handler)
    return app


async def run_health_server(get_last_poll_at: Callable[[], int | None],
                             port: int = 8000) -> web.AppRunner:
    app = make_health_app(get_last_poll_at)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    return runner
