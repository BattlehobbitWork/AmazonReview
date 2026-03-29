"""Audit VPS: check all running containers and ports. DO NOT MODIFY ANYTHING."""
import paramiko
from pathlib import Path

env = {}
for line in (Path(__file__).parent / ".env").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

def run_ssh(client, cmd):
    print(f"\n>>> {cmd}", flush=True)
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out.strip(): print(out.strip(), flush=True)
    if err.strip(): print(f"STDERR: {err.strip()}", flush=True)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(env["VPS_HOST"], username=env["VPS_SSH_USER"], password=env["VPS_SSH_PASSWORD"], timeout=30)
print("Connected - AUDIT ONLY, no changes\n")

run_ssh(client, "echo '=== ALL DOCKER CONTAINERS (including stopped) ==='")
run_ssh(client, "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'")
run_ssh(client, "echo '=== ALL LISTENING PORTS ==='")
run_ssh(client, "ss -tlnp")
run_ssh(client, "echo '=== DOCKER NETWORKS ==='")
run_ssh(client, "docker network ls")
run_ssh(client, "echo '=== DOCKER COMPOSE PROJECTS ==='")
run_ssh(client, "docker compose ls 2>/dev/null || true")
run_ssh(client, "echo '=== SYSTEMD SERVICES (nginx/apache) ==='")
run_ssh(client, "systemctl is-active nginx 2>/dev/null; systemctl is-active apache2 2>/dev/null; echo done")

client.close()
print("\n=== AUDIT COMPLETE ===")
