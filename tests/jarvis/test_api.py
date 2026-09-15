from http.client import HTTPConnection

from jarvis.api import make_server


def test_http_chat_and_status(app):
    httpd = make_server("127.0.0.1", 0, app)
    host, port = httpd.server_address
    import threading

    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        conn = HTTPConnection("127.0.0.1", port, timeout=30)
        conn.request("GET", "/api/status")
        status = conn.getresponse()
        body = status.read().decode("utf-8")
        assert status.status == 200
        assert "JARVIS" in body
        conn.request("POST", "/api/chat", body='{"text":"Explain this project to me."}', headers={"Content-Type": "application/json"})
        chat = conn.getresponse()
        payload = chat.read().decode("utf-8")
        assert chat.status == 200
        assert "mission" in payload or "reply" in payload
        conn.request("POST", "/api/stop")
        assert conn.getresponse().status == 200
        conn.request("POST", "/api/chat", body='{"text":"Explain this project to me."}', headers={"Content-Type": "application/json"})
        stopped = conn.getresponse()
        stopped_body = stopped.read().decode("utf-8")
        assert stopped.status == 200
        assert "mission" not in stopped_body or '"kind": "halt"' in stopped_body or "stopped" in stopped_body.lower()
        conn.request("POST", "/api/resume")
        assert conn.getresponse().status == 200
        conn.request("GET", "/")
        page = conn.getresponse()
        html = page.read().decode("utf-8")
        assert "What would you like me to do?" in html
        assert "Resume" in html
        assert "halt-banner" in html
    finally:
        httpd.shutdown()
