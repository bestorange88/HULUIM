const { app, BrowserWindow, shell, dialog, session } = require('electron');
const path = require('path');
const crypto = require('crypto');

let mainWindow;

// Generate a unique session ID for this instance
// This ensures each app instance has its own isolated session/storage
const instanceId = crypto.randomBytes(8).toString('hex');

function createWindow() {
  // Create a unique partition for this instance
  // This isolates localStorage, cookies, etc. between instances
  const partition = `persist:xunda-${instanceId}`;
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: partition, // Use unique partition for session isolation
    },
    icon: path.join(__dirname, '../dist/logo.png'),
    title: '讯达',
    autoHideMenuBar: true,
  });

  // Load the app - always load from dist folder
  // Each instance gets a fresh session due to unique partition, requiring login
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Add close confirmation dialog
  mainWindow.on('close', (e) => {
    e.preventDefault();
    
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['取消', '确认退出'],
      defaultId: 1,
      cancelId: 0,
      title: '确认退出',
      message: '确定要退出讯达吗？',
      detail: '关闭后将无法接收新消息通知。'
    }).then(({ response }) => {
      if (response === 1) {
        // User clicked "确认退出"
        mainWindow.destroy();
      }
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Allow multiple instances - each instance will require separate login
// Do NOT use app.requestSingleInstanceLock() to allow multiple windows

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
