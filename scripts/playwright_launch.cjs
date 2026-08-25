const fs = require("node:fs");

const WINDOWS_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const chromiumLaunchOptions = () => {
  const configured = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  const executablePath = configured
    || (process.platform === "win32" && fs.existsSync(WINDOWS_CHROME) ? WINDOWS_CHROME : undefined);
  return executablePath
    ? { headless: true, executablePath }
    : { headless: true };
};

module.exports = { chromiumLaunchOptions };
