"""Deploy to VPS via SSH using paramiko."""
import paramiko
import time
import sys
from pathlib import Path

# Load .env
env = {}
env_path = Path(__file__).parent / ".env"
for line in env_path.read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

HOST = env["VPS_HOST"]
USER = env["VPS_SSH_USER"]
PASSWORD = env["VPS_SSH_PASSWORD"]
API_KEY = env["FEATHERLESS_API_KEY"]
API_URL = env.get("FEATHERLESS_API_URL", "https://api.featherless.ai/v1")
LLM_MODEL = env.get("LLM_MODEL", "Qwen/Qwen3-32B")
DOMAIN = env.get("DOMAIN", "https://vine.werewolfhowl.com")


def run_ssh(client, cmd, timeout=300):
    """Run a command via SSH and stream output."""
    print(f"\n>>> {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.strip(), flush=True)
    if err.strip():
        print(f"STDERR: {err.strip()}", flush=True)
    if exit_code != 0:
        print(f"EXIT CODE: {exit_code}", flush=True)
    return exit_code, out, err


def main():
    print(f"Connecting to {USER}@{HOST}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
        print("Connected!\n")
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)

    # Step 1: Install Docker if needed
    run_ssh(client, "which docker || (curl -fsSL https://get.docker.com | sh)", timeout=120)
    run_ssh(client, "docker compose version || (apt-get update -qq && apt-get install -y -qq docker-compose-plugin)", timeout=120)

    # Step 2: Install git if needed
    run_ssh(client, "which git || (apt-get update -qq && apt-get install -y -qq git)")

    # Step 3: Clone or update repo
    run_ssh(client, """
if [ -d /root/AmazonReview ]; then
  cd /root/AmazonReview && git fetch origin && git reset --hard origin/main
else
  cd /root && git clone https://github.com/BattlehobbitWork/AmazonReview.git
fi
""")

    # Step 4: Write .env (using heredoc via echo)
    env_content = (
        f"FEATHERLESS_API_KEY={API_KEY}\\n"
        f"FEATHERLESS_API_URL={API_URL}\\n"
        f"LLM_MODEL={LLM_MODEL}\\n"
        f"VPS_HOST={HOST}\\n"
        f"DOMAIN={DOMAIN}\\n"
    )
    run_ssh(client, f'printf "{env_content}" > /root/AmazonReview/.env')
    run_ssh(client, "cat /root/AmazonReview/.env")

    # Step 5: Build and deploy
    run_ssh(client, "cd /root/AmazonReview && docker compose down --remove-orphans 2>/dev/null; true")
    code, out, err = run_ssh(client, "cd /root/AmazonReview && docker compose up -d --build", timeout=600)

    if code != 0:
        print("\n!!! Docker build failed !!!")
        sys.exit(1)

    # Step 6: Wait and verify
    print("\nWaiting 10s for containers to start...")
    time.sleep(10)
    run_ssh(client, "cd /root/AmazonReview && docker compose ps")
    run_ssh(client, "curl -s http://localhost:8000/api/health")
    run_ssh(client, "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/")

    print("\n=== DEPLOYMENT COMPLETE ===")
    print(f"Site should be live at {DOMAIN}")

    client.close()


if __name__ == "__main__":
    main()
