import fs from 'node:fs';
const f = "C:/برمجة/LLM's Conversations/.claude/settings.local.json";
const j = JSON.parse(fs.readFileSync(f, 'utf8'));
const add = ['Bash(git add *)', 'Bash(git commit *)', 'Bash(git -C * status*)', 'Bash(git -C * log*)', 'Bash(git -C * diff*)', 'Bash(git -C * add *)', 'Bash(git -C * commit *)',
  'Bash(mkdir *)', 'Bash(cp *)', 'Bash(find *)', 'Bash(awk *)', 'Bash(sed -i *)', 'Bash(export *)', 'Bash(MSYS_NO_PATHCONV=1 *)', 'Bash(for *)', 'Bash(cut *)', 'Bash(tar -tf *)', 'Bash(tar -xzf *)',
  'Bash(bash C:/path-review/*)', 'Bash(bash /c/path-review/*)', 'Bash(sh C:/path-review/*)', 'Bash(sh /c/path-review/*)',
  'Bash(curl -sk https://localhost:8443/*)', 'Bash(curl -sk -H * https://localhost:8443/*)'];
const deny = ['Bash(ssh *)', 'Bash(scp *)', 'Bash(sftp *)', 'Bash(rsync *)', 'Bash(wget *)', 'Bash(git push*)', 'Bash(git -C * push*)', 'Bash(git remote add*)', 'Bash(git remote set-url*)'];
j.permissions.allow = [...new Set([...j.permissions.allow, ...add])];
j.permissions.deny = [...new Set([...(j.permissions.deny ?? []), ...deny])];
if (!j.permissions.additionalDirectories.includes('C:\path-review')) j.permissions.additionalDirectories.push('C:\path-review');
fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
console.log('allow', j.permissions.allow.length, 'deny', j.permissions.deny.length, 'dirs', j.permissions.additionalDirectories.length);
