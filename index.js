const child_process = require("child_process");
const path = require("path");
const core = require("@actions/core");
const semver = require("semver");
const nv = require("@pkgjs/nv");

// Utilize @pkgjs/nv to resolve aliases before forwarding to nvm / nvm-windows
async function resolveVersion(version, mirror) {
  let query = version;
  if (query) {
    const versions = await nv(version, { mirror });
    if (versions.length) {
      versions.sort((a, b) => semver.rcompare(a.version, b.version));
      return versions[0].version;
    }
  }
  return version;
}

(async () => {
  let mirror = core.getInput("node-mirror") || "https://nodejs.org/dist/";
  let version = await resolveVersion(core.getInput("node-version"), mirror);
  if (process.platform == "win32") {
    if (/^\d/.test(version)) version = "v" + version;
    runScript("powershell", ".\\install.ps1", version, mirror);
  } else {
    runScript("bash", "install.sh", version, mirror);
  }
})();

function runScript(shell, script, version, mirror) {
  const child = child_process.spawn(shell, [ script, version, mirror ], { cwd: __dirname });
  const stdout = [];
  child.stdout.on("data", out => {
    stdout.push(out);
    process.stdout.write(out);
  });
  child.stderr.on("data", out => {
    process.stderr.write(out);
  });
  child.on("close", code => {
    if (code !== 0) throw Error("installation failed with " + code);
    const out = Buffer.concat(stdout).toString("utf8");
    var nvmPath;
    var nodePath;
    var npmPath;
    try {
      nvmPath = /SETUP_NODE_NVM_NVM: ([^\n]+)/.exec(out)[1];
      nodePath = /SETUP_NODE_NVM_NODE: ([^\n]+)/.exec(out)[1];
      npmPath = /SETUP_NODE_NVM_NPM: ([^\n]+)/.exec(out)[1];
    } catch (e) {
      throw Error("missing nvm/node/npm path in output");
    }
    console.log("Using nvm: " + nvmPath);
    core.addPath(path.dirname(nvmPath));
    console.log("Using node: " + nodePath);
    core.addPath(path.dirname(nodePath));
    console.log("Using npm: " + npmPath);
    core.addPath(path.dirname(npmPath));
  });
}
