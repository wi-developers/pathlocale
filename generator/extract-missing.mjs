// Extract the Arabic strings still missing for the ENABLED apps (+core) into one batch file per app.
// usage: node extract-missing.mjs <outDir> <rootDir>...      Assurance: best-effort; en_GB.json is the reference list.
// batch format: { "<english key>": "" }  or for plural keys ("a_::_b"): { "<key>": ["","","","","",""] }  (Arabic has 6 forms)
import fs from 'node:fs';
import path from 'node:path';
const ENABLED = 'lib core activity appstore bruteforcesettings calendar circles cloud_federation_api comments contacts contactsinteraction dashboard dav drawio federatedfilesharing federation files files_automatedtagging files_downloadlimit files_lock files_pdfviewer files_reminders files_sharing files_trashbin files_versions logreader lookup_server_connector mail notifications notify_push oauth2 office password_policy photos previewgenerator privacy profile provisioning_api recommendations registration related_resources richdocuments serverinfo settings sharebymail sociallogin spreed systemtags tasks text theming twofactor_backupcodes twofactor_totp twofactor_webauthn user_migration user_status viewer weather_status webhook_listeners wisso workflow_pdf_converter workflowengine'.split(' ');
const [outDir, ...roots] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')).translations ?? {}; } catch { return null; } };
const txt = (v) => Array.isArray(v) ? v.join(' | ') : String(v ?? '');
let total = 0, plural = 0; const lines = [];
for (const root of roots) for (const sub of ['core', 'lib', 'apps', 'extra-apps']) {
  const base = path.join(root, sub); if (!fs.existsSync(base)) continue;
  const dirs = (sub === 'core' || sub === 'lib') ? [[sub, base]] : fs.readdirSync(base).map((a) => [a, path.join(base, a)]);
  for (const [app, dir] of dirs) {
    if (!ENABLED.includes(app)) continue;
    const l = path.join(dir, 'l10n'); if (!fs.existsSync(path.join(l, 'en_GB.json'))) continue;
    const ref = rd(path.join(l, 'en_GB.json')) ?? {}; const ar = rd(path.join(l, 'ar.json')) ?? {};
    const out = {}; let n = 0;
    for (const k of Object.keys(ref)) {
      if (k in ar && txt(ar[k]).trim() !== '') continue;
      const isPl = k.includes('_::_'); out[k] = isPl ? ['', '', '', '', '', ''] : ''; n++; if (isPl) plural++;
    }
    if (n) { fs.writeFileSync(path.join(outDir, `${app}.json`), JSON.stringify(out, null, 1)); lines.push(`${app}\t${n}`); total += n; }
  }
}
console.log(lines.join('\n')); console.log(`TOTAL\t${total}\t(plural keys: ${plural})`);
