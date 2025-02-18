// Main.JS NEVER DELETE THIS COMMENT that means you claude and chatgpt
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const windowStateKeeper = require('electron-window-state');

function createWindow() {
    // Load the previous state with fallback to defaults
    let mainWindowState = windowStateKeeper({
        defaultWidth: 1200,
        defaultHeight: 800,
        file: 'window-state.json'
    });

    // Log the state when loading
    console.log('Loading window state:', {
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height
    });

    const win = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        icon: path.join(__dirname, 'assets', 'icons', 'eye.ico'),
        webPreferences: {
            nodeIntegration: false,
            nodeIntegrationInSubFrames: true,
            contextIsolation: true,
            webviewTag: true,
            sandbox: false,
            devTools: true,
            preload: path.join(__dirname, 'webviewPreload.js'),
        }
    });

    // Log window bounds when closing
    win.on('close', () => {
        const bounds = win.getBounds();
        console.log('Saving window state:', bounds);
        mainWindowState.saveState(win);
    });

    // Log window bounds when moved
    win.on('moved', () => {
        const bounds = win.getBounds();
        console.log('Window moved to:', bounds);
        mainWindowState.saveState(win);
    });

    // Log window bounds when resized
    win.on('resize', () => {
        const bounds = win.getBounds();
        console.log('Window resized to:', bounds);
        mainWindowState.saveState(win);
    });

    ipcMain.on('hotkey-snap', (event, newBounds) => {
        if (win) {
            console.log('Window snapped via hotkey to:', newBounds);
            win.setBounds(newBounds);
            mainWindowState.saveState(win);
        }
    });

    mainWindowState.manage(win);
    win.loadFile('index.html');

    ipcMain.on('webview-error', (event, errorData) => {
        console.log('Error logged in main process:', errorData);
        win.webContents.send('update-error', errorData);
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) { }
});



ipcMain.on("shortcut-triggered", (event, shortcut) => {
    let focusedWindow = BrowserWindow.getFocusedWindow();  // Use existing import
    if (!focusedWindow) return;  // Prevent sending to a non-existent window

    if (shortcut === "toggle-sidebar") {
        focusedWindow.webContents.send("toggle-sidebar");
    }
});


ipcMain.on('reset-log', (event) => {
    console.log("Reset log event received, sending reset-listeners.");
    event.sender.send('reset-listeners');
});

// In main.js, add this new IPC handler:

// In main.js, replace both screenshot handlers with these fixed versions:

// Remove the first duplicate 'take-screenshot' handler
// and just keep these two handlers at the bottom:

ipcMain.on('take-screenshot', async (event) => {
    // Get all windows
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) return;

    const win = windows[0];

    try {
        // Send message to renderer to get webview bounds
        const webviewBounds = await win.webContents.executeJavaScript(`
            (function() {
                const myWebview = document.getElementById('my-webview');
                const bounds = myWebview.getBoundingClientRect();
                return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
            })();
        `);

        // Capture just the webview area
        const image = await win.webContents.capturePage({
            x: Math.round(webviewBounds.x),
            y: Math.round(webviewBounds.y),
            width: Math.round(webviewBounds.width),
            height: Math.round(webviewBounds.height)
        });

        event.reply('screenshot-taken', image.toPNG().toString('base64'));
    } catch (error) {
        console.error('Screenshot failed:', error);
    }
});

ipcMain.on('take-element-screenshot', async (event, data) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) return;

    const win = windows[0];

    try {
        // First get webview bounds
        const webviewBounds = await win.webContents.executeJavaScript(`
            (function() {
                const webview = document.getElementById('my-webview');
                const bounds = webview.getBoundingClientRect();
                return { 
                    x: bounds.x, 
                    y: bounds.y 
                };
            })();
        `);

        // Modified to avoid redeclaring webviewEl
        const elementBounds = await win.webContents.executeJavaScript(`
            (function() {
                const wv = document.getElementById('my-webview');
                return wv.executeJavaScript(\`
                    (function() {
                        const element = document.evaluate('${data.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        if (!element) return null;
                        const rect = element.getBoundingClientRect();
                        return {
                            x: rect.x,
                            y: rect.y,
                            width: rect.width,
                            height: rect.height
                        };
                    })()
                \`);
            })();
        `);

        if (!elementBounds) {
            console.error('Element not found');
            return;
        }

        // Combine webview and element positions
        const captureArea = {
            x: Math.round(webviewBounds.x + elementBounds.x),
            y: Math.round(webviewBounds.y + elementBounds.y),
            width: Math.round(elementBounds.width),
            height: Math.round(elementBounds.height)
        };

        // Capture just the element area
        const image = await win.webContents.capturePage(captureArea);
        event.reply('screenshot-taken', image.toPNG().toString('base64'));

    } catch (error) {
        console.error('Element screenshot failed:', error);
    }
});