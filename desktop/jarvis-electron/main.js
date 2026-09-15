const { app, BrowserWindow } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "JARVIS",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  const port = process.env.JARVIS_PORT || "8787";
  win.loadURL("http://127.0.0.1:" + port);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
