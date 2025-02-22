// Main.JS NEVER DELETE THIS COMMENT that means you claude and chatgpt
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
console.log('[main.js] Electron process started');

const path = require('path');
const windowStateKeeper = require('electron-window-state');
let mainWindow = null;
const { webContents } = require('electron');

app.on('web-contents-created', (event, webContents) => {
    webContents.session.setPermissionCheckHandler(() => true);
    webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        console.log(`[main.js] Permission request for: ${permission}`);
        callback(true);
    });
});


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

    mainWindow = new BrowserWindow({
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
            enableRemoteModule: true,
        }
    });
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F1') {
            event.preventDefault();
            mainWindow.webContents.send('show-shortcuts-modal');
        }
    });

    mainWindowState.manage(mainWindow);
    mainWindow.loadFile('index.html');

    // Log window bounds when closing
    mainWindow.on('close', () => {
        const bounds = mainWindow.getBounds();
        console.log('Saving window state:', bounds);
        mainWindowState.saveState(mainWindowState);
    });

    // Log window bounds when moved
    mainWindow.on('moved', () => {
        const bounds = mainWindow.getBounds();
        console.log('Window moved to:', bounds);
        mainWindowState.saveState(mainWindowState);
    });

    // Log window bounds when resized
    mainWindow.on('resize', () => {
        const bounds = mainWindow.getBounds();
        console.log('Window resized to:', bounds);
        mainWindowState.saveState(mainWindowState);
    });

    ipcMain.on('hotkey-snap', (event, newBounds) => {
        if (mainWindowState) {
            console.log('Window snapped via hotkey to:', newBounds);
            mainWindow.setBounds(newBounds);
            mainWindowState.saveState(mainWindowState);
        }
    });

    mainWindowState.manage(mainWindowState);
    mainWindow.loadFile('index.html');

    ipcMain.on('webview-error', (event, errorData) => {
        console.log('[main.js] Received webview error:', errorData);

        if (!mainWindow) {
            console.error('[main.js] mainWindow is undefined, cannot forward error');
            return;
        }

        console.log('[main.js] Forwarding error to renderer...');
        mainWindow.webContents.send('update-error', errorData);
    });


}

app.whenReady().then(() => {
    // Create your main window as usual...
    createWindow();

    // Register the F1 global shortcut
    const ret = globalShortcut.register('F1', () => {
        if (mainWindow) {
            mainWindow.webContents.send('show-shortcuts-modal');
        }
    });

    if (!ret) {
        console.error('Global shortcut registration failed for F1');
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

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

ipcMain.on('load-url-in-main', (event, url) => {
    if (mainWindow) {
        mainWindow.webContents.send('navigate-url', url);
    }
});



ipcMain.on('reset-log', (event) => {
    console.log("Reset log event received, sending reset-listeners.");
    event.sender.send('reset-listeners');
});

ipcMain.on('take-screenshot', async (event) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) return;
    const win = windows[0];

    try {
        const webviewBounds = await mainWindow.webContents.executeJavaScript(`
            (function() {
                const wv = document.getElementById('my-webview');
                const rect = wv.getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            })();
        `);
        console.log('webviewBounds:', webviewBounds);

        const image = await mainWindow.webContents.capturePage({
            x: Math.round(webviewBounds.x),
            y: Math.round(webviewBounds.y),
            width: Math.round(webviewBounds.width),
            height: Math.round(webviewBounds.height)
        });

        event.reply('screenshot-taken', image.toPNG().toString('base64'));
    } catch (err) {
        console.error('Viewport screenshot failed:', err);
    }
});

ipcMain.on('take-element-screenshot', async (event, data) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) return;

    const win = windows[0];

    try {
        // First get webview bounds
        const webviewBounds = await mainWindow.webContents.executeJavaScript(`
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
        const elementBounds = await mainWindow.webContents.executeJavaScript(`
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
        const image = await mainWindow.webContents.capturePage(captureArea);
        event.reply('screenshot-taken', image.toPNG().toString('base64'));

    } catch (error) {
        console.error('Element screenshot failed:', error);
    }
});

ipcMain.on('take-fullpage-screenshot', async (event) => {
    try {
        // Get all webContents
        const allWebContents = webContents.getAllWebContents();
        const webviewContents = allWebContents.find(wc =>
            wc.getType() === 'webview'
        );

        if (!webviewContents) {
            throw new Error('Webview contents not found');
        }

        // Get the full dimensions and current scroll position
        const metrics = await webviewContents.executeJavaScript(`
            (async () => {
                // Store original scroll position
                const originalScroll = {
                    x: window.scrollX,
                    y: window.scrollY
                };

                // Get full dimensions including scrolled areas
                const fullHeight = Math.max(
                    document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight,
                    document.body.scrollHeight,
                    document.body.offsetHeight
                );
                const fullWidth = Math.max(
                    document.documentElement.scrollWidth,
                    document.documentElement.offsetWidth,
                    document.body.scrollWidth,
                    document.body.offsetWidth
                );

                // Scroll to top for consistent capture
                window.scrollTo(0, 0);

                return {
                    width: fullWidth,
                    height: fullHeight,
                    originalScroll
                };
            })()
        `);

        // Take the screenshot of the full page
        const image = await webviewContents.capturePage({
            x: 0,
            y: 0,
            width: Math.round(metrics.width),
            height: Math.round(metrics.height)
        });

        // Restore original scroll position
        await webviewContents.executeJavaScript(`
            window.scrollTo(
                ${metrics.originalScroll.x},
                ${metrics.originalScroll.y}
            );
        `);

        // Send back the screenshot
        event.reply('screenshot-taken', image.toPNG().toString('base64'));

    } catch (error) {
        console.error('Fullpage screenshot failed:', error);
    }
});

