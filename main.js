// Main.JS NEVER DELETE THIS COMMENT that means you claude and chatgpt
console.log("✅ Main process is running!");
const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const windowStateKeeper = require('electron-window-state');
const sharp = require('sharp');

let mainWindow = null;
const { webContents } = require('electron');

// Permission handling
app.on('web-contents-created', (event, wc) => {
    wc.session.setPermissionCheckHandler(() => true);
    wc.session.setPermissionRequestHandler((_wc, permission, callback) => {
        console.log(`[main.js] Permission request: ${permission}`);
        callback(true);
    });
});

function createWindow() {
    const mainWindowState = windowStateKeeper({
        defaultWidth: 1200,
        defaultHeight: 1000,
        file: 'window-state.json'
    });

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
            contextIsolation: true,
            webviewTag: true,
            sandbox: false,
            devTools: true,
            preload: path.join(__dirname, 'webviewPreload.js'),
            enableRemoteModule: true
        }
    });

    // F1 => show shortcuts modal
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F1') {
            event.preventDefault();
            mainWindow.webContents.send('show-shortcuts-modal');
        }
    });

    mainWindowState.manage(mainWindow);
    mainWindow.loadFile('index.html');

    mainWindow.on('close', () => {
        const bounds = mainWindow.getBounds();
        console.log('Saving window state:', bounds);
        mainWindowState.saveState(mainWindowState);
    });

    mainWindow.on('moved', () => {
        const bounds = mainWindow.getBounds();
        console.log('Window moved to:', bounds);
        mainWindowState.saveState(mainWindowState);
    });

    mainWindow.on('resize', () => {
        const bounds = mainWindow.getBounds();
        console.log('Window resized to:', bounds);
        mainWindowState.saveState(mainWindowState);
    });
}

// Create the main window once app is ready
app.whenReady().then(() => {
    createWindow();
    const ret = globalShortcut.register('F1', () => {
        if (mainWindow) {
            mainWindow.webContents.send('show-shortcuts-modal');
        }
    });
    if (!ret) console.error('Global shortcut registration failed for F1');
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.handle('show-folder-dialog', async (event, options) => {
    return await dialog.showOpenDialog(mainWindow, options);
});

// Snap window bounds
ipcMain.on('hotkey-snap', (event, newBounds) => {
    console.log('Window snapped via hotkey:', newBounds);
    if (mainWindow) mainWindow.setBounds(newBounds);
});

// Test folder dialog
ipcMain.on('test-folder-dialog', (event) => {
    console.log('Test folder dialog triggered');
    dialog.showOpenDialog(mainWindow, {
        title: 'TEST - Choose folder',
        properties: ['openDirectory']
    }).then(result => {
        if (!result.canceled) {
            mainWindow.webContents.send('test-folder-selected', result.filePaths[0]);
        }
    }).catch(err => console.error('Dialog error:', err));
});

// The real folder dialog for JIRA screenshots
ipcMain.on('open-folder-dialog', async (event, data) => {
    console.log('open-folder-dialog event:', data);
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Choose folder for JIRA screenshots',
            properties: ['openDirectory']
        });
        if (!result.canceled && result.filePaths.length > 0) {
            mainWindow.webContents.send('folder-selected', {
                folderPath: result.filePaths[0]
            });
        } else {
            mainWindow.webContents.send('folder-selection-canceled');
        }
    } catch (err) {
        console.error('Error showing folder dialog:', err);
        mainWindow.webContents.send('folder-selection-error');
    }
});

// Saves raw screenshot bytes to the folder, no second prompt
ipcMain.on('save-screenshot-file', (event, payload) => {
    const { folderPath, filename, bytes } = payload;
    try {
        console.log(`Main process received save request for: ${filename}`);
        console.log(`Bytes array length: ${bytes?.length || 'undefined'}`);

        const fullPath = path.join(folderPath, filename);
        console.log(`Full save path: ${fullPath}`);

        // Check folder exists and is writable
        try {
            fs.accessSync(path.dirname(fullPath), fs.constants.W_OK);
            console.log('Folder is writable');
        } catch (accessErr) {
            console.error('Folder access error:', accessErr);
            // Try to create the folder
            try {
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                console.log('Created folder structure');
            } catch (mkdirErr) {
                console.error('Failed to create folder:', mkdirErr);
            }
        }

        // Create buffer and check its validity
        const buffer = Buffer.from(bytes);
        console.log(`Created buffer with length: ${buffer.length} bytes`);

        // Check first few bytes to ensure it's a valid PNG
        if (buffer.length > 8) {
            const header = buffer.slice(0, 8).toString('hex');
            console.log(`File header: ${header}`);
            // PNG header should be: 89 50 4E 47 0D 0A 1A 0A
            const isPNG = header.startsWith('89504e47');
            console.log(`Header appears to be valid PNG: ${isPNG}`);
        }

        // Write the file with explicit encoding
        fs.writeFileSync(fullPath, buffer);

        // Verify file was created and has content
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            console.log(`File saved at: ${fullPath} (${stats.size} bytes)`);

            try {
                // Make sure the sender is still valid
                if (event && event.sender && !event.sender.isDestroyed()) {
                    event.sender.send('screenshot-save-result', {
                        success: true,
                        path: fullPath
                    });
                    console.log('Sent screenshot-save-result success response');
                } else {
                    console.error('Cannot send response: event.sender is not available');
                }
            } catch (replyErr) {
                console.error('Error sending reply:', replyErr);
            }
        } else {
            console.error('File was not created after write');
            try {
                event.reply('screenshot-save-result', {
                    success: false,
                    error: 'File was not created after writeFileSync'
                });
                console.log('Sent screenshot-save-result failure response');
            } catch (replyErr) {
                console.error('Error sending reply:', replyErr);
            }
        }
    } catch (err) {
        console.error('Error saving screenshot file:', err);
        event.sender.send('screenshot-save-result', { success: false, error: err.message });
    }
});

