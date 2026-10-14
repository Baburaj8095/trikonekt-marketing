import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_script = """
file_path = '/srv/trikonekt/tri-academy/frontend/src/components/PartnerBrandsHub.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                          <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center text-center p-1">
                            {ssoLoading ? (
                              <span className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                            ) : (
                              <>
                                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                                <span className="text-[7px] sm:text-[8px] font-black text-amber-300 uppercase tracking-tight">
                                  ASIYA
                                </span>
                              </>
                            )}
                          </div>'''

replacement = '''                          <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-center p-0 overflow-hidden shadow-inner">
                            {ssoLoading ? (
                              <span className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                            ) : (
                              <img
                                src="/asiyapp-logo.png"
                                alt="Asiya App"
                                className="w-full h-full object-contain rounded-full transform group-hover:scale-105 transition-transform duration-300"
                              />
                            )}
                          </div>'''

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("PartnerBrandsHub.jsx updated successfully!")
else:
    print("Warning: Target block not found in PartnerBrandsHub.jsx, checking if already replaced...")
"""

proc = subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "python3"
], input=remote_script, capture_output=True, text=True)

print("STDOUT:", proc.stdout)
if proc.stderr:
    print("STDERR:", proc.stderr)
