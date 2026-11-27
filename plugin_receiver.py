
import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent

HOST = "127.0.0.1"
PORT = 8765

INPUT_FILE = ROOT / "dataset" / "new_dashboard" / "figma_data.json"

# Add your original pipeline scripts here once their exact names are confirmed.
# Do not leave this empty when you expect automatic ML processing.
PIPELINE = []


class Handler(BaseHTTPRequestHandler):

    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {
                "status": "running",
                "receiver": "Figma plugin receiver",
                "port": PORT
            })
        else:
            self.send_json(404, {"error": "Unknown endpoint"})

    def do_POST(self):
        print(f"\nIncoming request: {self.command} {self.path}")

        if self.path != "/ingest":
            self.send_json(404, {"error": "Unknown endpoint"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))

            if length <= 0:
                self.send_json(400, {"error": "Empty request"})
                return

            raw_data = self.rfile.read(length)
            payload = json.loads(raw_data.decode("utf-8"))

            if not isinstance(payload, dict):
                self.send_json(400, {
                    "error": "Expected a JSON object"
                })
                return

            if "document" not in payload:
                self.send_json(400, {
                    "error": "Missing document in design data"
                })
                return

            INPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

            INPUT_FILE.write_text(
                json.dumps(payload, indent=2),
                encoding="utf-8"
            )

            print(f"Figma data saved: {INPUT_FILE}")
            print("Figma data received successfully.")

            logs = []

            if not PIPELINE:
                self.send_json(200, {
                    "message": "Figma data received and saved successfully. Pipeline has not been configured.",
                    "saved_to": str(INPUT_FILE),
                    "pipeline_executed": False
                })
                return

            for label, script in PIPELINE:
                script_path = ROOT / script

                if not script_path.exists():
                    self.send_json(500, {
                        "error": f"Pipeline script not found: {script}"
                    })
                    return

                print(f"\nRunning pipeline step: {label}")

                result = subprocess.run(
                    [sys.executable, str(script_path)],
                    cwd=str(ROOT),
                    capture_output=True,
                    text=True,
                    timeout=600
                )

                logs.append({
                    "step": label,
                    "return_code": result.returncode,
                    "stdout": result.stdout[-4000:],
                    "stderr": result.stderr[-4000:]
                })

                if result.returncode != 0:
                    print(result.stderr)

                    self.send_json(500, {
                        "error": f"{label} failed",
                        "details": result.stderr[-3000:],
                        "logs": logs
                    })
                    return

            self.send_json(200, {
                "message": "Design received and pipeline completed.",
                "saved_to": str(INPUT_FILE),
                "pipeline_executed": True,
                "logs": logs
            })

        except json.JSONDecodeError:
            self.send_json(400, {
                "error": "Invalid JSON received from Figma"
            })

        except Exception as exc:
            print(f"Receiver error: {exc}")
            self.send_json(500, {
                "error": str(exc)
            })

    def log_message(self, format, *args):
        print(
            "%s - %s" % (
                self.address_string(),
                format % args
            )
        )


class ReceiverServer(ThreadingHTTPServer):
    address_family = 2 # IPv6
    allow_reuse_address = True

if __name__ == "__main__":
    server = ReceiverServer((HOST, PORT), Handler)

    print("=" * 50)
    print("FIGMA PLUGIN RECEIVER")
    print("=" * 50)
    print(f"Receiver: http://{HOST}:{PORT}")
    print(f"Health:   http://{HOST}:{PORT}/health")
    print(f"Ingest:   http://{HOST}:{PORT}/ingest")
    print(f"Output:   {INPUT_FILE}")
    print("=" * 50)
    print("Waiting for Figma plugin...")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping receiver.")
    finally:
        server.server_close()
