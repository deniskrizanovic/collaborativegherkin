"""Raw WebSocket upgrade probe for the Robot suite (design D9).

Port of ``connectResult`` in e2e/websocket-auth.spec.ts. Opens a raw client
socket (no browser, so the test controls the ``Cookie`` header exactly) and
reports how the upgrade ended.
"""

import time

from websockets.exceptions import ConnectionClosed, InvalidStatus
from websockets.sync.client import connect

# Safety backstop so a hung socket cannot stall the test. Covers the upgrade
# and the wait for the first message together, like the Playwright timer.
BACKSTOP_SECONDS = 3.0


def probe_websocket_upgrade(url, cookie=None):
    """Connect to ``url`` (sending ``cookie`` as the Cookie header, if given)
    and return a dictionary with three keys:

    - ``opened``: the HTTP upgrade succeeded.
    - ``status``: the HTTP status of a refused upgrade (e.g. 401), else None.
    - ``received_data``: the server sent at least one message.

    On success the server sends Y.js sync-step-1 immediately, so the first
    message is the terminal signal. A refusal, close or timeout is terminal too.
    """
    result = {"opened": False, "status": None, "received_data": False}
    headers = {"Cookie": cookie} if cookie else None
    deadline = time.monotonic() + BACKSTOP_SECONDS
    try:
        ws = connect(url, additional_headers=headers, open_timeout=BACKSTOP_SECONDS)
    except InvalidStatus as exc:
        result["status"] = exc.response.status_code
        return result
    except (OSError, TimeoutError, ConnectionClosed):
        return result
    try:
        result["opened"] = True
        ws.recv(timeout=max(deadline - time.monotonic(), 0))
        result["received_data"] = True
    except (TimeoutError, ConnectionClosed):
        pass
    finally:
        ws.close()
    return result
