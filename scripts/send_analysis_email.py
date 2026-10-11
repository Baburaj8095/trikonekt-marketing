import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_email_script = r'''
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Load env variables from /etc/trikonekt/backend.env
env_path = "/etc/trikonekt/backend.env"
env_vars = {}
with open(env_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env_vars[k.strip()] = v.strip().strip("'").strip('"')

host = env_vars.get("EMAIL_HOST", "smtp.zoho.in")
port = int(env_vars.get("EMAIL_PORT", 587))
user = env_vars.get("EMAIL_HOST_USER", "contact@trikonekt.com")
pwd = env_vars.get("EMAIL_HOST_PASSWORD")
from_email = env_vars.get("DEFAULT_FROM_EMAIL", "contact@trikonekt.com")
to_email = "baburajnk19@gmail.com"

subject = "[Trikonekt Diagnostic Report] 3-Matrix Sponsor Anchoring Root Cause Analysis & Test Users Reset Completed"

html_body = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { color: #1e1b4b; font-size: 22px; margin: 0 0 8px 0; }
    .badge { display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 700; border-radius: 6px; }
    .badge-success { background: #dcfce7; color: #15803d; }
    .badge-info { background: #e0e7ff; color: #4338ca; }
    h2 { color: #334155; font-size: 16px; margin: 24px 0 10px 0; border-left: 4px solid #4f46e5; padding-left: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 20px 0; font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #475569; }
    td { padding: 10px; border: 1px solid #e2e8f0; color: #334155; }
    .code-box { background: #0f172a; color: #f8fafc; padding: 14px; border-radius: 8px; font-family: 'Courier New', Courier, monospace; font-size: 12px; overflow-x: auto; margin: 12px 0; }
    .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 4px; font-weight: 600; color: #92400e; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Trikonekt Growth Architecture — Technical Diagnostic Report</h1>
      <span class="badge badge-success">STAGING STATUS: OPERATIONAL</span>
      <span class="badge badge-info">RESET STATUS: COMPLETED</span>
    </div>

    <p>Dear Babu Raj,</p>
    <p>Following your investigation request regarding the 3-Matrix tree display and user reset requirements, here is the comprehensive root cause analysis, code fixes implemented, and current reset telemetry for <strong>asiyapp.com</strong>.</p>

    <h2>1. Root Cause Analysis: Why 750 Prime Entry was Missing in 3-Matrix</h2>
    <p>When user <strong>8095918105</strong> (sponsored by <strong>9999999999</strong>) purchased the ₹2,000 Starter Track, it triggered both <strong>PRIME750</strong> and <strong>MONTHLY759 (SPP)</strong>.</p>
    <ul>
      <li>In <strong>5-Matrix (FIVE_150)</strong>: Placement logic verified the direct sponsor (9999999999) and anchored entry #1 directly beneath 9999999999's primary account, while entry #2 clustered under 8095918105.</li>
      <li>In <strong>3-Matrix (THREE_150)</strong>: Inspection of <code>business/models.py</code> revealed that <code>create_three_150_for_user()</code> and <code>place_in_three_pool()</code> had a hardcoded override:
        <div class="code-box">
# Previous Code in business/models.py:
start_id = None if str(pool_type) == "THREE_150" else cls._sponsor_start_entry_id_for(...)
GenericPlacement.place_account(..., start_entry_id=None)
        </div>
      </li>
    </ul>
    <p>Because <code>start_entry_id=None</code> was passed, GenericPlacement fell back to the <strong>Global Company Sentinel Root (#246)</strong> instead of searching beneath sponsor 9999999999's account (#689).</p>
    <p>Since Sentinel #246 had Slot 3 open (Slot 1 and Slot 2 were occupied by 9999999999's initial seats), 8095918105's <strong>PRIME_750 entry (#693) was placed into Sentinel #246 as a sibling of 9999999999</strong>, rather than underneath 9999999999!</p>
    <p>When the subsequent SPP box was processed, Sentinel #246 was full, so the breadth-first search finally cascaded down into Slot 1 of #689 (9999999999). This caused <strong>only the SPP entry (#695)</strong> to appear under 9999999999, while the Prime 750 entry was sitting orphaned under the Company Sentinel Root.</p>

    <h2>2. Architectural Fix Implemented</h2>
    <p>In <code>business/models.py</code> on EC2 staging (and local workspace):</p>
    <ul>
      <li>Updated <code>create_three_150_for_user()</code> to resolve <code>own_base</code> first. For 1st entry, it anchors to <code>_sponsor_start_entry_id_for(user, "THREE_150")</code>. For subsequent entries (SPP, Rebirth), it clusters under <code>own_base.id</code>.</li>
      <li>Updated <code>place_in_three_pool()</code> to remove the <code>start_id = None if pool_type == "THREE_150"</code> bypass, unifying 3-Matrix and 5-Matrix placement contracts.</li>
      <li>Enabled <code>reanchor_sponsored_downlines(user, "THREE_150")</code> so any early downlines automatically seat under the primary sponsor upon registration.</li>
      <li>Compiled bytecode and restarted <code>trikonekt-staging-web.service</code> (Status: Active & verified).</li>
    </ul>

    <h2>3. Test Candidates Reset Status (STAGING RDS)</h2>
    <p>Both test candidates <strong>9999999999</strong> and <strong>8095918105</strong> (along with dummy test IDs 1000000101, 1000000102) were completely purged across all 11 growth and ledger tables using <code>reset_user.py</code>:</p>
    <table>
      <thead>
        <tr>
          <th>Candidate</th>
          <th>Sponsor</th>
          <th>Wallets / Pockets</th>
          <th>Matrix Nodes</th>
          <th>Active State</th>
          <th>Default Password</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>9999999999</strong></td>
          <td>None (Root)</td>
          <td>₹0.00</td>
          <td>0 (Cleaned)</td>
          <td>False (Unpurchased)</td>
          <td><code>123456</code></td>
        </tr>
        <tr>
          <td><strong>8095918105</strong></td>
          <td><strong>9999999999</strong></td>
          <td>₹0.00</td>
          <td>0 (Cleaned)</td>
          <td>False (Unpurchased)</td>
          <td><code>123456</code></td>
        </tr>
      </tbody>
    </table>

    <p><strong>Remaining AutoPool Nodes in Database:</strong></p>
    <ul>
      <li><code>#244</code> — Pool: <code>FIVE_150</code> | Sentinel Root (0000000000)</li>
      <li><code>#246</code> — Pool: <code>THREE_150</code> | Sentinel Root (0000000000)</li>
    </ul>
    <p>All other matrix entries have been cleanly wiped. The trees are now in a 100% pristine state for your fresh test cycle.</p>

    <h2>4. Testing Flow Next Steps</h2>
    <ol>
      <li>Log in as <strong>9999999999</strong> (password: <code>123456</code>) on <a href="https://asiyapp.com">asiyapp.com</a> / <a href="https://trieducation.in">trieducation.in</a>.</li>
      <li>Activate the ₹2,000 Starter Track → Creates Entry #1 in 5-Matrix and 3-Matrix, and Entry #2 (SPP) clustered under Entry #1.</li>
      <li>Log in as <strong>8095918105</strong> (password: <code>123456</code>).</li>
      <li>Activate the ₹2,000 Starter Track → Anchors Entry #1 (750 Prime) directly beneath sponsor 9999999999 in both 5-Matrix and 3-Matrix, with Entry #2 (SPP) clustered beneath 8095918105.</li>
      <li>Open <strong>asiyapp.com/user/genealogy-5</strong> to verify both 5 Blocks and 3 Blocks displays.</li>
    </ol>

    <div class="footer">
      Generated automatically by Antigravity AI Engineering Assistant &bull; Trikonekt Growth Services
    </div>
  </div>
</body>
</html>
"""

text_body = """Trikonekt Growth Architecture — Technical Diagnostic Report
Staging: asiyapp.com
Recipient: baburajnk19@gmail.com

1. ROOT CAUSE ANALYSIS (3-MATRIX MISSING 750 ENTRY):
- create_three_150_for_user() and place_in_three_pool() hardcoded start_entry_id = None for THREE_150.
- GenericPlacement fell back to Company Sentinel Root #246 instead of sponsor 9999999999 (#689).
- Sentinel #246 had Slot 3 open, so 8095918105's Prime 750 entry (#693) was placed into Sentinel #246 as a sibling of 9999999999 instead of under 9999999999.
- Subsequent SPP entry (#695) cascaded into #689 because Sentinel was full, causing only SPP to show under 9999999999.

2. FIX IMPLEMENTED:
- Updated create_three_150_for_user() and place_in_three_pool() in business/models.py to resolve sponsor entry for 1st entry, and self-cluster subsequent entries.
- Enabled reanchor_sponsored_downlines for THREE_150.
- Recompiled and restarted trikonekt-staging-web.service.

3. RESET STATUS:
- Users 9999999999, 8095918105, 1000000101, 1000000102 have been completely reset across all 11 tables.
- All wallets and self pockets reset to 0.00.
- All matrix entries removed (only Sentinel #244 and #246 remain).
- Password set to 123456 for both users.
- Ready for end-to-end testing.
"""

msg = MIMEMultipart("alternative")
msg["Subject"] = subject
msg["From"] = f"Trikonekt Engineering <{from_email}>"
msg["To"] = to_email

part1 = MIMEText(text_body, "plain", "utf-8")
part2 = MIMEText(html_body, "html", "utf-8")
msg.attach(part1)
msg.attach(part2)

print(f"Connecting to {host}:{port} with user {user}...")
server = smtplib.SMTP(host, port, timeout=20)
server.ehlo()
server.starttls()
server.ehlo()
server.login(user, pwd)
server.sendmail(from_email, [to_email], msg.as_string())
server.quit()
print("[SUCCESS] Email sent successfully to " + to_email)
'''

local_tmp = r"C:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\scripts\_tmp_inspect.py"
with open(local_tmp, "w", encoding="utf-8") as f:
    f.write(remote_email_script)

scp_cmd = [
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    local_tmp, f"ubuntu@{ec2_ip}:/tmp/send_report_email.py"
]
subprocess.run(scp_cmd, check=True)

ssh_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    "sudo python3 /tmp/send_report_email.py"
]
res = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=30)
print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)
