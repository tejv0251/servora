// Node 24 can throw ENOMEM for os.userInfo() in this Windows sandbox.
const os = require('node:os');

try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    username: process.env.USERNAME || 'codex',
    uid: -1,
    gid: -1,
    shell: null,
    homedir: process.env.USERPROFILE || process.cwd(),
  });
}
