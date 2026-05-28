import pexpect
import sys

def run_ssh_command(host, user, password, command):
    ssh_command = f"ssh -o StrictHostKeyChecking=no {user}@{host} \"{command}\""
    child = pexpect.spawn(ssh_command, timeout=20)
    
    # Режим логирования вывода
    child.logfile_read = sys.stdout.buffer
    
    try:
        index = child.expect(["password:", pexpect.EOF, pexpect.TIMEOUT])
        if index == 0:
            child.sendline(password)
            child.expect(pexpect.EOF)
        elif index == 1:
            print("\nConnection closed immediately.")
        elif index == 2:
            print("\nTimeout waiting for password prompt.")
    except Exception as e:
        print(f"\nError occurred: {str(e)}")
    finally:
        child.close()

def run_ssh_command(host, user, password, command):
    child = pexpect.spawn(f"ssh -o StrictHostKeyChecking=no {user}@{host} \"{command}\"", timeout=30)
    child.logfile_read = sys.stdout.buffer
    try:
        index = child.expect(["password:", pexpect.EOF, pexpect.TIMEOUT])
        if index == 0:
            child.sendline(password)
            child.expect(pexpect.EOF)
    except Exception as e:
        print(f"\nError occurred: {str(e)}")
    finally:
        child.close()

if __name__ == "__main__":
    host = "192.168.20.23"
    user = "nik"
    password = "Polymedia!10"
    
    print("--- Fetching Authentik Server Errors ---")
    run_ssh_command(host, user, password, "docker logs --tail=500 authentik-server-1 2>&1 | grep -i -E 'error|warn|fail' | head -n 50")
    print("--- Fetching Authentik Worker Errors ---")
    run_ssh_command(host, user, password, "docker logs --tail=500 authentik-worker-1 2>&1 | grep -i -E 'error|warn|fail' | head -n 50")
