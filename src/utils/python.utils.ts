import { spawn } from "child_process";
export function runPythonScript(script: string, args: string[]) {
  return new Promise((resolve, reject) => {
    const pyspawn = spawn("python", [script, ...args]);
    let scriptData = "";
    let scriptError = "";
    pyspawn.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
      scriptData += data;
    });

    pyspawn.stderr.on("data", (data) => {
      console.log(`stderr: ${data}`);
      scriptError += data;
    });

    pyspawn.on("close", (code) => {
      console.log(`child process exited with code ${code}`);
      if (code === 0) {
        resolve(scriptData);
      } else {
        reject(scriptError);
      }
    });
  });
}