ipcMain.on('save-screenshot-base64', (event, payload) => {
    const { folderPath, filename, base64Data } = payload;

    try {
        console.log(`Main process received base64 save request for ${filename}`);
        console.log(`Base64 data length: ${base64Data.length}`);

        // Check if the folderPath exists, if not create it
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            console.log(`Created folder path: ${folderPath}`);
        }

        const fullPath = path.join(folderPath, filename);

        // Remove data URL prefix if present
        let imageData = base64Data;
        if (base64Data.includes('base64,')) {
            imageData = base64Data.split('base64,')[1];
        }

        // Create buffer and save
        const buffer = Buffer.from(imageData, 'base64');
        fs.writeFileSync(fullPath, buffer);

        console.log(`Screenshot saved at: ${fullPath}`);
        console.log(`File exists check: ${fs.existsSync(fullPath)}`);

        // Send back the reply to the renderer
        event.reply('screenshot-save-result', {
            success: true,
            path: fullPath
        });
    } catch (err) {
        console.error('Error saving screenshot:', err);

        // Send error back to renderer
        event.reply('screenshot-save-result', {
            success: false,
            error: err.message
        });
    }
});


// Forward any webview error info to renderer
ipcMain.on('webview-error', (event, errorData) => {
    if (!mainWindow) return;
    mainWindow.webContents.send('update-error', errorData);
});

//
// RENAMED LEGACY FULL-PAGE SCREENSHOT HANDLER
//
ipcMain.on('take-fullpage-screenshot-legacy', async (event, { totalHeight }) => {
    console.log('LEGACY Full-page screenshot requested, totalHeight =', totalHeight);

    try {
        // Get the webContents for the <webview>
        const allWCs = webContents.getAllWebContents();
        const targetWC = allWCs.find(wc => wc.getType() === 'webview');
        if (!targetWC) throw new Error('No webview found for full-page screenshot');

        // This is the old captureStream + <video> approach that often returns empty
        //  ...
        //  (Keeping it intact so nothing is removed)
        const script = `
            (async function() {
                try {
                    // Create a canvas the size of the entire page
                    const canvas = document.createElement('canvas');
                    canvas.width = document.documentElement.scrollWidth;
                    canvas.height = ${totalHeight};   // Insert totalHeight here

                    const ctx = canvas.getContext('2d');
                    
                    // Example: scroll in chunks
                    const viewportHeight = window.innerHeight;
                    const wait = ms => new Promise(r => setTimeout(r, ms));
                    const originalScrollY = window.scrollY;

                    for (let scrollTop = 0; scrollTop < ${totalHeight}; scrollTop += viewportHeight) {
                        window.scrollTo(0, scrollTop);
                        await wait(150);

                        const blob = await new Promise(async (resolve) => {
                            const video = document.createElement('video');
                            video.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;opacity:0;';
                            video.autoplay = true;

                            const stream = document.documentElement.captureStream();
                            video.srcObject = stream;

                            video.muted = true;
                            video.setAttribute('playsinline', '');
                            try { await video.play(); } catch (e) { console.error('video.play() error:', e); }

                            video.onplaying = () => {
                                const offscreen = document.createElement('canvas');
                                offscreen.width = video.videoWidth;
                                offscreen.height = video.videoHeight;
                                offscreen.getContext('2d').drawImage(video, 0, 0);

                                stream.getTracks().forEach(track => track.stop());
                                video.remove();
                                offscreen.toBlob(resolve, 'image/png');
                            };

                            video.onerror = (err) => {
                                console.error('video.onerror:', err);
                                resolve(null);
                            };
                        });

                        if (blob) {
                            const img = await createImageBitmap(blob);
                            ctx.drawImage(img, 0, scrollTop, img.width, img.height);
                        }
                    }

                    window.scrollTo(0, originalScrollY);

                    // Return final PNG as base64
                    return canvas.toDataURL('image/png').split(',')[1];
                } catch (err) {
                    console.error('Screenshot error:', err);
                    return '';
                }
            })();
        `;

        const base64Data = await targetWC.executeJavaScript(script);
        console.log('full-page screenshot base64 length:', base64Data ? base64Data.length : 0);

        if (!base64Data) {
            event.reply('fullpage-screenshot-result', '');
        } else {
            event.reply('fullpage-screenshot-result', base64Data);
        }

    } catch (err) {
        console.error('Full-page screenshot error:', err);
        event.reply('fullpage-screenshot-result', '');
    }
});

