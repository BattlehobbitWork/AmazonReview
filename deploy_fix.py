"""Fix port 80 conflict and restart containers."""
import paramiko
import time
import sys
from pathlib import Path

env = {}
for line in (Path(__file__).parent / ".env").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

def run_ssh(client, cmd, timeout=300):
    print(f"\n>>> {cmd}", flush=True)
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    if out.strip(): print(out.strip(), flush=True)
    if err.strip(): print(f"STDERR: {err.strip()}", flush=True)
    if exit_code != 0: print(f"EXIT CODE: {exit_code}", flush=True)
    return exit_code, out, err

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(env["VPS_HOST"], username=env["VPS_SSH_USER"], password=env["VPS_SSH_PASSWORD"], timeout=30)
print("Connected!")

# Find what's using port 80
run_ssh(client, "ss -tlnp | grep :80")

# Stop common culprits
run_ssh(client, "systemctl stop nginx 2>/dev/null; systemctl disable nginx 2>/dev/null; true")
run_ssh(client, "systemctl stop apache2 2>/dev/null; systemctl disable apache2 2>/dev/null; true")
run_ssh(client, "fuser -k 80/tcp 2>/dev/null; true")

time.sleep(2)

# Now start the containers
run_ssh(client, "cd /root/AmazonReview && docker compose up -d", timeout=120)

time.sleep(8)
run_ssh(client, "cd /root/AmazonReview && docker compose ps")
run_ssh(client, "curl -s http://localhost:8000/api/health")
run_ssh(client, "curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:80/")

print("\n=== DONE ===")
client.close()
