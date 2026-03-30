"""Check backend logs and price DB status."""
import paramiko
from pathlib import Path

env = {}
for line in (Path(__file__).parent / ".env").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

def run_ssh(client, cmd, timeout=30):
    print(f"\n>>> {cmd}", flush=True)
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out.strip(): print(out.strip(), flush=True)
    if err.strip(): print(f"STDERR: {err.strip()}", flush=True)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(env["VPS_HOST"], username=env["VPS_SSH_USER"], password=env["VPS_SSH_PASSWORD"], timeout=30)
print("Connected!")

# Check backend logs for errors
run_ssh(client, "docker logs cbmih-backend --tail 50 2>&1")

# Check if price DB exists and has data
run_ssh(client, "docker exec cbmih-backend ls -la /app/data/ 2>&1")
run_ssh(client, "docker exec cbmih-backend python -c \"import sqlite3; conn=sqlite3.connect('/app/data/price_tracker.db'); print('tracked:', conn.execute('SELECT COUNT(*) FROM tracked_products').fetchone()); print('history:', conn.execute('SELECT COUNT(*) FROM price_history').fetchone()); conn.close()\" 2>&1")

client.close()