//
// BRAND-NEW CDP-BASED FULL-PAGE SCREENSHOT HANDLER
//
ipcMain.on('take-fullpage-screenshot-cdp', async (event, { totalWidth, totalHeight }) => {
    console.log('[CDP] Full-page screenshot requested:', { totalWidth, totalHeight });
    try {
        // 1) Get the webContents for the <webview>
        const allWCs = webContents.getAllWebContents();
        const targetWC = allWCs.find(wc => wc.getType() === 'webview');
        if (!targetWC) throw new Error('No webview found for full-page screenshot');

        // 2) Attach the debugger
        await targetWC.debugger.attach('1.3');

        // 3) Override device metrics so capture can see the entire height
        await targetWC.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
            width: totalWidth || 1200,  // default if not provided
            height: totalHeight || 2000,
            deviceScaleFactor: 1,
            mobile: false
        });

        // 4) Use the CDP command to capture a PNG
        const { data } = await targetWC.debugger.sendCommand('Page.captureScreenshot', {
            format: 'png',
            fromSurface: true
        });

        // 5) Detach
        await targetWC.debugger.detach();

        console.log('[CDP] Full-page screenshot captured. Data length:', data.length);
        event.reply('fullpage-screenshot-result', data);
    } catch (err) {
        console.error('[CDP] Full-page screenshot error:', err);
        event.reply('fullpage-screenshot-result', '');
    }
});

// Normal screenshot of the webview
ipcMain.on('take-screenshot', async (event) => {
    if (!mainWindow) return;
    try {
        const webviewBounds = await mainWindow.webContents.executeJavaScript(`
      (function() {
        const wv = document.getElementById('my-webview');
        const rect = wv.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })();
    `);

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

// Element screenshot
ipcMain.on('take-element-screenshot', async (event, data) => {
    if (!mainWindow) return;
    try {
        const webviewBounds = await mainWindow.webContents.executeJavaScript(`
      (function() {
        const wv = document.getElementById('my-webview');
        const rect = wv.getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      })();
    `);
        const elementBounds = await mainWindow.webContents.executeJavaScript(`
      (function() {
        const wv = document.getElementById('my-webview');
        return wv.executeJavaScript(\`
          (function() {
            const el = document.evaluate('${data.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          })()
        \`);
      })();
    `);
        if (!elementBounds) return;

        const captureArea = {
            x: Math.round(webviewBounds.x + elementBounds.x),
            y: Math.round(webviewBounds.y + elementBounds.y),
            width: Math.round(elementBounds.width),
            height: Math.round(elementBounds.height)
        };
        const image = await mainWindow.webContents.capturePage(captureArea);
        event.reply('screenshot-taken', image.toPNG().toString('base64'));
    } catch (err) {
        console.error('Element screenshot failed:', err);
    }
});

// Reset log
ipcMain.on('reset-log', (event) => {
    console.log("Reset log => sending reset-listeners.");
    event.sender.send('reset-listeners');
});

// Toggle sidebar or other shortcuts
ipcMain.on("shortcut-triggered", (event, shortcut) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    if (shortcut === "toggle-sidebar") {
        win.webContents.send("toggle-sidebar");
    }
});

// Load a URL in the main process => forward to renderer
ipcMain.on('load-url-in-main', (event, url) => {
    if (mainWindow) {
        mainWindow.webContents.send('navigate-url', url);
    }
});

ipcMain.on('test-write-file', (event, data) => {
    try {
        fs.writeFileSync(data.path, data.content);
        console.log('Test file written successfully:', data.path);
        event.reply('test-write-file-result', {
            success: true,
            path: data.path
        });
    } catch (err) {
        console.error('Test file write failed:', err);
        event.reply('test-write-file-result', {
            success: false,
            error: err.message
        });
    }
});

ipcMain.on('trigger-find-in-page', (event, text) => {
    const senderWebContents = event.sender;
    if (senderWebContents) {
        senderWebContents.findInPage(text || '');
    }
});
