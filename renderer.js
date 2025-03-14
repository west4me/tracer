// Renderer.JS NEVER DELETE THIS COMMENT that means you claude and chatgpt
// Global declaration

let webview;
let webviewContainer;
let activeScreenshotEvent = null;
let isResetting = false;
let emptyStateMessage = null;
let isFirstLog = true;
let urlInput;
let finalIssueType = '';
let finalSummary = ''; 
let lastFolderPath = '';
let lastScreenshotBase64 = '';
let isDrawing = false;
let currentTool = null;
let annotationColor = '#FF0000';
let startX, startY;
let annotationCanvas = null;
let annotationCtx = null;
let currentImage = null;
let undoStack = [];
let redoStack = [];
let initialCanvasState = null;
let currentStamp = null;
let jiraFields = [
    { name: '', value: '' }
];
let currentIssueType = 'Defect';
let typedIssueType = '';
let typedSummary = '';
let storedIssueTypes = JSON.parse(localStorage.getItem('issueTypesHistory') || '[]');
let loggingEnabled = false;
const stamps = {
    pass: {
        text: 'PASS',
        color: '#22c55e', // Green
        borderColor: '#16a34a'
    },
    fail: {
        text: 'DEFECT',
        color: '#ef4444', // Red
        borderColor: '#dc2626'
    }
};
const eventLog = [];
const ignoredPatterns = [
    'GUEST_VIEW_MANAGER_CALL',
    'ERR_ABORTED (-3)',
    'console.log',
    'console.warn',
    'console.info'
];
const toggleErrorDrawer = document.getElementById("toggle-error-drawer");
const resetLogModal = document.getElementById("reset-log-modal");
const modalContainer = document.getElementById("modal-container");
const errorDrawer = document.getElementById("error-drawer");
const errorIcon = document.getElementById("error-icon");
const ipcRenderer = window.electron.ipcRenderer;
const linkStyle = document.createElement('style');

// Konami Code sequence
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;

// Extract Konami code checking into a separate function so we can use it in multiple places
function checkKonamiCode(key) {
    // Check if the key matches the expected key in sequence
    if (key === konamiCode[konamiIndex]) {
        konamiIndex++;
        // If we've matched the full sequence
        if (konamiIndex === konamiCode.length) {
            releaseBeetle();
            // Reset the index
            konamiIndex = 0;
        }
    } else {
        // Reset if wrong key
        konamiIndex = 0;
    }
}

// Keep track of keys pressed in the main window
document.addEventListener('keydown', function (e) {
    checkKonamiCode(e.key);
});
function releaseBeetle() {
    // Create the beetle element
    const beetle = document.createElement('div');
    beetle.className = 'konami-beetle';
    beetle.style.position = 'fixed';
    beetle.style.zIndex = '1000';
    beetle.style.width = '40px';
    beetle.style.height = '40px';
    beetle.style.pointerEvents = 'none'; // So it doesn't interfere with user interaction

    // Random starting position on the edge of the screen
    const startPositions = [
        { x: -40, y: Math.random() * window.innerHeight }, // Left edge
        { x: window.innerWidth, y: Math.random() * window.innerHeight }, // Right edge
        { x: Math.random() * window.innerWidth, y: -40 }, // Top edge
        { x: Math.random() * window.innerWidth, y: window.innerHeight } // Bottom edge
    ];

    const startPos = startPositions[Math.floor(Math.random() * startPositions.length)];
    beetle.style.left = startPos.x + 'px';
    beetle.style.top = startPos.y + 'px';

    // Use inline SVG instead of image file
    beetle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%" style="transform: rotate(90deg);">
      <!-- Main body (thorax) -->
      <ellipse cx="200" cy="150" rx="50" ry="70" fill="#543800" stroke="#000000" stroke-width="2"/>
      
      <!-- Head -->
      <circle cx="200" cy="70" r="30" fill="#654200" stroke="#000000" stroke-width="2"/>
      
      <!-- Eyes -->
      <ellipse cx="185" cy="60" rx="8" ry="10" fill="#000000"/>
      <ellipse cx="215" cy="60" rx="8" ry="10" fill="#000000"/>
      
      <!-- Antennae -->
      <path d="M185 45 Q165 20 155 5" fill="none" stroke="#000000" stroke-width="2"/>
      <path d="M215 45 Q235 20 245 5" fill="none" stroke="#000000" stroke-width="2"/>
      <circle cx="155" cy="5" r="3" fill="#000000"/>
      <circle cx="245" cy="5" r="3" fill="#000000"/>
      
      <!-- Wing cases (elytra) -->
      <path d="M160 100 Q150 150 175 220" fill="#76520E" stroke="#000000" stroke-width="2"/>
      <path d="M240 100 Q250 150 225 220" fill="#76520E" stroke="#000000" stroke-width="2"/>
      <!-- Wing dividing line -->
      <path d="M200 100 L200 220" fill="none" stroke="#000000" stroke-width="1.5"/>
      <!-- Wing patterns -->
      <path d="M175 120 L185 140 L175 160" fill="none" stroke="#3A2100" stroke-width="1"/>
      <path d="M225 120 L215 140 L225 160" fill="none" stroke="#3A2100" stroke-width="1"/>
      
      <!-- Legs (left side) -->
      <path class="leg" id="leftFrontLeg" d="M160 110 Q120 100 100 90" fill="none" stroke="#000000" stroke-width="2.5"/>
      <path class="leg" id="leftMiddleLeg" d="M160 150 Q110 150 80 160" fill="none" stroke="#000000" stroke-width="2.5"/>
      <path class="leg" id="leftBackLeg" d="M160 190 Q120 200 100 220" fill="none" stroke="#000000" stroke-width="2.5"/>
      
      <!-- Legs (right side) -->
      <path class="leg" id="rightFrontLeg" d="M240 110 Q280 100 300 90" fill="none" stroke="#000000" stroke-width="2.5"/>
      <path class="leg" id="rightMiddleLeg" d="M240 150 Q290 150 320 160" fill="none" stroke="#000000" stroke-width="2.5"/>
      <path class="leg" id="rightBackLeg" d="M240 190 Q280 200 300 220" fill="none" stroke="#000000" stroke-width="2.5"/>
      
      <!-- Mandibles -->
      <path d="M190 90 Q180 100 185 110" fill="none" stroke="#000000" stroke-width="1.5"/>
      <path d="M210 90 Q220 100 215 110" fill="none" stroke="#000000" stroke-width="1.5"/>
      
      <!-- Highlights for a bit of shine -->
      <ellipse cx="190" cy="140" rx="10" ry="20" fill="#8A6800" opacity="0.6"/>
      <ellipse cx="210" cy="140" rx="10" ry="20" fill="#8A6800" opacity="0.6"/>
    </svg>`;

    document.body.appendChild(beetle);

    // Get references to all legs
    const leftFrontLeg = beetle.querySelector('#leftFrontLeg');
    const leftMiddleLeg = beetle.querySelector('#leftMiddleLeg');
    const leftBackLeg = beetle.querySelector('#leftBackLeg');
    const rightFrontLeg = beetle.querySelector('#rightFrontLeg');
    const rightMiddleLeg = beetle.querySelector('#rightMiddleLeg');
    const rightBackLeg = beetle.querySelector('#rightBackLeg');

    // Keep track of beetle's position and movement
    let pos = { x: startPos.x, y: startPos.y };
    let destination = {
        x: Math.random() * (window.innerWidth - 100) + 50,
        y: Math.random() * (window.innerHeight - 100) + 50
    };
    let velocity = { x: 0, y: 0 };
    let isActive = true;
    let lastTimestamp = 0;
    let legPhase = 0; // For leg animation

    // Animation function with timestamp for smoother animation
    function moveBeetle(timestamp) {
        if (!isActive) return;

        // Calculate delta time for smooth animation regardless of frame rate
        const deltaTime = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0.016; // in seconds
        lastTimestamp = timestamp;

        // Calculate direction and distance to destination
        const dx = destination.x - pos.x;
        const dy = destination.y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If we're close to the destination, pick a new one
        if (distance < 5) {
            destination = {
                x: Math.random() * (window.innerWidth - 100) + 50,
                y: Math.random() * (window.innerHeight - 100) + 50
            };
        }

        // Update velocity with a bit of easing
        velocity.x = velocity.x * 0.95 + dx * 0.006;
        velocity.y = velocity.y * 0.95 + dy * 0.006;

        // Apply some max speed
        const maxSpeed = 2;
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        if (speed > maxSpeed) {
            velocity.x = (velocity.x / speed) * maxSpeed;
            velocity.y = (velocity.y / speed) * maxSpeed;
        }

        // Update position
        pos.x += velocity.x;
        pos.y += velocity.y;

        // Update CSS position
        beetle.style.left = pos.x + 'px';
        beetle.style.top = pos.y + 'px';

        // Calculate angle for rotation based on movement direction
        const angleRadians = Math.atan2(velocity.y, velocity.x);
        const angleDegrees = angleRadians * (180 / Math.PI);

        // Apply rotation to the beetle SVG container
        const beetleSvg = beetle.querySelector('svg');
        if (beetleSvg) {
            beetleSvg.style.transform = `rotate(${angleDegrees + 90}deg)`;
        }

        // Animate legs based on speed
        // Faster movement = faster leg animation
        legPhase += deltaTime * speed * 5;

        // Calculate leg movements with alternating phases 
        // This creates a walking motion where legs move in alternating patterns
        if (leftFrontLeg && leftMiddleLeg && leftBackLeg && rightFrontLeg && rightMiddleLeg && rightBackLeg) {
            // Left side legs animation
            const frontLeftPhase = Math.sin(legPhase);
            const middleLeftPhase = Math.sin(legPhase + Math.PI * 0.66); // 120 degrees out of phase
            const backLeftPhase = Math.sin(legPhase + Math.PI * 1.33);   // 240 degrees out of phase

            // Right side legs animation (opposite to left side)
            const frontRightPhase = Math.sin(legPhase + Math.PI);        // 180 degrees out of phase from left front
            const middleRightPhase = Math.sin(legPhase + Math.PI * 1.66); // 300 degrees out of phase
            const backRightPhase = Math.sin(legPhase + Math.PI * 0.33);   // 60 degrees out of phase

            // Apply transformations - pivot from where the leg connects to the body
            const maxRotation = 15; // Maximum rotation in degrees

            // Transform legs with rotation around their connection points
            leftFrontLeg.setAttribute('transform', `rotate(${frontLeftPhase * maxRotation}, 160, 110)`);
            leftMiddleLeg.setAttribute('transform', `rotate(${middleLeftPhase * maxRotation}, 160, 150)`);
            leftBackLeg.setAttribute('transform', `rotate(${backLeftPhase * maxRotation}, 160, 190)`);

            rightFrontLeg.setAttribute('transform', `rotate(${frontRightPhase * maxRotation}, 240, 110)`);
            rightMiddleLeg.setAttribute('transform', `rotate(${middleRightPhase * maxRotation}, 240, 150)`);
            rightBackLeg.setAttribute('transform', `rotate(${backRightPhase * maxRotation}, 240, 190)`);
        }

        // Check if beetle should exit the screen
        if (pos.x < -50 || pos.x > window.innerWidth + 50 ||
            pos.y < -50 || pos.y > window.innerHeight + 50) {
            // 5% chance to exit per frame when near edge
            if (Math.random() < 0.05) {
                document.body.removeChild(beetle);
                isActive = false;
                return;
            }
        }

        // Schedule next animation frame
        requestAnimationFrame(moveBeetle);
    }

    // Start the animation
    requestAnimationFrame(moveBeetle);

    // After 10-20 seconds, make beetle leave the screen
    setTimeout(() => {
        // Head toward an exit
        const exits = [
            { x: -50, y: Math.random() * window.innerHeight },
            { x: window.innerWidth + 50, y: Math.random() * window.innerHeight },
            { x: Math.random() * window.innerWidth, y: -50 },
            { x: Math.random() * window.innerWidth, y: window.innerHeight + 50 }
        ];

        destination = exits[Math.floor(Math.random() * exits.length)];

        // Remove after a delay to ensure it moves offscreen
        setTimeout(() => {
            if (beetle.parentNode) {
                document.body.removeChild(beetle);
            }
            isActive = false;
        }, 5000);
    }, 10000 + Math.random() * 10000);
}

function showEmptyState() {
    const logArea = document.getElementById('log-area');
    if (!logArea) return;

    // Clear any existing content
    logArea.innerHTML = '';

    // Create empty state message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex flex-col items-center justify-center h-full text-center p-8';
    messageDiv.innerHTML = `
        <svg id="tracking-eye" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="w-16 h-16">
            <circle cx="8" cy="8" r="7" fill="#FF8A65" stroke="#1a1a1a" stroke-width="1.2"/>
            <circle id="eye-pupil" cx="8" cy="8" r="3" fill="#1a1a1a"/>
            <circle id="eye-highlight" cx="9" cy="7" r="1" fill="white"/>
        </svg>
        <h3 class="text-xl font-semibold text-gray-700 mb-2">Ready to start tracing?</h3>
        <p class="text-gray-500 mb-6">Click the button below to begin tracings</p>
        <button id="start-logging-btn" class="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors">
            <svg data-lucide="play" class="w-5 h-5"></svg>
            Start tracing
        </button>`;

    logArea.appendChild(messageDiv);

    // Initialize Lucide icons
    lucide.createIcons(messageDiv);

    // Add click handler to the button
    const startButton = messageDiv.querySelector('#start-logging-btn');
    startButton.addEventListener('click', () => {
        document.getElementById('toggle-logging').click();
    });

    emptyStateMessage = messageDiv;
}
function updateEyePosition(mouseX, mouseY) {
    const svg = document.getElementById('tracking-eye');
    const pupil = document.getElementById('eye-pupil');
    const highlight = document.getElementById('eye-highlight');
    if (!svg || !pupil || !highlight) return;

    // 1) Eye center in page coords
    const rect = svg.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // 2) Horizontal distance from eye center to mouse
    const dx = mouseX - centerX;
    // Decide the max horizontal distance to left or right edge
    let maxDistX = (dx < 0) ? centerX : (window.innerWidth - centerX);
    // Prevent divide-by-zero if center is near edge
    if (maxDistX < 1) maxDistX = 1;

    // 3) ratioX in [-1, +1] => how far along the left-right span
    let ratioX = dx / maxDistX;
    // Optionally clamp if mouse goes “off” screen
    if (ratioX < -1) ratioX = -1;
    if (ratioX > 1) ratioX = 1;

    // 4) Vertical distance
    const dy = mouseY - centerY;
    let maxDistY = (dy < 0) ? centerY : (window.innerHeight - centerY);
    if (maxDistY < 1) maxDistY = 1;

    let ratioY = dy / maxDistY;
    if (ratioY < -1) ratioY = -1;
    if (ratioY > 1) ratioY = 1;

    // 5) Decide how far pupil can move (in SVG units).
    // e.g. if outer circle is radius 7, pupil is radius 3 => max = 4
    const maxOffset = 3;

    // Convert ratio -> offset in SVG coordinates
    const offsetX = ratioX * maxOffset;
    const offsetY = ratioY * maxOffset;

    // Move pupil (original center at 8,8)
    pupil.setAttribute('cx', 8 + offsetX);
    pupil.setAttribute('cy', 8 + offsetY);

    // Move highlight (originally at 9,7)
    highlight.setAttribute('cx', 9 + offsetX);
    highlight.setAttribute('cy', 7 + offsetY);
}
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        if (activeScreenshotEvent) {
            document.getElementById('save-annotation').click();
        } else {
            window.electron.ipcRenderer.send('take-screenshot');
        }
    }
});
document.addEventListener('mousemove', (e) => {
    updateEyePosition(e.clientX, e.clientY);
});
function addInitialPageLoad() {
    const logArea = document.getElementById('log-area');
    if (!logArea || !webview) return;

    const timeStr = formatTimestamp(new Date().toISOString());
    const logData = {
        action: 'page-loaded',
        timestamp: new Date().toISOString(),
        title: webview.getTitle() || 'Untitled',
        url: webview.getURL()
    };

    // Create the log entry
    const entry = document.createElement('div');
    entry.className = "p-3 rounded bg-gray-100 relative flex flex-col";
    entry.dataset.timestamp = logData.timestamp;

    entry.innerHTML = `
        <div class="flex-1">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] text-gray-500 border border-gray-200 rounded px-1 py-0.5">#1</span>
                    <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">
                        PAGE LOADED
                    </span>
                </div>
                <div class="flex items-center gap-2" id="icon-slot"></div>
            </div>
            <div>
                <div class="mt-2 space-y-1 text-sm">
                    <div class="grid grid-cols-[120px,1fr] gap-2 break-words">
                        <span class="font-medium">Page Title:</span>
                        <span class="break-words text-left">${logData.title}</span>
                        <span class="font-medium">URL:</span>
                        <div class="flex items-center gap-2">
                            <a href="${logData.url}" class="text-blue-600 hover:text-blue-800 underline break-words text-left" title="${logData.url}">
                                ${logData.url.length > 25 ? logData.url.substring(0, 25) + "..." : logData.url}
                            </a>
                            <button class="copy-url-btn ml-auto pr-[2.5px] hover:bg-gray-100 rounded" title="Copy URL to clipboard" data-url="${logData.url}">
                                <svg data-lucide="clipboard" width="14" height="14"></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Add Footer with Timestamp -->
        <div class="flex justify-end mt-4 pt-2 border-t border-gray-200">
            <span class="text-gray-400 text-[11px]">${timeStr}</span>
        </div>
    `;

    // Add to event log array
    eventLog.push(logData);

    // Add to UI
    logArea.appendChild(entry);

    const copyButtons = entry.querySelectorAll('.copy-url-btn');
    copyButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.currentTarget.dataset.url;
            window.electron.clipboard.writeText(url);

            // Toast notification for URL copy
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-4 left-4 bg-cyan-600 text-white px-4 py-2 rounded shadow-lg text-sm';
            toast.textContent = 'URL copied to clipboard!';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);

            // Temporarily change the button title to "Copied!"
            const originalTitle = e.currentTarget.title;
            e.currentTarget.title = 'Copied!';
            setTimeout(() => {
                e.currentTarget.title = originalTitle;
            }, 1500);
        });
    });

    lucide.createIcons(entry);
    setupCommentFeature(entry, logData);

    // Scroll to bottom
    logArea.scrollTop = logArea.scrollHeight;
}
function showModal(modalId, { message = '', title = '', onConfirm = () => { }, onCancel = () => { } } = {}) {
    const container = document.getElementById('modal-container');
    const modal = document.getElementById(modalId);

    if (!container || !modal) {
        console.error('Modal elements not found');
        return;
    }

    // Hide all existing modals first
    const allModals = container.querySelectorAll('div[id$="-modal"]');
    allModals.forEach(m => {
        m.classList.add('hidden');
        m.classList.remove('flex');
        // Clear any inline styles
        m.style.cssText = '';
    });

    // Show container and ensure it's positioned correctly
    container.classList.remove('hidden');
    container.classList.add('flex');
    container.style.cssText = 'display: flex; align-items: center; justify-content: center;';

    // Position the modal in the center
    modal.classList.remove('hidden');
    modal.style.cssText = `
        position: relative;
        margin: auto;
        max-height: 90vh;
        overflow-y: auto;
    `;

    // Handle message and title if provided
    if (modalId === 'delete-screenshot-modal') {
        const titleEl = modal.querySelector('#delete-screenshot-title');
        const messageEl = modal.querySelector('#delete-screenshot-message');
        if (titleEl && title) titleEl.textContent = title;
        if (messageEl && message) messageEl.textContent = message;
    } else if (message && modalId === 'alert-modal') {
        const messageEl = document.getElementById('alert-message');
        if (messageEl) messageEl.textContent = message;
    }

    // Handle modal buttons
    const confirmBtn = modal.querySelector('.confirm-modal');
    const cancelBtn = modal.querySelector('.cancel-modal');
    const closeBtn = modal.querySelector('#close-shortcuts-modal');
    const closeBtnX = modal.querySelector('#close-shortcuts-x');

    document.querySelectorAll(".cancel-modal").forEach(button => {
        button.addEventListener("click", () => {
            document.getElementById("reset-log-modal").classList.add("hidden");
            document.getElementById("modal-container").classList.add("hidden");
        });
    });


    function closeModal() {
        // Hide both container and modal
        container.classList.add('hidden');
        container.classList.remove('flex');
        modal.classList.add('hidden');

        // Clear styles
        container.style.cssText = '';
        modal.style.cssText = '';

        // Clean up event listeners
        cleanup();
    }

    function cleanup() {
        if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
        if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
        if (closeBtn) closeBtn.removeEventListener('click', handleCancel);
        if (closeBtnX) closeBtnX.removeEventListener('click', handleCancel);

        window.removeEventListener('keydown', handleKeydown);
    }

    function handleConfirm() {
        if (typeof onConfirm === 'function') onConfirm();
        closeModal();
    }

    function handleCancel() {
        if (typeof onCancel === 'function') onCancel();
        closeModal();
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
        else if (e.key === 'Enter' && document.activeElement !== cancelBtn) {
            e.preventDefault();
            handleConfirm();
        }
        else if (e.key === 'Enter' && document.activeElement !== closeBtn) {
            e.preventDefault();
            handleConfirm();
        }
        else if (e.key === 'Enter' && document.activeElement !== closeBtnX) {
            e.preventDefault();
            handleConfirm();
        }
    }

    // Add event listeners
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    if (closeBtn) closeBtn.addEventListener('click', handleCancel);
    if (closeBtnX) closeBtnX.addEventListener('click', handleCancel);

    window.addEventListener('keydown', handleKeydown);

    // Also handle clicking outside the modal to close
    container.addEventListener('click', (e) => {
        if (e.target === container) handleCancel();
    });
}
function createScreenshotEvent(targetElement) {
    return {
        action: 'screenshot',
        timestamp: new Date().toISOString(),
        details: getElementDetails(targetElement || document.body)
    };
}
function formatTimestamp(isoString) {
    const d = new Date(isoString);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${month}/${day}/${year} ${hours.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
}
function showModalImage(src, eventTimestamp) {
    const modal = document.getElementById('screenshot-modal');
    const img = modal.querySelector('#modal-image');
    const canvas = document.getElementById('annotation-canvas');

    // Reset annotation state
    currentTool = null;
    undoStack = [];
    redoStack = [];
    document.querySelectorAll('.annotation-tool').forEach(t => t.classList.remove('active'));

    // If a timestamp was passed in, find the corresponding log event
    if (eventTimestamp) {
        const foundEvent = eventLog.find(e => e.timestamp === eventTimestamp);
        if (foundEvent) {
            activeScreenshotEvent = foundEvent;
        } else {
            activeScreenshotEvent = null;
        }
    }


    // Update buttons state
    document.getElementById('annotation-undo').disabled = true;
    document.getElementById('annotation-redo').disabled = true;

    img.onload = () => {
        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.style.pointerEvents = 'none'; // Disable drawing until tool selected

        // Ensure annotationCtx is set
        if (!annotationCtx) {
            annotationCtx = canvas.getContext('2d');
        }

        // Clear canvas
        annotationCtx.clearRect(0, 0, canvas.width, canvas.height);
        currentImage = img;
    };

    img.src = src;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
function toggleLogging() {
    // Flip the boolean
    loggingEnabled = !loggingEnabled;

    const button = document.getElementById('toggle-logging');
    const icon = button.querySelector('svg');

    if (loggingEnabled) {
        // Switch to stop icon with animation
        icon.setAttribute('data-lucide', 'pause');
        button.setAttribute('title', 'Stop Logging');
        showToast('Logging Started');

        // Add animation class
        icon.classList.add('icon-pulse');
        // Remove animation class after it completes
        setTimeout(() => {
            icon.classList.remove('icon-pulse');
        }, 400);

        // Only clear empty state if first time starting
        if (isFirstLog && emptyStateMessage) {
            emptyStateMessage.remove();
            emptyStateMessage = null;
            isFirstLog = false;
            // Add initial page load entry only on first start
            addInitialPageLoad();
        }
    } else {
        // Switch to play icon with animation
        icon.setAttribute('data-lucide', 'play');
        button.setAttribute('title', 'Start Logging');
        showToast('Logging Paused');

        // Add animation class
        icon.classList.add('icon-pulse');
        // Remove animation class after it completes
        setTimeout(() => {
            icon.classList.remove('icon-pulse');
        }, 400);

        // Do NOT show empty state when pausing
    }

    // Re-render Lucide icons
    lucide.createIcons();
}
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && (event.code === 'Space' || event.key === ' ')) {
        event.preventDefault();
        toggleLogging();
    }
});
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('jira-settings-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideExportJiraSettingsModal();
            }
        });
    }
});
window.showModalImage = showModalImage;
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 left-4 bg-cyan-600 text-white px-4 py-2 rounded shadow-lg text-sm z-50';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}
function base64ToURL(base64Data) {
    const byteString = atob(base64Data.split(',')[1]);
    const mimeString = base64Data.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    return URL.createObjectURL(blob);
}
function hideErrorDrawer() {
    errorDrawer.classList.add("hidden");
    // Switch icon back to "open" since the drawer is now hidden
    errorIcon.setAttribute("data-lucide", "panel-bottom-open");
    lucide.createIcons(); // re-render icons
}
function showExportJiraSettingsModal() {
    console.log("Current jiraFields:", jiraFields)
    console.log("showExportJiraSettingsModal called");
    const modalContainer = document.getElementById('modal-container');
    const modal = document.getElementById('jira-settings-modal');

    // Make sure both elements exist
    if (!modal || !modalContainer) {
        console.error("Required modal elements not found");
        return;
    }

    // Show the container first
    modalContainer.classList.remove('hidden');
    modalContainer.classList.add('flex');
    modalContainer.style.cssText = 'display: flex; align-items: center; justify-content: center;';

    // Show the JIRA settings modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Get the table body
    const tableBody = modal.querySelector('#jira-fields-table tbody');
    console.log("Found table body:", tableBody);

    if (!tableBody) {
        console.error("Could not find table body!");
        return;
    }
    // Clear existing rows
    tableBody.innerHTML = '';
    console.log("Cleared table body");

    // 1) Remove existing issue-type container if it exists
    const existingIssueTypeContainer = modal.querySelector('#issue-type-container');
    if (existingIssueTypeContainer) {
        existingIssueTypeContainer.remove();
    }

    // 2) Create a container for Issue Type
    const issueTypeContainer = document.createElement('div');
    issueTypeContainer.id = 'issue-type-container';
    issueTypeContainer.className = 'mb-4';

    // 3) Add a label
    const issueTypeLabel = document.createElement('label');
    issueTypeLabel.textContent = 'Issue Type:';
    issueTypeLabel.className = 'block font-medium mb-1';
    issueTypeContainer.appendChild(issueTypeLabel);

    // 4) Create a select element
    const issueTypeSelect = document.createElement('select');
    issueTypeSelect.id = 'issue-type-select';
    issueTypeSelect.className = 'w-full border border-gray-300 rounded px-2 py-1 mb-2';
    issueTypeContainer.appendChild(issueTypeSelect);

    // 5) Add an initial <option> so the user can see something
    const defaultOption = document.createElement('option');
    defaultOption.value = 'Defect';
    defaultOption.textContent = 'Defect (default)';
    issueTypeSelect.appendChild(defaultOption);

    // 6) Populate the select with any previously used types from localStorage
    let storedIssueTypes = JSON.parse(localStorage.getItem('issueTypesHistory') || '[]');
    storedIssueTypes.forEach(type => {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        issueTypeSelect.appendChild(opt);
    });

    // 7) Create a text input for a brand-new Issue Type
    const newTypeLabel = document.createElement('label');
    newTypeLabel.textContent = 'Add a new Issue Type (saved for next time):';
    newTypeLabel.className = 'block font-medium mt-2 mb-1';
    issueTypeContainer.appendChild(newTypeLabel);

    const newTypeInput = document.createElement('input');
    newTypeInput.type = 'text';
    newTypeInput.id = 'issue-type-new';
    newTypeInput.placeholder = 'e.g. "Story", "Task", etc.';
    newTypeInput.className = 'w-full border border-gray-300 rounded px-2 py-1';
    issueTypeContainer.appendChild(newTypeInput);

    const note = document.createElement('p');
    note.className = 'text-xs text-gray-500 mt-1';
    note.textContent = 'This new type will be added to your dropdown after you click Save & Export.';
    issueTypeContainer.appendChild(note);

    // ------------------------------
    // STEP 3: Add event listeners
    // ------------------------------
    issueTypeSelect.addEventListener('change', (e) => {
        // If user picks from dropdown, store it in your global
        currentIssueType = e.target.value;
        // Clear typed text
        typedIssueType = '';
        newTypeInput.value = '';
    });

    newTypeInput.addEventListener('input', (e) => {
        // If user types a new Issue Type, store it in typedIssueType
        typedIssueType = e.target.value;
        // Clear the dropdown selection
        currentIssueType = '';
        issueTypeSelect.value = '';
    });


    // 8) Insert issueTypeContainer into the main content container
    const mainContent = modal.querySelector('#jira-settings-content');
    if (!mainContent) {
        console.error('Could not find main content container for issue type UI!');
        return;
    }
    const heading = mainContent.querySelector('h2');
    mainContent.insertBefore(issueTypeContainer, heading.nextSibling);

    // ---------------------------------------------------------
    // 9) Restore previously selected/typed values
    //    (using your global currentIssueType, typedIssueType)
    // ---------------------------------------------------------

    // If we haven't typed anything, show the currentIssueType in the dropdown
    if (!typedIssueType.trim()) {
        issueTypeSelect.value = currentIssueType || 'Defect';
    } else {
        // If we do have typed text, clear the dropdown selection
        issueTypeSelect.value = '';
    }
    // Restore what's typed
    newTypeInput.value = typedIssueType;

    // Add listeners so changes persist
    issueTypeSelect.addEventListener('change', (e) => {
        // If user picks from dropdown, store it globally
        currentIssueType = e.target.value;
        // Clear typed text
        typedIssueType = '';
        newTypeInput.value = '';
    });

    newTypeInput.addEventListener('input', (e) => {
        // If user types something new, store it in typedIssueType
        typedIssueType = e.target.value;
        // Clear the dropdown selection
        currentIssueType = '';
        issueTypeSelect.value = '';
    });

    // Remove existing summary container if it exists
    const existingSummaryContainer = modal.querySelector('#jira-summary-container');
    if (existingSummaryContainer) {
        existingSummaryContainer.remove();
    }

    // Create a container for Summary
    const summaryContainer = document.createElement('div');
    summaryContainer.id = 'jira-summary-container';
    summaryContainer.className = 'mb-4';

    const summaryLabel = document.createElement('label');
    summaryLabel.textContent = 'Summary:';
    summaryLabel.className = 'block font-medium mb-1';
    summaryContainer.appendChild(summaryLabel);

    const summaryInput = document.createElement('input');
    summaryInput.type = 'text';
    summaryInput.id = 'jira-summary-input';
    summaryInput.placeholder = 'Enter a descriptive summary for this issue';
    summaryInput.required = true;
    summaryInput.className = 'w-full border border-gray-300 rounded px-2 py-1';
    summaryContainer.appendChild(summaryInput);

    // Add a required indicator
    const requiredIndicator = document.createElement('div');
    requiredIndicator.className = 'text-red-500 text-xs mt-1';
    requiredIndicator.textContent = '* Required field';
    summaryContainer.appendChild(requiredIndicator);

    // Insert summaryContainer after the issueTypeContainer
    mainContent.insertBefore(summaryContainer, issueTypeContainer.nextSibling);

    // Restore typedSummary so it doesn’t reset each time
    summaryInput.value = typedSummary;

    // Listen for input changes => update typedSummary
    summaryInput.addEventListener('input', (e) => {
        typedSummary = e.target.value;
    });


    // ---------------------------------------------------------
    // 10) Remove existing "Recent Custom Fields" container
    // ---------------------------------------------------------
    const existingRecentContainer = modal.querySelector('#recent-custom-fields-container');
    if (existingRecentContainer) {
        existingRecentContainer.remove();
    }

    // Remove the existing infoSection if it exists
    const existingInfoSection = modal.querySelector('#custom-jira-info-section');
    if (existingInfoSection) {
        existingInfoSection.remove();
    }

    // ---------------------------------------------------------
    // 11) Load stored custom fields from localStorage (if any)
    // ---------------------------------------------------------
    let storedJiraFields = JSON.parse(localStorage.getItem('jiraFieldsHistory') || '[]');
    if (storedJiraFields.length > 0) {
        const recentContainer = document.createElement('div');
        recentContainer.id = 'recent-custom-fields-container';
        recentContainer.className = 'mb-4 text-sm text-gray-600';
        recentContainer.innerHTML = '<strong>Recent Custom Fields:</strong> ';

        storedJiraFields.forEach((field) => {
            // Create a small wrapper so the button + delete icon can sit together
            const fieldWrapper = document.createElement('span');
            fieldWrapper.className = 'inline-flex items-center mr-2 mb-2';

            // The main button that re-adds the field
            const fieldBtn = document.createElement('button');
            fieldBtn.className = 'px-2 py-1 bg-gray-200 rounded-l text-xs hover:bg-gray-300';
            fieldBtn.textContent = field.name + ' | ' + field.value;

            fieldBtn.addEventListener('click', () => {
                // If the first row is empty, fill it
                if (
                    jiraFields.length > 0 &&
                    jiraFields[0].name.trim() === '' &&
                    jiraFields[0].value.trim() === ''
                ) {
                    jiraFields[0].name = field.name;
                    jiraFields[0].value = field.value;
                } else {
                    // Otherwise, add a new row
                    jiraFields.push({ name: field.name, value: field.value });
                }
                showExportJiraSettingsModal();
            });

            // The delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'px-2 py-1 bg-red-200 text-red-800 text-xs hover:bg-red-300 rounded-r';
            deleteBtn.title = 'Remove this saved field';
            deleteBtn.textContent = 'X';

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // So it doesn’t trigger the fieldBtn click
                // Remove from localStorage
                let stored = JSON.parse(localStorage.getItem('jiraFieldsHistory') || '[]');
                stored = stored.filter(
                    (f) => f.name !== field.name || f.value !== field.value
                );
                localStorage.setItem('jiraFieldsHistory', JSON.stringify(stored));

                // Remove from the DOM
                fieldWrapper.remove();
            });

            fieldWrapper.appendChild(fieldBtn);
            fieldWrapper.appendChild(deleteBtn);

            recentContainer.appendChild(fieldWrapper);
        });

        const tableContainer = document.getElementById('jira-fields-table');
        tableContainer.parentNode.insertBefore(recentContainer, tableContainer);
    }

    // ---------------------------------------------------------
    // 12) Add the info section above the table
    // ---------------------------------------------------------
    const infoSection = document.createElement('div');
    infoSection.id = 'custom-jira-info-section';
    infoSection.className = 'mb-4 text-sm text-gray-600 bg-gray-50 p-3 rounded';
    infoSection.innerHTML = `
      <p class="mb-2"><strong>Custom JIRA Fields</strong></p>
      <p>Add additional JIRA fields to your export:</p>
      <ul class="list-disc ml-4 mt-2 space-y-1">
          <li>Field Name: The name of the JIRA field (e.g., "Component", "Priority")</li>
          <li>Value: What you want to set this field to</li>
          <li>Empty fields will be excluded from the export</li>
      </ul>
    `;
    const tableContainer = modal.querySelector('#jira-fields-table');
    tableContainer.parentNode.insertBefore(infoSection, tableContainer);

    // ---------------------------------------------------------
    // 13) Ensure we have at least one field
    // ---------------------------------------------------------
    if (jiraFields.length === 0) {
        jiraFields.push({ name: '', value: '' });
        console.log("Added initial field, jiraFields now:", jiraFields);
    }

    // 14) Create rows for each field
    jiraFields.forEach((field, index) => {
        console.log("Creating row for field:", field);
        const row = document.createElement('tr');
        row.className = 'border-b';

        // Field Name cell
        const nameCell = document.createElement('td');
        nameCell.className = 'py-2 pr-2';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = field.name;
        nameInput.className = 'w-full border border-gray-300 rounded px-2 py-1';
        nameInput.placeholder = 'Field name';
        nameInput.addEventListener('input', (e) => {
            jiraFields[index].name = e.target.value;
        });
        nameCell.appendChild(nameInput);

        // Field Value cell
        const valueCell = document.createElement('td');
        valueCell.className = 'py-2';
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.value = field.value;
        valueInput.className = 'w-full border border-gray-300 rounded px-2 py-1';
        valueInput.placeholder = 'Field value';
        valueInput.addEventListener('input', (e) => {
            jiraFields[index].value = e.target.value;
        });
        valueCell.appendChild(valueInput);

        // Actions cell
        const actionsCell = document.createElement('td');
        actionsCell.className = 'py-2 pl-2 w-20';

        const actionButtons = document.createElement('div');
        actionButtons.className = 'flex gap-2';

        // Reset button (only for first row)
        if (index === 0) {
            const resetBtn = document.createElement('button');
            resetBtn.className = 'p-1 text-gray-400 hover:text-blue-500 transition-colors';
            resetBtn.title = 'Clear values';
            resetBtn.innerHTML = '<svg data-lucide="refresh-cw" width="16" height="16"></svg>';
            resetBtn.addEventListener('click', () => {
                nameInput.value = '';
                valueInput.value = '';
                jiraFields[index].name = '';
                jiraFields[index].value = '';
            });
            actionButtons.appendChild(resetBtn);
        }

        // Delete button (not for first row)
        if (index > 0) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'p-1 text-gray-400 hover:text-red-500 transition-colors';
            deleteBtn.title = 'Delete field';
            deleteBtn.innerHTML = '<svg data-lucide="trash-2" width="16" height="16"></svg>';
            deleteBtn.addEventListener('click', () => {
                jiraFields.splice(index, 1);
                showExportJiraSettingsModal(); // Refresh the modal
            });
            actionButtons.appendChild(deleteBtn);
        }

        actionsCell.appendChild(actionButtons);

        row.appendChild(nameCell);
        row.appendChild(valueCell);
        row.appendChild(actionsCell);
        tableBody.appendChild(row);
    });

    // Re-run Lucide icons
    lucide.createIcons(modal);

    // Remove any existing display classes
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Force the modal to be visible with inline styles
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '9999';

    // Log final state
    console.log("Modal final display:", modal.style.display);
    console.log("Modal final visibility:", modal.style.visibility);
    console.log("Modal final classes:", modal.classList);
    console.log("Modal computed style:", window.getComputedStyle(modal).display);
}
function hideExportJiraSettingsModal() {
    const modalContainer = document.getElementById('modal-container');
    const jiraSettingsModal = document.getElementById('jira-settings-modal');

    // Remove flex display from both 
    modalContainer.classList.remove('flex');
    jiraSettingsModal.classList.remove('flex');

    // Add hidden class to both
    modalContainer.classList.add('hidden');
    jiraSettingsModal.classList.add('hidden');

    // Reset all styles that might have been added
    modalContainer.style.cssText = '';
    jiraSettingsModal.style.cssText = '';

    // Force background removal
    document.body.classList.remove('overflow-hidden');
    modalContainer.style.background = 'none';
}
// Function to show JIRA comment export modal
function showJiraCommentExport() {
    // Check if we have event logs
    if (eventLog.length === 0) {
        showModal('alert-modal', {
            message: 'No logs to export.',
            onConfirm: () => { }
        });
        return;
    }

    // Create formatted text for JIRA comment
    const jiraText = generateJiraCommentText();

    // Create the modal
    const modal = document.createElement('div');
    modal.id = 'jira-comment-export-modal';
    modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-lg w-3/4 max-w-4xl max-h-[80vh] flex flex-col">
            <div class="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 class="text-xl font-semibold">JIRA Comment Export</h2>
                <button id="close-jira-comment-modal" class="text-gray-500 hover:text-gray-700">
                    <svg data-lucide="x" width="20" height="20"></svg>
                </button>
            </div>
            <div class="p-4 flex-grow overflow-auto">
                <p class="mb-4">Copy the text below and paste it into a JIRA comment (using Text mode):</p>
                <div class="relative">
                    <pre id="jira-comment-text" class="bg-gray-100 p-4 rounded text-sm font-mono overflow-auto max-h-[50vh] whitespace-pre-wrap">${jiraText}</pre>
                    <button id="copy-jira-text" class="absolute top-2 right-2 bg-gray-800 text-white p-2 rounded hover:bg-gray-900 flex items-center gap-1">
                        <svg data-lucide="clipboard" width="16" height="16"></svg>
                        Copy
                    </button>
                </div>
            </div>
            <div class="p-4 border-t border-gray-200 flex justify-end">
                <button id="close-comment-modal" class="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    lucide.createIcons(modal);

    // Set up event listeners
    document.getElementById('close-jira-comment-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    document.getElementById('close-comment-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    document.getElementById('copy-jira-text').addEventListener('click', () => {
        const textArea = document.getElementById('jira-comment-text');
        window.electron.clipboard.writeText(textArea.textContent);

        // Update button text temporarily to indicate success
        const copyButton = document.getElementById('copy-jira-text');
        const originalContent = copyButton.innerHTML;
        copyButton.innerHTML = '<svg data-lucide="check" width="16" height="16"></svg> Copied!';
        lucide.createIcons(copyButton);

        setTimeout(() => {
            copyButton.innerHTML = originalContent;
            lucide.createIcons(copyButton);
        }, 2000);

        showToast('Text copied to clipboard!');
    });

    // Close on Escape key
    document.addEventListener('keydown', function escKeyHandler(e) {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escKeyHandler);
        }
    });

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

function generateJiraCommentText() {
    // Proper HTML escaping that preserves JIRA markup
    function escapeHtml(text) {
        if (!text) return '';
        // Escape HTML but preserve JIRA markup
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Helper for JIRA panels
    function createPanel(title, content) {
        return `{panel:title=${title}}\n${content}{panel}\n`;
    }

    // Special function to handle code/monospace formatting with HTML-like content
    function formatMonospace(content) {
        // First escape HTML special characters to prevent rendering
        const escaped = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Then wrap in JIRA monospace formatting
        return `{{${escaped}}}`;
    }

    if (eventLog.length === 0) return "No events to export.";

    // Format events for JIRA comment
    let text = "h2. tracer Session Report\n\n";
    text += `* Start Time: ${formatTimestamp(eventLog[0].timestamp)}\n`;
    text += `* End Time: ${formatTimestamp(eventLog[eventLog.length - 1].timestamp)}\n`;
    text += `* Total Actions: ${eventLog.length}\n\n`;

    // Interactive elements whitelist
    const interactiveTags = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

    // Process each event
    eventLog.forEach((log, index) => {
        const timeStr = formatTimestamp(log.timestamp);
        text += `h3. (${index + 1}) ${timeStr} - ${log.action.toUpperCase()}\n`;

        switch (log.action) {
            case 'page-loaded':
                if (log.title) {
                    text += `*Page Title:* "${escapeHtml(log.title)}"\n`;
                }
                if (log.url) {
                    text += `*URL:* [${log.url}|${log.url}]\n`;
                }
                break;

            case 'click': {
                const d = log.details || {};

                // Handle element tag properly with correct escaping
                if (d.tagName && d.tagName.trim()) {
                    const elementTag = d.tagName.trim().toLowerCase();
                    text += `*Element:* ${formatMonospace(`<${elementTag}>`)}\n`;
                } else {
                    text += `*Element:* [Unknown Element]\n`;
                }

                if (d.context) {
                    text += `*Context:* ${escapeHtml(d.context)}\n`;
                }

                if (d.text) {
                    text += `*Text:* "${escapeHtml(d.text)}"\n`;
                }

                // Font information
                if (d.fontInfo) {
                    let fontContent = '';
                    fontContent += `* Font Family: ${d.fontInfo.fontFamily}\n`;
                    fontContent += `* Font Size: ${d.fontInfo.fontSize}\n`;
                    fontContent += `* Font Weight: ${d.fontInfo.fontWeight}\n`;
                    fontContent += `* Font Style: ${d.fontInfo.fontStyle}\n`;
                    fontContent += `* Line Height: ${d.fontInfo.lineHeight}\n`;
                    fontContent += `* Color: ${d.fontInfo.color}\n`;
                    text += createPanel('Font Information', fontContent);
                }

                if ((d.tagName || '').toUpperCase() === 'SVG') {
                    let svgContent = '';
                    if (d.svgTitle) svgContent += `* SVG Title: "${d.svgTitle}"\n`;
                    if (d.svgDesc) svgContent += `* SVG Description: "${d.svgDesc}"\n`;
                    if (d.svgWidth) svgContent += `* Width: ${d.svgWidth}\n`;
                    if (d.svgHeight) svgContent += `* Height: ${d.svgHeight}\n`;
                    if (d.svgViewBox) svgContent += `* ViewBox: ${d.svgViewBox}\n`;
                    if (svgContent) {
                        description += createPanel('SVG Details', svgContent);
                    }
                }

                if ((d.tagName || '').toUpperCase() === 'VIDEO') {
                    let mediaContent = '';
                    if (d.src) mediaContent += `* Source: ${d.src}\n`;
                    if (d.controls !== undefined) mediaContent += `* Controls: ${d.controls ? 'Yes' : 'No'}\n`;
                    if (d.currentTime) mediaContent += `* Current Time: ${d.currentTime}s\n`;
                    if (d.duration) mediaContent += `* Duration: ${d.duration}\n`;
                    if (d.paused !== undefined) mediaContent += `* Paused: ${d.paused ? 'Yes' : 'No'}\n`;
                    if (d.volume !== undefined) mediaContent += `* Volume: ${d.volume}\n`;
                    if (mediaContent) {
                        description += createPanel('Video Details', mediaContent);
                    }
                } else if ((d.tagName || '').toUpperCase() === 'AUDIO') {
                    let mediaContent = '';
                    if (d.src) mediaContent += `* Source: ${d.src}\n`;
                    if (d.controls !== undefined) mediaContent += `* Controls: ${d.controls ? 'Yes' : 'No'}\n`;
                    if (d.currentTime) mediaContent += `* Current Time: ${d.currentTime}s\n`;
                    if (d.duration) mediaContent += `* Duration: ${d.duration}\n`;
                    if (d.paused !== undefined) mediaContent += `* Paused: ${d.paused ? 'Yes' : 'No'}\n`;
                    if (d.volume !== undefined) mediaContent += `* Volume: ${d.volume}\n`;
                    if (mediaContent) {
                        description += createPanel('Audio Details', mediaContent);
                    }
                }

                // Parent Container in a JIRA panel
                if (d.parentContainer) {
                    let containerDesc = '[No container details]';

                    // If there's a snippet, use it
                    if (d.parentContainer.snippet && d.parentContainer.snippet.trim()) {
                        containerDesc = escapeHtml(d.parentContainer.snippet.trim());
                    }
                    // Otherwise construct a minimal <tag> string
                    else if (d.parentContainer.tagName && d.parentContainer.tagName.trim()) {
                        const pcTag = d.parentContainer.tagName.trim().toLowerCase();
                        containerDesc = `<${pcTag}`;

                        if (d.parentContainer.id && d.parentContainer.id.trim()) {
                            containerDesc += ` id="${d.parentContainer.id.trim()}"`;
                        }
                        if (d.parentContainer.className && d.parentContainer.className.trim()) {
                            containerDesc += ` class="${d.parentContainer.className.trim()}"`;
                        }
                        if (d.parentContainer.role && d.parentContainer.role.trim()) {
                            containerDesc += ` role="${d.parentContainer.role.trim()}"`;
                        }
                        if (d.parentContainer.ariaLabel && d.parentContainer.ariaLabel.trim()) {
                            containerDesc += ` aria-label="${d.parentContainer.ariaLabel.trim()}"`;
                        }

                        containerDesc += `></${pcTag}>`;

                        // Escape any HTML angle brackets to avoid JIRA markup issues
                        containerDesc = escapeHtml(containerDesc);
                    }

                    // Wrap final containerDesc in JIRA monospace
                    const parentPanelContent = formatMonospace(containerDesc);

                    // Put it inside a Parent Container panel
                    text += createPanel('Parent Container', parentPanelContent);
                } else {
                    // If no parent info is available at all
                    text += createPanel('Parent Container', '[No container information]');
                }


                // Element-specific details
                if (d.tagName === 'IMG') {
                    let imgContent = `* Alt Text: ${escapeHtml(d.alt || '[No Alt Text]')}\n`;
                    imgContent += `* Dimensions: ${d.width}x${d.height}px\n`;
                    if (d.loading) imgContent += `* Loading: ${d.loading}\n`;
                    if (d.src) imgContent += `* Source: [View Image|${d.src}]\n`;
                    if (d.caption) imgContent += `* Caption: "${escapeHtml(d.caption)}"\n`;
                    text += createPanel('Image Details', imgContent);
                } else if (d.tagName === 'A') {
                    let linkContent = '';
                    if (d.href) linkContent += `* URL: [${d.href}|${d.href}]\n`;
                    if (d.target) linkContent += `* Target: ${d.target}\n`;
                    if (d.hasChildren && d.childTypes) linkContent += `* Contains: ${d.childTypes.join(', ')}\n`;
                    text += createPanel('Link Details', linkContent);
                }

                // Accessibility information
                if (d.ariaLabel || d.role || d.disabled !== undefined || d.required !== undefined) {
                    let accContent = '';
                    if (d.ariaLabel) accContent += `* ARIA Label: "${escapeHtml(d.ariaLabel)}"\n`;
                    if (d.role) accContent += `* Role: ${d.role}\n`;
                    if (d.required !== undefined) accContent += `* Required: ${d.required ? 'Yes' : 'No'}\n`;
                    if (d.disabled !== undefined) accContent += `* Disabled: ${d.disabled ? 'Yes' : 'No'}\n`;
                    if (accContent) {
                        text += createPanel('Accessibility Information', accContent);
                    }
                }

                if (d.xpath) {
                    text += `*XPath:* ${d.xpath}\n`;
                }

                if (d.scrollPosition) {
                    const pos = d.scrollPosition;
                    text += "*Scroll Position:*\n";
                    text += `  * Viewport: (top: ${pos.viewport.top}, left: ${pos.viewport.left})\n`;
                    text += `  * Page: (top: ${pos.page.top}, left: ${pos.page.left})\n`;
                }

                if (d.iframeContext && d.iframeContext.src) {
                    const iframe = d.iframeContext;
                    text += "*Iframe Context:*\n";
                    text += `  * Src: ${iframe.src}\n`;
                    if (iframe.name) text += `  * Name: ${iframe.name}\n`;
                    if (iframe.id) text += `  * ID: ${iframe.id}\n`;
                }
                break;
            }

            case 'tab-focus': {
                const from = log.previous?.tagName || '[Start]';
                const to = log.newElement?.tagName || '[End]';
                text += `*Tab Navigation:* ${from} → ${to}\n`;
                if (log.previous?.value) {
                    text += `*From Value:* "${escapeHtml(log.previous.value)}"\n`;
                }
                if (log.newElement?.value) {
                    text += `*To Value:* "${escapeHtml(log.newElement.value)}"\n`;
                }
                break;
            }
            

            case 'input-change': {
                const d = log.details || {};
                text += `*Input Type:* ${d.inputType || 'text'}\n`;

                if (d.inputType === 'checkbox' || d.inputType === 'radio') {
                    text += `* Label: ${escapeHtml(d.labelText || '[No Label]')}\n`;
                    text += `* State: ${d.checked ? 'Checked' : 'Unchecked'}\n`;
                    if (d.groupOptions) {
                        text += '*Group Options:*\n';
                        d.groupOptions.forEach(opt => {
                            text += `** ${escapeHtml(opt.labelText)} ${opt.checked ? '(Selected)' : ''}\n`;
                        });
                    }
                } else {
                    if (d.name) text += `* Name: ${escapeHtml(d.name)}\n`;
                    if (d.placeholder) text += `* Placeholder: ${escapeHtml(d.placeholder)}\n`;
                    if (d.value && d.inputType !== 'password') {
                        text += `* Value: "${escapeHtml(d.value)}"\n`;
                    }
                }

                // Validation state
                if (d.validationState) {
                    let valContent = '';
                    Object.entries(d.validationState)
                        .filter(([key, value]) => value !== false)
                        .forEach(([key, value]) => {
                            valContent += `* ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${value}\n`;
                        });
                    if (valContent) {
                        text += createPanel('Validation State', valContent);
                    }
                }
                break;
            }

            case 'keydown': {
                const pressed = [
                    log.ctrlKey ? 'Ctrl+' : '',
                    log.shiftKey ? 'Shift+' : '',
                    log.altKey ? 'Alt+' : '',
                    log.key
                ].join('');
                text += `*Key Pressed:* ${pressed}\n`;
                if (log.details && log.details.tagName) {
                    const tagName = log.details.tagName.toLowerCase();
                    text += `*Target Element:* ${formatMonospace(`<${tagName}>`)}\n`;
                    if (log.details.context) {
                        text += `*Context:* ${escapeHtml(log.details.context)}\n`;
                    }
                }
                break;
            }

            case 'select': {
                let selContent = `* Selected Value: ${escapeHtml(log.selectedValue || '[None]')}\n`;
                selContent += `* Selected Text: "${escapeHtml(log.selectedText || '[None]')}"\n`;
                if (log.details?.multiple && log.details?.selectedOptions) {
                    selContent += '*All Selected Options:*\n';
                    log.details.selectedOptions.forEach(opt => {
                        selContent += `** "${escapeHtml(opt.text)}" (${opt.value})\n`;
                    });
                }
                text += createPanel('Selection Details', selContent);
                break;
            }

            default:
                if (log.details) {
                    try {
                        const detailsStr = JSON.stringify(log.details);
                        text += `*Details:* ${detailsStr.length > 100 ? detailsStr.substring(0, 100) + '...' : detailsStr}\n`;
                    } catch (e) {
                        text += `*Details:* [Could not serialize details: ${e.message}]\n`;
                    }
                }
                break;
        }

        // Handle lists properly for JIRA comments as well
        if (log.comments && log.comments.length > 0) {
            let comContent = '';
            log.comments.forEach((comment, idx) => {
                if (idx > 0) {
                    comContent += '{color:#7E57C2}' + '─'.repeat(30) + '{color}\n\n';
                }
                comContent += `{color:#5E35B1}Comment ${idx + 1}:{color}\n`;

                // Use our improved HTML to Wiki converter
                const rawComment = comment.text || '';
                const wikiComment = window.convertHtmlToWiki(rawComment);
                comContent += `${wikiComment}\n\n`;

                comContent += `{color:#666666}_Posted: ${new Date(comment.timestamp).toLocaleString()}_\n{color}\n`;
            });
            text += createPanel('Comments', comContent);
        }

        // Add separator between events
        text += "\n----\n\n";
    });

    return text;
}


document.getElementById('jira-settings-modal').addEventListener('click', (e) => {
    // Only close if clicking the backdrop (not the modal content)
    if (e.target === e.currentTarget) {
        hideExportJiraSettingsModal();
    }
});
document.getElementById('close-jira-settings-modal').addEventListener('click', hideExportJiraSettingsModal);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const jiraModal = document.getElementById('jira-settings-modal');
        if (!jiraModal.classList.contains('hidden')) {
            hideExportJiraSettingsModal();
        }
    }
});
function hideKeyboardShortcutsModal() {
    const modalContainer = document.getElementById('modal-container');
    const keyboardShortcutsModal = document.getElementById('keyboard-shortcuts-modal');

    // Remove flex display from both 
    modalContainer.classList.remove('flex');
    keyboardShortcutsModal.classList.remove('flex');

    // Add hidden class to both
    modalContainer.classList.add('hidden');
    keyboardShortcutsModal.classList.add('hidden');

    // Reset all styles that might have been added
    modalContainer.style.cssText = '';
    keyboardShortcutsModal.style.cssText = '';

    // Force background removal
    document.body.classList.remove('overflow-hidden');
    modalContainer.style.background = 'none';
}
document.getElementById('keyboard-shortcuts-modal').addEventListener('click', (e) => {
    // Only close if clicking the backdrop (not the modal content)
    if (e.target === e.currentTarget) {
        hideKeyboardShortcutsModal();
    }
});
document.getElementById('close-shortcuts-modal').addEventListener('click', hideKeyboardShortcutsModal);
document.getElementById('close-shortcuts-x').addEventListener('click', hideKeyboardShortcutsModal);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const shortcutsModal = document.getElementById('keyboard-shortcuts-modal');
        if (!shortcutsModal.classList.contains('hidden')) {
            hideKeyboardShortcutsModal();
        }
    }
});
document.getElementById('add-jira-field').addEventListener('click', () => {
    jiraFields.push({ name: '', value: '' });
    showExportJiraSettingsModal(); // Re-render
});
document.addEventListener("keydown", (e) => {
    // If user pressed ESC and the drawer is currently visible, close it
    if (e.key === "Escape" && !errorDrawer.classList.contains("hidden")) {
        hideErrorDrawer();
    }
});
ipcRenderer.on('screenshot-save-result', (_, result) => {
    if (result.success) {
        showToast(`Screenshot saved successfully at: ${result.path}`);
    } else {
        showToast(`Failed to save screenshot: ${result.error}`);
    }
});
function showSharepointUsernameModal() {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById('sharepoint-username-modal');
        const input = document.getElementById('sp-username-input');
        const confirmBtn = document.getElementById('sp-username-confirm');
        const cancelBtn = document.getElementById('sp-username-cancel');

        // Show modal
        modal.classList.remove('hidden');
        modal.classList.add('flex');  // Tailwind "flex" to center stuff

        // Clear any old value
        input.value = '';

        // Focus the input right away
        setTimeout(() => input.focus(), 100);

        // Confirm => read the typed text, resolve, close modal
        function handleConfirm() {
            const typed = input.value.trim();
            if (!typed) {
                // If user left it blank, either reject or let them try again.
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                reject(new Error('No username typed'));
                return;
            }
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            resolve(typed);
        }

        // Cancel => just reject
        function handleCancel() {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            reject(new Error('User canceled username entry'));
        }

        confirmBtn.addEventListener('click', handleConfirm, { once: true });
        cancelBtn.addEventListener('click', handleCancel, { once: true });

        // Also close if user clicks outside the box
        modal.addEventListener('click', function clickOutside(e) {
            if (e.target === modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                reject(new Error('Modal dismissed by outside click'));
            }
            // Remove the listener once we close
        }, { once: true });
    });
}
ipcRenderer.on('reset-listeners', () => {
    console.log('Renderer: Resetting listeners...');

    // Clear the event log array
    eventLog.length = 0;

    // Clear the log UI
    const logArea = document.getElementById("log-area");
    if (logArea) {
        logArea.innerHTML = "";
    }

    // Ensure the welcome message appears and logging state resets correctly
    isFirstLog = true;
    loggingEnabled = false;  // <-- Ensures that clicking "Start Logging" actually starts logging

    // Show empty state message
    showEmptyState();

    // Ensure the Start Logging button is in the correct state
    updateStartLoggingButton();  // <-- This ensures the button text/icons update correctly

    document.querySelectorAll('input, textarea').forEach(input => {
        input.disabled = false;
        input.removeAttribute('readonly');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    console.log('Renderer: Inputs re-enabled.');
});
ipcRenderer.on('show-shortcuts-modal', () => {
    showModal('keyboard-shortcuts-modal');
});
linkStyle.textContent = `
    .comment-editor a {
        color: #2563eb;
        text-decoration: underline;
        cursor: pointer;
    }
    .comment-editor ul {
        list-style-type: disc;
        padding-left: 20px;
        margin: 8px 0;
    }
    .comment-editor ul li {
        display: list-item;
    }
        .comment-editor ol {
    list-style-type: decimal; /* or "decimal-leading-zero" or "lower-alpha", etc. */
    padding-left: 20px;
    margin: 8px 0;
}

.comment-editor ol li {
    display: list-item;
}
    .comments-container ol {
  list-style-type: decimal;
  padding-left: 20px;
  margin: 8px 0;
}
      /* Modal Button Styles */
    .button {
        background-color: #222;
        color: white;
        border: none;
        padding: 12px 18px;
        font-size: 14px;
        text-transform: uppercase;
        font-weight: bold;
        border-radius: 4px;
        transition: background 0.2s ease-in-out;
    }
    .button:hover {
        background-color: #000;
    }
    .button-alt {
        background-color: white;
        color: black;
        border: 1px solid black;
        padding: 10px 18px;
        font-size: 14px;
        font-weight: bold;
        border-radius: 4px;
        transition: background 0.2s ease-in-out;
    }
    .button-alt:hover {
        background-color: #e0e0e0;
    }
         #log-area {
    max-height: calc(100vh - 150px); /* Adjust to your preference */
    min-height: 200px; /* Ensures it never gets too small */
    padding-bottom: 20px; /* Adds breathing room for the last card */
    overflow-y: auto; /* Keeps scrolling functional */
    }
    .log-entry {
  margin-bottom: 8px;
  padding: 12px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.log-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.log-time {
  color: #666;
  font-size: 0.9em;
}

.log-type {
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.8em;
  font-weight: 500;
}
  .log-type.input-change { background: #e3f2fd; color: #1565c0; }
.log-type.click { background: #e8f5e9; color: #2e7d32; }
.log-type.page-loaded { background: #fff3e0; color: #f57c00; }

.input-details, .click-details {
  display: grid;
  gap: 4px;
}

.value.redacted {
  font-style: italic;
  color: #666;
}

.section-info {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid #eee;
}
  #reset-icon {
  pointer-events: none;
}
  /* For the Action Log container */
#log-area::-webkit-scrollbar {
  width: 8px;
  /* height: 8px;  <-- if you also have horizontal scrolling, uncomment */
}

#log-area::-webkit-scrollbar-track {
  background: #f0f0f0; /* matches your neutral grays */
  border-radius: 0;
}

#log-area::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 0;
}

#log-area::-webkit-scrollbar-thumb:hover {
  background: #999;
}
/* Error Drawer Scrollbar (similar to #log-area but no rounding) */
#error-drawer::-webkit-scrollbar {
  width: 8px;              /* same width as action log */
  background: #f0f0f0;     /* subtle neutral track background */
}

#error-drawer::-webkit-scrollbar-track {
  background: #f0f0f0;     /* ensures track blends with container */
}

#error-drawer::-webkit-scrollbar-thumb {
  background: #ccc;        /* lighter thumb so it's not too stark */
  border-radius: 0;        /* remove rounding for a squared-off thumb */
}

#error-drawer::-webkit-scrollbar-thumb:hover {
  background: #999;        /* darken on hover so it’s discoverable */
}

@keyframes pulseScale {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
    }

    .icon-pulse {
        animation: pulseScale 0.4s ease-in-out;
    }

`;
document.head.appendChild(linkStyle);

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggle-logging');
    const loadUrlButton = document.getElementById('load-url');
    let originalUrl = '';
    const logArea = document.getElementById('log-area');
    const exportLogButton = document.getElementById('export-log');
    const backButton = document.getElementById('back-button');
    const refreshButton = document.getElementById('refresh-button');
    const exportHtmlButton = document.getElementById('export-html');
    const exportHtmlLogButton = document.getElementById('export-html-log');
    const logSidebar = document.getElementById("log-sidebar");
    const toggleSidebarButton = document.getElementById("toggle-sidebar");
    const toggleSidebarIcon = document.getElementById("toggle-sidebar-icon");
    let resetLogButton = document.getElementById('reset-log');
    const errorContainer = document.getElementById("error-log");
    const errorCount = document.getElementById("error-count");

    const errorDrawer = document.getElementById("error-drawer");
    const errorIcon = document.getElementById("error-icon");
    const clearErrorsButton = document.getElementById('clear-errors');
    const exportErrorsBtn = document.getElementById("export-errors");
    console.log(window.electron);
    
    toggleBtn.addEventListener('click', () => {
        toggleLogging();
    });

    if (toggleBtn) {
        const icon = toggleBtn.querySelector('svg');
        icon.setAttribute('data-lucide', 'play');
        toggleBtn.setAttribute('title', 'Start Logging');
        lucide.createIcons();
    }

    if (toggleErrorDrawer) {
        
        if (!window.errorLog || window.errorLog.length === 0) {
            toggleErrorDrawer.style.transform = 'translateY(32px)';
            toggleErrorDrawer.classList.remove(
                "bg-red-600",
                "text-white",
                "p-2",
                "rounded"
            );
            toggleErrorDrawer.classList.add(
                "bg-white",
                "border",
                "border-gray-300",
                "rounded-full",
                "p-1",
                "text-gray-700"
            );
        }
    }
    urlInput = document.getElementById('url-input');
    webview = document.getElementById('my-webview');

    webview.addEventListener('ipc-message', (event) => {
        if (event.channel === 'webview-konami-keydown') {
            const key = event.args[0].key;
            checkKonamiCode(key);
        }
    });

    window.addEventListener('message', (event) => {
        console.log('Message received in renderer:', event.data);

        if (event.data.type === 'loadUrl') {
            // Since we have access to urlInput and webview here, this will work
            urlInput.value = event.data.url;
            webview.src = event.data.url;
            saveRecentUrl(event.data.url);
        } else if (event.data.type === 'removeUrl') {
            console.log('Processing removeUrl for:', event.data.url);

            // Get current URLs from localStorage
            const recentUrls = JSON.parse(localStorage.getItem('recentUrls') || '[]');
            console.log('Current URLs in storage:', recentUrls);

            // Filter out the URL to be removed
            const updatedUrls = recentUrls.filter(url => url !== event.data.url);
            console.log('Updated URLs after removal:', updatedUrls);

            // Save back to localStorage
            localStorage.setItem('recentUrls', JSON.stringify(updatedUrls));

            // Update the UI
            webview.executeJavaScript('updateRecentSitesList();');

            showToast('URL removed from recent sites');
        }
    });

    
    function createTracerFindBar() {
        if (document.getElementById('tracer-find-bar')) return;

        const browserPanel = document.getElementById('browser-panel');

        // Container positioned at the top-right inside the browser panel
        const findBar = document.createElement('div');
        findBar.id = 'tracer-find-bar';
        findBar.className = 'absolute top-2 right-2 bg-white border border-gray-300 shadow rounded-md px-3 py-2 flex items-center gap-2 z-50';

        // Input field for search
        const findInput = document.createElement('input');
        findInput.type = 'text';
        findInput.placeholder = 'Find on page...';
        findInput.className = 'w-48 h-8 rounded border border-gray-300 px-2 text-sm focus:ring-1 focus:ring-gray-500';

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = `<svg data-lucide="x" width="20" height="20"></svg>`;
        closeBtn.className = 'p-1 hover:bg-gray-200 rounded';

        // Attach elements
        findBar.appendChild(findInput);
        findBar.appendChild(closeBtn);

        // Ensure parent (browserPanel) is positioned relatively
        browserPanel.style.position = 'relative';
        browserPanel.appendChild(findBar);
        lucide.createIcons();

        findInput.focus();

        let currentRequestId = null;
        let debounceTimeout = null;

        // Highlight matches in real-time
        findInput.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                const text = findInput.value.trim();
                if (currentRequestId !== null) {
                    webview.stopFindInPage('clearSelection');
                }
                if (text) {
                    currentRequestId = webview.findInPage(text);
                }
            }, 150);
        });

        // Close actions
        function closeFindBar() {
            webview.stopFindInPage('clearSelection');
            findBar.remove();
        }

        closeBtn.onclick = closeFindBar;

        findInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeFindBar();
            }
        });

        // Clicking outside closes find bar
        document.addEventListener('click', (event) => {
            if (!findBar.contains(event.target)) {
                closeFindBar();
            }
        }, { once: true });

        // Indicate no matches with border highlight
        webview.addEventListener('found-in-page', (event) => {
            if (event.result.requestId === currentRequestId) {
                findInput.style.borderColor = event.result.matches > 0 ? '#d1d5db' : '#f87171';
            }
        });
    }

    // Trigger find bar from webview ipc
    webview.addEventListener('ipc-message', (event) => {
        if (event.channel === 'trigger-find') {
            createTracerFindBar();
        }
    });


    webview.addEventListener('did-start-loading', () => {
        // Clear errors on page refresh
        window.errorLog = [];
        updateErrorDrawer();

        const toggleButton = document.getElementById('toggle-error-drawer');
        if (toggleButton) {
            toggleButton.style.transform = 'translateY(32px)';
            toggleButton.classList.remove(
                'bg-red-600',
                'text-white',
                'p-2',
                'rounded'
            );
            toggleButton.classList.add(
                'bg-white',
                'border',
                'border-gray-300',
                'rounded-full',
                'p-1',
                'text-gray-700'
            );
        }

        const errorCount = document.getElementById('error-count');
        if (errorCount) {
            errorCount.textContent = '0';
            errorCount.style.display = 'none';
        }

        const errorDrawer = document.getElementById('error-drawer');
        if (errorDrawer) {
            errorDrawer.classList.add('hidden');
        }

        const isHomePage = webview.src.toLowerCase().includes('home.html');
        if (isHomePage) {
            urlInput.value = '';
            urlInput.placeholder = "Let's get tracing!";
        } else {
            urlInput.value = webview.src;
            saveRecentUrl(webview.src);
        }
    });

    webview.addEventListener('did-stop-loading', () => {
        const internalPages = ['home.html', 'docs.html', 'elements.html'];
        const isInternalPage = internalPages.some(page => webview.src.toLowerCase().includes(page));

        if (isInternalPage) {
            urlInput.value = '';
            urlInput.placeholder = "Let's get tracing!";
        }
    });

    webview.addEventListener('did-navigate', (event) => {
        const newUrl = webview.getURL();
        let previousUrl = '';
        const toggleButton = document.getElementById('toggle-error-drawer');
        const errorCount = document.getElementById('error-count');
        const excludedPages = ['home.html', 'about:blank', 'elements.html', 'docs.html'];
        const errorDrawer = document.getElementById('error-drawer');
        const shouldExclude = excludedPages.some(page =>
            page === 'about:blank' ? newUrl === page : newUrl.includes(page)
        );
        if (!shouldExclude) {
            saveRecentUrl(newUrl);
        }
        document.getElementById('url-input').value = newUrl;      
        window.errorLog = [];
        updateErrorDrawer();        
        if (toggleButton) {
            toggleButton.style.transform = 'translateY(32px)';
            toggleButton.classList.remove(
                'bg-red-600',
                'text-white',
                'p-2',
                'rounded'
            );
            toggleButton.classList.add(
                'bg-white',
                'border',
                'border-gray-300',
                'rounded-full',
                'p-1',
                'text-gray-700'
            );
        }
        if (errorCount) {
            errorCount.textContent = '0';
            errorCount.style.display = 'none';
        }        
        if (errorDrawer) {
            errorDrawer.classList.add('hidden');
        }
        previousUrl = newUrl;
    });

    webview.addEventListener('ipc-message', (event) => {
        if (event.channel === 'remove-url') {
            const urlToRemove = event.args[0];
            const recentUrls = JSON.parse(localStorage.getItem('recentUrls') || '[]');
            const updatedUrls = recentUrls.filter(url => url !== urlToRemove);

            localStorage.setItem('recentUrls', JSON.stringify(updatedUrls));
            webview.executeJavaScript(`
                window.parent.postMessage({ type: 'updateList' }, '*');
                
                if (typeof updateRecentSitesList === 'function') {
                    console.log('Calling updateRecentSitesList directly');
                    updateRecentSitesList();
                } else {
                    console.error('updateRecentSitesList function not found');
                }
            `);
            showToast('URL removed from recent sites');
        }
    });

    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'updateList') {
            console.log('Received updateList message');
            if (webview.src.includes('home.html')) {
                webview.executeJavaScript(`
                console.log('Refreshing recent sites list');
                if (typeof updateRecentSitesList === 'function') {
                    updateRecentSitesList();
                } else {
                    console.error('updateRecentSitesList function not found');
                }
            `);
            }
        }
    });
    
    function openKeyboardShortcutsModal() {
        const modal = document.getElementById('keyboard-shortcuts-modal');
        const container = document.getElementById('modal-container');
        const allModals = container.querySelectorAll('div[id$="-modal"]');
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.classList.add('hidden');
                container.classList.add('hidden');
                container.classList.remove('flex');
                document.removeEventListener('keydown', handleEscape);
            }
        };
        showModal('keyboard-shortcuts-modal');

        if (!modal || !container) {
            console.error("Modal elements not found");
            return;
        }        
        allModals.forEach(m => {
            m.classList.add('hidden');
            m.classList.remove('flex');
        });
        container.classList.remove('hidden');
        container.classList.add('flex');
        modal.classList.remove('hidden');        
        document.addEventListener('keydown', handleEscape);
    }

    webview.addEventListener('ipc-message', (event) => {        
        if (event.channel === 'shortcut-triggered' && event.args[0] === 'F1') {
            openKeyboardShortcutsModal();
        }
        if (event.channel === 'shortcut-triggered' && event.args[0] === 'Escape') {
            const keyboardShortcutsModal = document.getElementById('keyboard-shortcuts-modal');
            if (!keyboardShortcutsModal.classList.contains('hidden')) {
                hideKeyboardShortcutsModal();
            }
        }
    });

    urlInput.addEventListener('focus', () => {
        originalUrl = urlInput.value;
        const isHomePage = webview.src.toLowerCase().includes('home.html');
        setTimeout(() => {
            if (isHomePage) {                
                urlInput.value = 'https://';
                urlInput.setSelectionRange(0, urlInput.value.length);
            } else {                
                urlInput.setSelectionRange(0, urlInput.value.length);
            }
        }, 0);
    });

    urlInput.addEventListener('blur', () => {        
        if (urlInput.value.trim() === '' || urlInput.value.trim() === 'https://') {
            urlInput.value = originalUrl;
        }
    });
    
    urlInput.addEventListener('blur', () => {        
        const isHomePage = webview.src.toLowerCase().includes('home.html');

        if (isHomePage && (urlInput.value.trim() === 'https://' || urlInput.value.trim() === '')) {
            urlInput.value = '';
            urlInput.placeholder = "Let's get tracing!";
        } else if (!isHomePage && urlInput.value.trim() === '') {
            urlInput.value = originalUrl;
        }
    });

    lucide.createIcons();
   
    webview.addEventListener('console-message', (e) => {
        console.log('Guest page logged a message:', e.message, 'level:', e.level);

        // Explicitly exclude CSP and "[Report Only]" errors
        if (e.level === 3 && !e.message.includes('Content Security Policy') && !e.message.includes('[Report Only]')) {
            addErrorToLog({
                timestamp: new Date().toISOString(),
                message: e.message,
                source: 'Webview Error',
                type: 'error'
            });
        }
    });


    // THIS IS WHAT ADDS THE ACTUAL ERROR TO THE ERROR DRAWER
    function addErrorToLog(errorData) {
        const errorContainer = document.getElementById('error-log');
        const toggleButton = document.getElementById('toggle-error-drawer');
        const errorCount = document.getElementById("error-count");
        const errorEntry = document.createElement('div');
        

        if (!errorContainer || !toggleButton) {
            console.error('[renderer.js] Required elements not found.');
            return;
        }

        if (!errorData.type.toLowerCase().includes('error')) {
            return;
        }
        
        if (!window.errorLog || window.errorLog.length === 0) {
            toggleButton.style.transform = 'translateY(0)';
        }
        console.log("Error Data Received:", errorData);  // Debugging step

        errorEntry.classList.add('error-entry', 'p-2', 'border-b', 'border-gray-300');

        errorEntry.innerHTML = `
            <div class="flex justify-between w-full">
                <div class="w-full">
                <div class="flex justify-between items-start">
                    <strong class="text-red-500 block">Error: ${errorData.type}</strong>
                    <button class="copy-error-btn text-gray-500 hover:text-gray-800 p-1 rounded ml-2" title="Copy error">
                        <svg data-lucide="clipboard" width="16" height="16"></svg>
                    </button>
                </div>
                <span class="error-message block">${errorData.message}</span>
                <small class="block mt-1">Source: ${errorData.source || 'Unknown'} - ${errorData.timestamp}</small>
                <small class="block">Line: ${errorData.lineno || 'N/A'}, Column: ${errorData.colno || 'N/A'}</small>
                <small class="block">
                    ${errorData.stack || 'No stack trace available'}
                </small>
            </div>
            </div>
        `;
        const copyButton = errorEntry.querySelector('.copy-error-btn');
        copyButton.addEventListener('click', () => {
            const toast = document.createElement('div');
            const originalTitle = copyButton.title;
            const textToCopy = `Time: ${errorData.timestamp}
            Type: ${errorData.type}
            Message: ${errorData.message}
            Source: ${errorData.source || "unknown"}
            Location: [${errorData.lineno}:${errorData.colno}]
            Stack Trace:
            ${errorData.stack}`.trim();

            window.electron.clipboard.writeText(textToCopy);
            
            toast.className = 'fixed bottom-4 left-4 bg-cyan-600 text-white px-4 py-2 rounded shadow-lg text-sm z-50';
            toast.textContent = 'Copied to clipboard!';
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.remove();
            }, 2000);

            copyButton.innerHTML = '<svg data-lucide="check" width="16" height="16"></svg>';
            lucide.createIcons(copyButton);

            setTimeout(() => {
                copyButton.innerHTML = '<svg data-lucide="clipboard" width="16" height="16"></svg>';
                lucide.createIcons(copyButton); 
            }, 1500);

            copyButton.title = 'Copied!';
            setTimeout(() => {
                copyButton.title = originalTitle;
            }, 1500);
            lucide.createIcons(copyButton);
        });

        if (!window.errorLog) {
            window.errorLog = [];
        }
        window.errorLog.push(errorData);
        
        if (errorCount) {
            const count = window.errorLog.length;
            errorCount.textContent = count;
            errorCount.style.display = count > 0 ? "block" : "none";

            if (toggleButton) {
                if (count > 0) {
                    toggleButton.style.transform = 'translateY(0)';
                    toggleButton.classList.remove(
                        'bg-white',
                        'border',
                        'border-gray-300',
                        'rounded-full',
                        'p-1',
                        'text-gray-700'
                    );
                    toggleButton.classList.add(
                        'bg-red-600',
                        'text-white',
                        'rounded',
                        'px-2',
                        'py-1'
                    );
                    errorCount.style.display = 'inline-block';
                } else {
                    toggleButton.style.transform = 'translateY(32px)';
                    toggleButton.classList.remove(
                        'bg-red-600',
                        'text-white',
                        'rounded',
                        'px-2',
                        'py-1'
                    );
                    toggleButton.classList.add(
                        'bg-white',
                        'border',
                        'border-gray-300',
                        'rounded-full',
                        'p-1',
                        'text-gray-700'
                    );
                    errorCount.style.display = 'none';
                    errorCount.textContent = 0;
                }
            }
        }
        errorContainer.appendChild(errorEntry);
    }

    webview.addEventListener('dom-ready', () => {
        webview.insertCSS(`
            ::-webkit-scrollbar {
                width: 8px;
                background-color: transparent;
            }
            ::-webkit-scrollbar-thumb {
                background-color: rgba(0,0,0,0.2);
                border-radius: 0;
            }
            ::-webkit-scrollbar-thumb:hover {
                background-color: rgba(0,0,0,0.3);
            }
            ::-webkit-scrollbar-track {
                background-color: transparent;
            }
            ::-webkit-scrollbar-corner {
                background-color: transparent;
            }
        `);
    });

    webview.addEventListener('crashed', (e) => {
        window.electron.ipcRenderer.send('webview-error', {
            type: 'Console Error',
            timestamp: new Date().toISOString(),
            message: 'Webview crashed',
            source: 'webview',
            lineno: 0,
            colno: 0,
            stack: 'Webview crash'
        });
    });

    toggleErrorDrawer.addEventListener("click", () => {
        errorDrawer.classList.toggle("hidden");
        // Switch the icon
        if (errorDrawer.classList.contains("hidden")) {
            errorIcon.setAttribute("data-lucide", "panel-bottom-open");
        } else {
            errorIcon.setAttribute("data-lucide", "panel-bottom-close");
        }
        lucide.createIcons();
    });

    
    if (exportErrorsBtn) {
        exportErrorsBtn.addEventListener("click", exportErrors);
    }

    if (clearErrorsButton) {
        clearErrorsButton.addEventListener('click', () => {
            showModal('confirm-clear-errors-modal', {
                onConfirm: () => {
                    const toggleButton = document.getElementById('toggle-error-drawer');
                    const errorCount = document.getElementById('error-count');
                    window.errorLog = [];
                    updateErrorDrawer();
                    showToast('Errors Cleared!');
                    errorDrawer.classList.add('hidden');
                    errorIcon.setAttribute("data-lucide", "panel-bottom-open");
                    lucide.createIcons();

                    // Reset the toggle button appearance and position
                    toggleButton.style.transform = 'translateY(32px)';
                    toggleButton.classList.remove(
                        'bg-red-600',
                        'text-white',
                        'rounded',
                        'px-2',
                        'py-1'
                    );
                    toggleButton.classList.add(
                        'bg-white',
                        'border',
                        'border-gray-300',
                        'rounded-full',
                        'p-1',
                        'text-gray-700'
                    );

                    // Hide the error count
                    errorCount.style.display = 'none';
                    errorCount.textContent = '0';
                }
            });
        });
    }

    if (resetLogButton) {
        resetLogButton.addEventListener("click", () => {
            showModal('reset-log-modal', {
                onConfirm: () => {
                    window.electron.ipcRenderer.send("reset-log");
                }
            });
        });
    }

    function saveRecentUrl(url) {
        if (!url || url.includes('home.html')) return;
        const recentUrls = JSON.parse(localStorage.getItem('recentUrls') || '[]');
        const filteredUrls = recentUrls.filter(savedUrl => savedUrl !== url);
        filteredUrls.unshift(url);
        const updatedUrls = filteredUrls.slice(0, 5); 

        localStorage.setItem('recentUrls', JSON.stringify(updatedUrls));

        if (webview.src.includes('home.html')) {
            webview.executeJavaScript('updateRecentSitesList()');
        }
    }

    function updateRecentSitesList() {
        if (webview.src.includes('home.html')) {
            webview.executeJavaScript(`
            (function() {
                const recentSitesContainer = document.querySelector('.recent-sites-list');
                if (!recentSitesContainer) {
                    console.error('Recent sites container not found in webview!');
                    return;
                }

                const recentUrls = ${JSON.stringify(localStorage.getItem('recentUrls') || '[]')};
                
                if (recentUrls.length === 0) {
                    recentSitesContainer.innerHTML = \`
                        <div class="text-sm text-gray-600 italic">
                            Your recently visited sites will appear here
                        </div>
                        <div class="mt-4 text-center">
                            <button data-action="focus-url" class="px-4 py-2 text-[#FF8A65] hover:bg-[#FFF3E0] rounded-lg transition-colors">
                                Enter a URL to begin testing
                            </button>
                        </div>
                    \`;
                    return;
                }

                recentSitesContainer.innerHTML = recentUrls.map(url => \`
                    <div class="recent-site-item group p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div class="flex items-center justify-between">
                            <button class="load-url-btn flex-1 text-left text-gray-900 hover:text-[#FF8A65] truncate" 
                                title="\${url}" data-url="\${url}">
                                \${url}
                            </button>
                            <button class="remove-url-btn opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 
                                hover:text-red-500 transition-opacity" data-url="\${url}" title="Remove from recent sites">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
                                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" 
                                    stroke-linejoin="round">
                                    <path d="M18 6L6 18"></path>
                                    <path d="M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                \`).join('');

                // Re-attach event listeners
                document.querySelectorAll('.load-url-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const url = btn.dataset.url;
                        window.parent.postMessage({ type: 'loadUrl', url }, '*');
                    });
                });

                document.querySelectorAll('.remove-url-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const urlToRemove = btn.dataset.url;
                        window.parent.postMessage({ type: 'removeUrl', url: urlToRemove }, '*');
                    });
                });
            })();
        `);
        }
    }

    loadUrlButton.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (url) {
            webview.src = url;
            saveRecentUrl(url);
        }
    });

    urlInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const url = urlInput.value.trim();
            if (url) {
                webview.src = url;
                saveRecentUrl(url);
            }
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM Content Loaded');
        updateRecentSitesList();
        console.log('Recent sites list updated');

        document.querySelectorAll('[data-action="focus-url"]').forEach(btn => {
            btn.addEventListener('click', () => {
                window.parent.document.getElementById('url-input')?.focus();
            });
        });

    });

    urlInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const url = urlInput.value.trim();
            if (url) {
                webview.src = url;
            }
        }
    });

    // Listen for events from the webview
    webview.addEventListener('ipc-message', (event) => {
        if (event.channel === 'webview-error') {
            window.electron.ipcRenderer.send('webview-error', event.args[0]);
        } if (event.channel === 'log-event') {
            const logData = event.args[0];
            console.log('Log event data:', logData);

            // Check for screenshot trigger from webview
            if (logData.isScreenshotTrigger) {
                console.log('Screenshot trigger received from webview');

                // Create a proper screenshot event instead of using the keydown event
                activeScreenshotEvent = {
                    action: 'screenshot',
                    timestamp: new Date().toISOString(),
                    details: logData.details || {}
                };

                // Add to event log array
                eventLog.push(activeScreenshotEvent);

                // Now take the screenshot
                window.electron.ipcRenderer.send('take-screenshot');
                return;  // Return to prevent normal event processing
            }

            // Always allow screenshots, regardless of logging state
            if (logData.screenshot || logData.elementCapture) {
                console.log('Processing screenshot/element capture event');
                eventLog.push(logData);
                updateLogUI(logData);
                return;
            }
            if (logData.action === 'toggle-logging') {
                console.log('Toggle logging action received from webview');
                toggleLogging();
                return;
            }

            // For non-screenshot events, respect the logging state
            if (!loggingEnabled) {
                console.log('Logging disabled, event ignored');
                return;
            }

            eventLog.push(logData);
            updateLogUI(logData);
        } else if (event.channel === 'webview-mousemove') {
            // event.args[0] is {x, y} in the webview’s local coordinate system
            const { x, y } = event.args[0];

            // Convert to parent's coordinate system by adding webview's bounding rect
            const rect = webview.getBoundingClientRect();
            const parentX = rect.left + x;
            const parentY = rect.top + y;

            // Now move the pupil
            updateEyePosition(parentX, parentY);
        }
    });

    // Back and Refresh button handlers
    backButton.addEventListener('click', () => {
        if (webview.canGoBack()) {
            webview.goBack();
        }
    });

    refreshButton.addEventListener('click', () => {
        webview.reload();
    });

    // Listen for errors sent from webview
    const ipcRenderer = window.electron.ipcRenderer;

    ipcRenderer.on('navigate-url', (event, url) => {
        urlInput.value = url;
        webview.src = url;
        saveRecentUrl(url);
    });

    ipcRenderer.on('update-error', (_, errorData) => {
  
            console.log('🔥 [DEBUG] Error received in renderer:', errorData);
            console.log('[🔥DEBUG] Message:', errorData.message);
            console.log('[🔥DEBUG] Source:', errorData.source);
            console.log('[🔥DEBUG] Stack:', errorData.stack);



        const ignoredPatterns = [
            'GUEST_VIEW_MANAGER_CALL',
            'ERR_ABORTED (-3)',
            'console.log',          // Add this to ignore console.log messages
            'console.warn',         // Add this to ignore console.warn messages
            'console.info'          // Add this to ignore console.info messages
        ];

        if (ignoredPatterns.some(pattern => errorData.message.includes(pattern))) {
            console.log('[renderer.js] Filtered out error:', errorData.message);
            return;
        }

        errorData.timestamp = errorData.timestamp || new Date().toISOString();
        errorData.type = errorData.type || "Console Error";

        logError(
            "Webview Error",           // type
            errorData.message,         // message
            errorData.source,          // source
            errorData.lineno,          // lineno
            errorData.colno,           // colno
            { stack: errorData.stack } // error object
        );

        updateErrorDrawer(); // Ensures the UI updates instantly
    });

    window.electron.ipcRenderer.on('screenshot-taken', (ipcEvent, base64Data) => {
        // If no active screenshot event, create one now
        if (!activeScreenshotEvent) {
            activeScreenshotEvent = {
                action: 'screenshot',
                timestamp: new Date().toISOString(),
                details: {} // Basic empty details
            };

            // Add to event log array
            eventLog.push(activeScreenshotEvent);

            // Since this is a new event, we need to add it to the UI first
            updateLogUI(activeScreenshotEvent);
        }

        // Attach the screenshot data to the active event object
        activeScreenshotEvent.screenshot = base64Data;
        const isElementCapture = activeScreenshotEvent.isElementCapture;

        // Find the log entry element for this event
        const logArea = document.getElementById('log-area');
        if (!logArea) {
            console.error("Could not find log area!");
            return;
        }

        const logEntries = logArea.children;
        let targetEntry = null;

        // Find the matching log entry
        for (let entry of logEntries) {
            if (entry.dataset.timestamp === activeScreenshotEvent.timestamp) {
                targetEntry = entry;
                break;
            }
        }

        if (!targetEntry) {
            console.error("Could not find matching log entry - creating one now!");
            // Create the entry in the UI if it doesn't exist yet
            targetEntry = document.createElement('div');
            targetEntry.className = "p-3 rounded bg-gray-100 relative flex flex-col";
            targetEntry.dataset.timestamp = activeScreenshotEvent.timestamp;

            // Add a basic header
            targetEntry.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] text-gray-500 border border-gray-200 rounded px-1 py-0.5">#${eventLog.length}</span>
                        <span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">
                            SCREENSHOT
                        </span>
                    </div>
                </div>
            </div>
            <div class="flex justify-end mt-4 pt-2 border-t border-gray-200">
                <span class="text-gray-400 text-[11px]">${formatTimestamp(activeScreenshotEvent.timestamp)}</span>
            </div>
        `;

            logArea.appendChild(targetEntry);
        }

        const screenshotRow = document.createElement('div');
        screenshotRow.className = "grid grid-cols-[120px,1fr] gap-2 w-full screenshot-row";
        screenshotRow.innerHTML = `
        <span class="font-medium">
            ${isElementCapture ? 'Element Capture:' : (activeScreenshotEvent.fullPage ? 'FullScreenshot:' : 'Screenshot:')}
        </span>
        <div class="flex items-center justify-between w-full">
            <button
                class="text-blue-600 hover:text-blue-800 underline flex items-center"
                title="${isElementCapture
                ? 'Element capture - full size'
                : (activeScreenshotEvent.fullPage
                    ? 'Full-page screenshot - full size'
                    : 'Screenshot - full size')}"
            >
                <svg
                    data-lucide="${isElementCapture
                ? 'scan'
                : (activeScreenshotEvent.fullPage ? 'camera' : 'image')}"
                    width="16"
                    height="16"
                    class="mr-2"
                ></svg>
                <span>
                    ${isElementCapture
                ? 'Capture...png'
                : (activeScreenshotEvent.fullPage
                    ? 'FullScreenshot...png'
                    : 'Screenshot...png')}
                </span>
            </button>
            <button
                class="delete-screenshot-btn text-gray-500 hover:text-red-500 transition-colors"
                title="Delete ${isElementCapture
                ? 'capture'
                : (activeScreenshotEvent.fullPage
                    ? 'full-page screenshot'
                    : 'screenshot')
            }"
            >
                <svg data-lucide="trash" width="16" height="16"></svg>
            </button>
        </div>
    `;

        const screenshotBtn = screenshotRow.querySelector('button.text-blue-600');
        screenshotBtn.dataset.timestamp = activeScreenshotEvent.timestamp;
        screenshotBtn.addEventListener('click', () => {
            const ts = screenshotBtn.dataset.timestamp;
            const eventObj = eventLog.find(e => e.timestamp === ts);
            if (eventObj && eventObj.screenshot) {
                showModalImage('data:image/png;base64,' + eventObj.screenshot, ts);
            } else {
                showToast('Annotated screenshot not available.');
            }
        });

        const deleteBtn = screenshotRow.querySelector('.delete-screenshot-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const isElementCapture = screenshotRow.querySelector('button.text-blue-600').title.includes('Element capture');
                showModal('delete-screenshot-modal', {
                    message: isElementCapture ? 'Are you sure you want to delete this element capture?' : 'Are you sure you want to delete this screenshot?',
                    title: isElementCapture ? 'Delete Element Capture?' : 'Delete Screenshot?',
                    onConfirm: () => {
                        if (activeScreenshotEvent) {
                            delete activeScreenshotEvent.screenshot;
                        }
                        screenshotRow.remove();
                        showToast(isElementCapture ? 'Element capture deleted!' : 'Screenshot deleted!');
                    }
                });
            });
        }

        // Find or create details grid
        let detailsGrid = targetEntry.querySelector('.details-grid');

        // If no details grid exists, create one
        if (!detailsGrid) {
            detailsGrid = document.createElement('div');
            detailsGrid.className = 'details-grid mt-2';

            // Find content container to insert details grid
            const contentContainer = targetEntry.querySelector('.flex-1');
            if (contentContainer) {
                contentContainer.appendChild(detailsGrid);
            } else {
                // If no content container, create one
                const newContentContainer = document.createElement('div');
                newContentContainer.className = 'flex-1';
                newContentContainer.appendChild(detailsGrid);
                targetEntry.insertBefore(newContentContainer, targetEntry.firstChild);
            }
        }

        // Remove any existing screenshot row
        const existingRow = targetEntry.querySelector('.screenshot-row');
        if (existingRow) {
            existingRow.remove();
        }

        // Add the new screenshot row to the details grid
        detailsGrid.appendChild(screenshotRow);

        // Create success toast
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 left-4 bg-cyan-600 text-white px-4 py-2 rounded shadow-lg text-sm z-50';
        toast.textContent = activeScreenshotEvent.isElementCapture ? 'Element capture!' : 'Screenshot captured!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);

        // Reinitialize Lucide icons
        lucide.createIcons(screenshotRow);

        // Set up comment features for the new entry if it was just created
        if (targetEntry.querySelector('.comment-area') === null) {
            setupCommentFeature(targetEntry, activeScreenshotEvent);
        }

        // Clear the active screenshot event
        activeScreenshotEvent = null;
    });

    // Creates a new log entry in the UI based on event data
    function updateLogUI(logData) {
        if (!loggingEnabled) return;
        // Create the overall card as a flex container (vertical stacking)
        const entry = document.createElement('div');
        entry.className = "p-3 rounded bg-gray-100 relative flex flex-col";
        entry.style.minHeight = "auto"; // Ensures height grows dynamically
        entry.style.height = "auto";    // Explicitly removes any fixed height
        entry.dataset.timestamp = logData.timestamp;

        // Format the timestamp
        const timeStr = formatTimestamp(logData.timestamp);

        // We'll store your final HTML in this string, just like you did
        let html = "";
        let output = "";

        // Determine event number (#1, #2, etc.)
        const eventIndex = eventLog.findIndex(e => e.timestamp === logData.timestamp);
        const eventNumber = eventIndex >= 0 ? eventIndex + 1 : eventLog.length;

        // Pick a color class for the action pill
        const badgeClasses = {
            'page-loaded': 'bg-blue-100 text-blue-700',
            'click': 'bg-green-100 text-green-700',
            'input-change': 'bg-yellow-100 text-yellow-700'
        };
        const badgeClass = badgeClasses[logData.action] || 'bg-gray-100 text-gray-700';

        // ---------------------------------------------------------------------
        // 1) TOP BAR: # + pill on the left, icon slot on the right
        // ---------------------------------------------------------------------
        // We do NOT add any icons here ourselves; we just create an empty slot
        // so that `setupCommentFeature` or other code can place them if desired.
        // If you don't need it, you can remove that <div id="icon-slot"></div>.
        const topBar = document.createElement('div');
        topBar.className = "flex items-center justify-between"; // left + right

        // Left side => # + pill
        const leftSideHTML = `
        <div class="flex items-center gap-2">
            <span class="text-[10px] text-gray-500 border border-gray-200 rounded px-1 py-0.5">
                #${eventNumber}
            </span>
            <span class="${badgeClass} px-2 py-0.5 rounded text-xs font-semibold">
                ${logData.action.toUpperCase()}
            </span>
        </div>
    `;
        // Right side => empty icon slot (if you want to place buttons there)
        // For now, it's just an empty <div>.
        const rightSideHTML = `
        <div class="flex items-center gap-2" id="icon-slot">
            <!-- If setupCommentFeature wants to place icons, they can go here -->
        </div>
    `;

        topBar.innerHTML = leftSideHTML + rightSideHTML;

        // ---------------------------------------------------------------------
        // 2) BUILD THE MAIN CONTENT (everything except footer/screenshot)
        // ---------------------------------------------------------------------
        // This is basically your same big block of HTML that handles the
        // branching for each action. We’ll wrap it in <div> so we can place
        // topBar above it.

        // --- Branches for Different Actions ---
        if (logData.action === 'page-loaded' && logData.title && logData.url) {
            html += `
                <div class="grid grid-cols-[120px,1fr] gap-2 break-words mt-2">
                    <span class="font-medium">Page Title:</span>
                    <span class="break-words text-left" title="${logData.title}">
                        ${logData.title}
                    </span>
                    <span class="font-medium">URL:</span>
                    <div class="flex items-center gap-2">
                        <a href="${logData.url}" class="text-blue-600 hover:text-blue-800 underline break-words text-left" title="${logData.url}">
                        ${logData.url.length > 25 ? logData.url.substring(0, 25) + "..." : logData.url}
                        </a>
                        <button class="copy-url-btn ml-auto p-1 hover:bg-gray-100 rounded" title="Copy URL to clipboard" data-url="${logData.url}">
                        <svg data-lucide="clipboard" width="14" height="14"></svg>
                        </button>
                    </div>
                </div>
            `;
        } else if (logData.action === 'select') {
            html += `<div class="grid grid-cols-[120px,1fr] gap-2 break-words">
            <span class="font-medium">Element:</span>
            <span class="break-words text-left">&lt;SELECT&gt;</span>
            <span class="font-medium">Selected Value:</span>
            <span class="break-words text-left">${logData.selectedValue || '[None]'}</span>
            <span class="font-medium">Selected Text:</span>
            <span class="break-words text-left">${logData.selectedText || '[None]'}</span>
        </div>`;
        } else if (logData.action === 'click') {
            const details = logData.details;

            html += `<div class="grid grid-cols-[120px,1fr] gap-2 break-words">
                <span class="font-medium">Element:</span>
                <span class="break-words text-left">&lt;${(details.tagName || '').toUpperCase()}&gt;</span>`;

   
            if (details.text) {
                html += `
                <span class="font-medium">Text Content:</span>
                <span class="break-words text-left break-words whitespace-normal overflow-x-hidden" >"${details.text}"</span>`;
            }
            if (details.fontInfo) {
                html += `
            <span class="font-medium">Font Family:</span>
            <span class="break-words whitespace-normal overflow-x-hidden text-left">${details.fontInfo.fontFamily}</span>
            <span class="font-medium">Font Size:</span>
            <span class="break-words text-left">${details.fontInfo.fontSize}</span>
            <span class="font-medium">Font Weight:</span>
            <span class="break-words text-left">${details.fontInfo.fontWeight}</span>
            <span class="font-medium">Font Style:</span>
            <span class="break-words text-left">${details.fontInfo.fontStyle}</span>
            <span class="font-medium">Line Height:</span>
            <span class="break-words text-left">${details.fontInfo.lineHeight}</span>
            <span class="font-medium">Color:</span>
            <div class="flex items-center justify-between">
            <span class="break-words text-left">${details.fontInfo.color}</span>
            <div class="color-swatch relative ml-2" data-color="${details.fontInfo.color}" title="Click to see color formats">
                <div class="w-5 h-5 border border-gray-300 cursor-pointer" style="background-color:${details.fontInfo.color};"></div>
            </div>
            </div>`;
            }  
            if (details.role) {
                html += `
                <span class="font-medium">Role:</span>
                <span class="break-words text-left">${details.role}</span>`;
            }

            const interactiveTags = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'];
            if (interactiveTags.includes((details.tagName || '').toUpperCase()) || (details.role && details.role.toLowerCase().includes('button'))) {                
                if (details.disabled) {
                    html += `
                    <span class="font-medium">Disabled:</span>
                    <span class="break-words text-left">Yes</span>`;
                }
                if (details.required) {
                    html += `
                <span class="font-medium">Required:</span>
                <span class="break-words text-left">Yes</span>`;
                }
            }
            if ((details.tagName || '').toUpperCase() === 'BUTTON') {
                // Button type
                html += `
                <span class="font-medium">Button Type:</span>
                <span class="break-words text-left">${details.type || 'button'}</span>`;

                // If it has an icon
                if (details.hasIcon && details.iconType) {
                    html += `
                    <span class="font-medium">Icon:</span>
                    <span class="break-words text-left">${details.iconType}</span>`;
                        }

                if (details.form) {
                    html += `
                    <span class="font-medium">Form:</span>
                    <span class="break-words text-left">${details.form}</span>`;
                }
            } else if ((details.tagName || '').toUpperCase() === 'A' || (details.role && details.role.toLowerCase() === 'button')) {                
                function truncateUrl(url, maxLength = 25) {
                    if (!url) return '';
                    return url.length > maxLength ? url.slice(0, maxLength) + '…' : url;
                }
                if (details.href) {
                    const truncatedHref = truncateUrl(details.href, 25);
                    html += `
                    <span class="font-medium">Href:</span>
                    <div class="flex items-center justify-between w-full">
                        <a href="${details.href}" 
                        class="text-blue-600 hover:text-blue-800 underline truncate flex-1 min-w-0" 
                        target="_blank"
                        title="${details.href}">
                            ${details.href}
                        </a>
                        <button class="copy-url-btn p-1 hover:bg-gray-100 rounded flex-shrink-0 ml-2" 
                            title="Copy URL to clipboard" 
                            data-url="${details.href}">
                            <svg data-lucide="clipboard" width="14" height="14"></svg>
                        </button>
                    </div>
                    `;
                }

                if (details.target) {
                    html += `
                    <span class="font-medium">Target:</span>
                    <span class="break-words text-left">${details.target}</span>`;
                }
        }

            // If it's an <img>, show alt text, dimensions, caption, etc.
            if ((details.tagName || '').toUpperCase() === 'IMG') {
                html += `
                    <span class="font-medium">Alt Text:</span>
                    <span class="break-words text-left">${details.alt || '[No Alt]'}</span>
                    <span class="font-medium">Dimensions:</span>
                    <span class="break-words text-left">${details.width}×${details.height}px</span>`;

                                if (details.caption) {
                                    html += `
                        <span class="font-medium">Caption:</span>
                        <span class="break-words text-left">${details.caption}</span>`;
                                }

                                if (details.src) {
                                    const truncatedSrc = details.src.length > 25 ? details.src.substring(0, 25) + '...' : details.src;
                                    html += `
                        <span class="font-medium">Image Source:</span>
                        <div class="flex items-center gap-2 break-words">
                            <a href="${details.src}" 
                            class="text-blue-600 hover:text-blue-800 underline"
                            target="_blank"
                            title="${details.src}">
                                ${truncatedSrc}
                            </a>
                            <button class="copy-url-btn ml-auto p-1 hover:bg-gray-100 rounded" title="Copy URL to clipboard" data-url="${details.src}">
                                <svg data-lucide="clipboard" width="14" height="14"></svg>
                            </button>
                        </div>
                    `;
                }
            }

            // If it's an <svg>, show its title, desc, dimensions, etc.
            else if ((details.tagName || '').toUpperCase() === 'SVG') {
                // Title/desc if present:
                if (details.svgTitle) {
                    html += `
            <span class="font-medium">SVG Title:</span>
            <span class="break-words text-left">"${details.svgTitle}"</span>`;
                }
                if (details.svgDesc) {
                    html += `
            <span class="font-medium">SVG Description:</span>
            <span class="break-words text-left">"${details.svgDesc}"</span>`;
                }
                // Show w/h/viewBox
                if (details.svgWidth) {
                    html += `
            <span class="font-medium">Width:</span>
            <span class="break-words text-left">${details.svgWidth}</span>`;
                }
                if (details.svgHeight) {
                    html += `
            <span class="font-medium">Height:</span>
            <span class="break-words text-left">${details.svgHeight}</span>`;
                }
                if (details.svgViewBox) {
                    html += `
            <span class="font-medium">ViewBox:</span>
            <span class="break-words text-left">${details.svgViewBox}</span>`;
                }
                // The actual <svg> snippet
                if (details.svgOuterHTML) {
                    html += `
        <div class="mt-2 col-span-2">
            <div class="bg-gray-50 rounded p-2 border">
                <div class="text-sm font-semibold mb-1">Inline Preview</div>
                <!-- The entire <svg> markup goes here -->
                <div class="svg-inline-preview" style="width:60px; height:auto; overflow:hidden;">
                    ${details.svgOuterHTML}
                </div>
            </div>
        </div>
        `;
                }
            }

            else if (details.tagName === 'METER') {
                html += `
                <span class="font-medium">Meter Properties:</span>
                <span class="break-words text-left">
                    Value: ${details.value || '0'} (${details.max ? Math.round((details.value / details.max) * 100) : 0}%), 
                    Min: ${details.min || '0'}, 
                    Max: ${details.max || '100'}
                    ${details.low ? `, Low: ${details.low}` : ''}
                    ${details.high ? `, High: ${details.high}` : ''}
                    ${details.optimum ? `, Optimum: ${details.optimum}` : ''}
                </span>`;
            }

            else if (details.tagName === 'PROGRESS') {
                html += `
                <span class="font-medium">Progress Properties:</span>
                <span class="break-words text-left">
                    Value: ${details.value || '0'}, 
                    Max: ${details.max || '100'}, 
                    Completion: ${details.max ? Math.round((details.value / details.max) * 100) : 0}%
                </span>`;
            }

            // If the clicked element is a <div> or something else that has role="progressbar", show relevant info
            if (details.role && details.role.toLowerCase() === 'progressbar') {
                html += `
                <span class="font-medium">Progress Min:</span>
                <span class="break-words text-left">${details.ariaValueMin || '0'}</span>
                <span class="font-medium">Progress Max:</span>
                <span class="break-words text-left">${details.ariaValueMax || '100'}</span>
                <span class="font-medium">Current Value:</span>
                <span class="break-words text-left">${details.ariaValueNow || '0'}</span>`;
            }

            // If the element is a VIDEO or AUDIO (some people click on them), show the media info
            if ((details.tagName || '').toUpperCase() === 'VIDEO') {
                html += `
                <span class="font-medium">Video Source:</span>
                <span class="break-words text-left">${details.src || '[No source]'}</span>
                <span class="font-medium">Controls:</span>
                <span class="break-words text-left">${details.controls ? 'Yes' : 'No'}</span>
                <span class="font-medium">Current Time:</span>
                <span class="break-words text-left">${details.currentTime || '0.00'}s</span>
                <span class="font-medium">Duration:</span>
                <span class="break-words text-left">${details.duration || 'N/A'}</span>
                <span class="font-medium">Paused:</span>
                <span class="break-words text-left">${details.paused ? 'Yes' : 'No'}</span>
                <span class="font-medium">Volume:</span>
                <span class="break-words text-left">${details.volume}</span>`;
            }
            else if ((details.tagName || '').toUpperCase() === 'AUDIO') {
                html += `
                <span class="font-medium">Audio Source:</span>
                <span class="break-words text-left">${details.src || '[No source]'}</span>
                <span class="font-medium">Controls:</span>
                <span class="break-words text-left">${details.controls ? 'Yes' : 'No'}</span>
                <span class="font-medium">Current Time:</span>
                <span class="break-words text-left">${details.currentTime || '0.00'}s</span>
                <span class="font-medium">Duration:</span>
                <span class="break-words text-left">${details.duration || 'N/A'}</span>
                <span class="font-medium">Paused:</span>
                <span class="break-words text-left">${details.paused ? 'Yes' : 'No'}</span>
                <span class="font-medium">Volume:</span>
                <span class="break-words text-left">${details.volume}</span>`;
            }

            // If there's an ariaLabel, show it (especially helpful for "role=button" or "role=link" stuff)
            if (details.ariaLabel) {
                html += `
        <span class="font-medium">ARIA Label:</span>
        <span class="break-words text-left">"${details.ariaLabel}"</span>`;
            }

            // Finally, if there's a parent link for e.g. an <img> inside <a>, show that
            if (details.parentLink) {
                html += `
        <span class="font-medium">Parent Link:</span>
        <span class="break-words whitespace-normal overflow-x-hidden text-left">
            &lt;${details.parentLink.tagName}&gt; href="${details.parentLink.href}"
            ${details.parentLink.ariaLabel ? '(ARIA Label: ' + details.parentLink.ariaLabel + ')' : ''}
        </span>`;
            }

            if (details.parentContainer) {
                const pc = details.parentContainer;

                // Use the snippet property directly if it exists
                let containerDesc = pc.snippet || `<${pc.tagName.toLowerCase()}>`;

                // If you still want to add the ID and there's no snippet
                if (!pc.snippet && pc.id) {
                    containerDesc = `<${pc.tagName.toLowerCase()} id="${pc.id}">`;
                }

                // Make sure we have a closing tag if snippet doesn't include it
                if (!containerDesc.includes('</')) {
                    containerDesc += `</${pc.tagName.toLowerCase()}>`;
                }

                // Escape HTML characters so they display as text
                const escapedDesc = containerDesc
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');

                html += `
        <div class="col-span-2 mt-2">
            <div class="bg-gray-50 rounded p-2 border break-words whitespace-normal overflow-x-hidden">
                <div class="text-sm font-semibold mb-1">Parent container</div>
                <div class="text-sm break-words whitespace-normal overflow-x-hidden">
                ${escapedDesc}
                </div>
            </div>
        </div>
        `;
            }


            const ariaKeys = details.ariaAttributes ? Object.keys(details.ariaAttributes) : [];
            if (ariaKeys.length > 0) {
                // We'll show them in a small sub-section
                html += `
    <div class="col-span-2 mt-2">
      <div class="bg-gray-50 rounded p-2 border">
        <div class="text-sm font-semibold mb-1">ARIA / Role Info</div>
        <div class="grid grid-cols-[120px,1fr] gap-2 text-sm">
    `;

                ariaKeys.forEach(key => {
                    const value = details.ariaAttributes[key];
                    html += `
          <span class="font-medium">${key}:</span>
          <span>${value}</span>
        `;
                });

                html += `
        </div>
      </div>
    </div>
    `;
            }



            // End the main grid
            html += `</div>`;
        } else if (logData.action === 'tab-focus') {
            const from = logData.previous || {};
            const to = logData.newElement || {};
            html += `
                <div class="grid grid-cols-[120px,1fr] gap-2 break-words">
                    <span class="font-medium">Action:</span>
                    <span class="break-words text-left">Tab Focus</span>
                    <span class="font-medium">From:</span>
                    <span class="break-words text-left">
                        ${from.tagName || '[Unknown]'}${from.id ? ' (#' + from.id + ')' : ''}${from.ariaLabel ? ' - ' + from.ariaLabel : ''}${from.text ? ' - ' + from.text : ''}
                    </span>
                    <span class="font-medium">To:</span>
                    <span class="break-words text-left">
                        ${to.tagName || '[Unknown]'}${to.id ? ' (#' + to.id + ')' : ''}${to.ariaLabel ? ' - ' + to.ariaLabel : ''}${to.text ? ' - ' + to.text : ''}
                    </span>
                    <span class="font-medium">Key:</span>
                    <span class="break-words text-left">${logData.key || 'Tab'}</span>
                </div>
            `;
        } else if (logData.action === 'input-change') {
            const details = logData.details;
            html += `
                <div class="grid grid-cols-[120px,1fr] gap-2 break-words">
                <span class="font-medium">Element:</span>
                <span class="break-words text-left">&lt;${details.tagName}&gt;</span>
            `;
            if (details.tagName === 'SELECT') {
                html += `
                <span class="font-medium">Type:</span>
                <span class="break-words text-left">Select ${details.multiple ? '(Multiple)' : '(Single)'}</span>
                <span class="font-medium">Selected:</span>
                <span class="break-words text-left">"${details.selectedText}" (value: ${details.selectedValue})</span>`;
                if (details.multiple && details.selectedOptions) {
                    html += `
                    <span class="font-medium">All Selected:</span>
                    <span class="break-words text-left">${details.selectedOptions.map(opt =>
                        `"${opt.text}" (${opt.value})`).join(', ')}</span>`;
                }
            } else if (details.inputType === 'checkbox') {
                html += `
                <span class="font-medium">Type:</span>
                <span class="break-words text-left">Checkbox</span>
                <span class="font-medium">Label:</span>
                <span class="break-words text-left">${details.labelText}</span>
                <span class="font-medium">State:</span>
                <span class="break-words text-left">${details.checked ? 'Checked' : 'Unchecked'}</span>`;
            } else if (details.inputType === 'radio') {
                html += `
                <span class="font-medium">Type:</span>
                <span class="break-words text-left">Radio</span>
                <span class="font-medium">Selected:</span>
                <span class="break-words text-left">${details.labelText}</span>`;
                if (details.groupOptions) {
                    html += `
                    <span class="font-medium">Group Options:</span>
                    <span class="break-words text-left">${details.groupOptions.map(opt =>
                        `${opt.labelText}${opt.checked ? ' (Selected)' : ''}`).join(', ')}</span>`;
                }
            } else {
                html += `
                <span class="font-medium">Type:</span>
                <span class="break-words text-left">${details.inputType}</span>
                <span class="font-medium">Value:</span>
                <span class="break-words text-left">${details.inputType === 'password' ? '[REDACTED]' : `"${details.value}"`}</span>`;
            }
            if (details.required) {
                html += `
                <span class="font-medium">Required:</span>
                <span class="break-words text-left">Yes</span>`;
            }

            html += `</div>`;
        } else if (logData.action === 'keydown') {
            html += `
                <div class="grid grid-cols-[120px,1fr] gap-2 break-words">
                    <span class="font-medium">Key:</span>
                    <span class="break-words text-left">${logData.key}</span>
                    <span class="font-medium">With Modifiers:</span>
                    <span class="break-words text-left">
                        ${logData.ctrlKey ? 'Ctrl+' : ''}${logData.shiftKey ? 'Shift+' : ''}${logData.altKey ? 'Alt+' : ''}${logData.key}
                    </span>
                    <span class="font-medium">Element:</span>
                    <span class="break-words text-left">&lt;${logData.details.tagName}&gt;</span>
                    ${logData.details.context ? `
                        <span class="font-medium">Context:</span>
                        <span class="break-words text-left">${logData.details.context}</span>
                    ` : ''}
                    ${logData.details.inputType ? `
                        <span class="font-medium">Input Type:</span>
                        <span class="break-words text-left">${logData.details.inputType}</span>
                    ` : ''}
                </div>`;
        }
        // --- End Branches ---
        html += `</div></div>`;

        // ---------------------------------------------------------------------
        // 3) CREATE THE CONTENT CONTAINER, PUT THE TOP BAR ABOVE IT
        // ---------------------------------------------------------------------
        const contentContainer = document.createElement('div');
        contentContainer.className = "flex-1";

        // Place the topBar first, then your existing HTML for details
        const topBarWrapper = document.createElement('div');
        topBarWrapper.appendChild(topBar);

        // Then we add your big HTML block below
        const mainContent = document.createElement('div');
        mainContent.innerHTML = html;

        // Put topBar, then mainContent, all inside contentContainer
        contentContainer.appendChild(topBarWrapper);
        contentContainer.appendChild(mainContent);

        // Finally, append contentContainer to the entry
        entry.appendChild(contentContainer);

        // ---------------------------------------------------------------------
        // 4) ADD THE SCREENSHOT ROW (IF APPLICABLE)
        // ---------------------------------------------------------------------
        if (logData.screenshot) {
            const screenshotRow = document.createElement('div');
            screenshotRow.className = "grid grid-cols-[120px,auto] gap-2 break-words details-grid mt-2 screenshot-row";

            // Link to open the screenshot
            const screenshotLink = document.createElement('a');
            screenshotLink.href = base64ToURL('data:image/png;base64,' + logData.screenshot);
            screenshotLink.textContent = logData.isElementCapture
                ? 'Capture...png'
                : 'Screenshot...png';
            screenshotLink.target = '_blank';
            screenshotLink.className = "text-blue-600 hover:text-blue-800 underline";
            screenshotRow.appendChild(screenshotLink);

            // Delete screenshot button
            const deleteScreenshotBtn = document.createElement('button');
            deleteScreenshotBtn.innerHTML = '<svg data-lucide="trash" width="16" height="16"></svg>';
            deleteScreenshotBtn.title = 'Delete Screenshot';
            deleteScreenshotBtn.className = "delete-screenshot-btn text-gray-500 hover:text-red-500 transition-colors";
            deleteScreenshotBtn.addEventListener('click', () => {
                showModal('delete-screenshot-modal', {
                    onConfirm: () => {
                        if (activeScreenshotEvent) {
                            delete activeScreenshotEvent.screenshot;
                        }
                        screenshotRow.remove();
                    }
                });
            });
            screenshotRow.appendChild(deleteScreenshotBtn);

            // Append the screenshot row after the content container
            entry.appendChild(screenshotRow);
            lucide.createIcons(screenshotRow);
        }

        // ---------------------------------------------------------------------
        // 5) FOOTER (TIME INFO)
        // ---------------------------------------------------------------------
        const footer = document.createElement('div');
        footer.className = "flex justify-end mt-4 pt-2 border-t border-gray-200";
        const timeSpan = document.createElement('span');
        timeSpan.className = "text-gray-400 text-[11px]";
        timeSpan.textContent = timeStr;
        footer.appendChild(timeSpan);
        entry.appendChild(footer);

        // ---------------------------------------------------------------------
        // 6) APPEND THE ENTRY, COPY-URL HANDLERS, COMMENT FEATURE, ETC.
        // ---------------------------------------------------------------------
        logArea.appendChild(entry);

        // Attach copy-url event listeners
        const copyButtons = entry.querySelectorAll('.copy-url-btn');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.currentTarget.dataset.url;
                window.electron.clipboard.writeText(url);

                // Toast notification
                const toast = document.createElement('div');
                toast.className = 'fixed bottom-4 left-4 bg-cyan-600 text-white px-4 py-2 rounded shadow-lg text-sm';
                toast.textContent = 'URL copied to clipboard!';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);

                // Temporarily change button title
                const originalTitle = e.currentTarget.title;
                e.currentTarget.title = 'Copied!';
                setTimeout(() => {
                    e.currentTarget.title = originalTitle;
                }, 1500);
            });
        });

        // Create icons and scroll to bottom
        lucide.createIcons(entry);
        logArea.scrollTop = logArea.scrollHeight;

        // Find all color swatches and add event listeners
        const colorSwatches = entry.querySelectorAll('.color-swatch');
        colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', showColorFormatsPopup);
        });

        // Enable commenting for this log entry (same as before)
        setupCommentFeature(entry, logData);

        // Return whatever you were returning
        return output;
    }

    function renderAllEvents() {
        if (!loggingEnabled) {
            return; 
        }
        const logArea = document.getElementById('log-area');
        logArea.innerHTML = ''; // Clear out old entries

        // Rebuild them in order
        eventLog.forEach(eventData => {
            updateLogUI(eventData);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'F1') {
            e.preventDefault(); 
            showModal('keyboard-shortcuts-modal');
        }
    });

    // Adds the comment button and editing functionality to a log entry
    function setupCommentFeature(entry, logData) {
        const screenshotButton = document.createElement('button');
        screenshotButton.innerHTML = '<svg data-lucide="camera" width="16" height="16"></svg>';
        screenshotButton.title = 'CTRL + Click for Element';
        screenshotButton.className = 'absolute top-2 right-8 text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-50 rounded';

        screenshotButton.addEventListener('click', async (e) => {
            console.log('Camera icon clicked. ctrlKey=', e.ctrlKey, 'shiftKey=', e.shiftKey, 'altKey=', e.altKey);

            // Find the closest log entry container
            const targetEntry = e.target.closest('[data-timestamp]');
            if (!targetEntry) {
                console.warn("Could not find parent log entry!");
                return;
            }

            // Always use the existing logData
            activeScreenshotEvent = logData;

            // Remove any existing screenshot row if it exists
            const existingRow = targetEntry.querySelector('.screenshot-row');
            if (existingRow) {
                existingRow.remove();
            }

            delete logData.isElementCapture;
            delete activeScreenshotEvent.fullPage;

            if (e.ctrlKey && e.shiftKey) {
                const wv = document.querySelector("#my-webview");
                const dimensions = await wv.executeJavaScript(`
        (function() {
            const doc = document.documentElement;
            const body = document.body;
            
            // Calculate the maximum height of all elements
            const allElements = Array.from(document.querySelectorAll('*'));
            let maxBottom = 0;
            
            for (const el of allElements) {
                const rect = el.getBoundingClientRect();
                maxBottom = Math.max(maxBottom, rect.bottom + window.scrollY);
            }
            
            // Get various height measurements
            const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight);
            const offsetHeight = Math.max(doc.offsetHeight, body.offsetHeight);
            const clientHeight = Math.max(doc.clientHeight, body.clientHeight);
            
            return {
                scrollHeight: scrollHeight,
                offsetHeight: offsetHeight,
                clientHeight: clientHeight,
                maxElementBottom: maxBottom
            };
        })();
    `);
                console.log("Inside webview => documentElement.scrollHeight:", dimensions.scrollHeight);
                console.log("Inside webview => documentElement.offsetHeight:", dimensions.offsetHeight);
                console.log("Inside webview => maxElementBottom:", dimensions.maxElementBottom);

                // Use the maximum value from all measurements for the full height
                const pageHeight = Math.max(
                    dimensions.scrollHeight,
                    dimensions.offsetHeight,
                    dimensions.clientHeight,
                    dimensions.maxElementBottom
                );
                console.log("Full page height to capture:", pageHeight);

                activeScreenshotEvent.fullPage = true;

                // Send the correct height variable!
                window.electron.ipcRenderer.send('take-fullpage-screenshot-cdp', {
                    totalHeight: pageHeight,
                    chunkHeight: 1000
                });

                // Replace the existing 'once' handler with a complete implementation
                window.electron.ipcRenderer.once('fullpage-screenshot-result', (_, base64) => {
                    console.log('Full-page screenshot base64 length:', base64 ? base64.length : 0);

                    if (!base64 || base64.length === 0) {
                        console.error('Empty screenshot data received');
                        showToast('Error capturing full screenshot');
                        return;
                    }

                    // Store the screenshot data in the active event
                    activeScreenshotEvent.screenshot = base64;

                    // Find the log entry element for this event
                    const logArea = document.getElementById('log-area');
                    if (!logArea) return;

                    const entries = logArea.children;
                    let targetEntry = null;

                    for (let entry of entries) {
                        if (entry.dataset.timestamp === activeScreenshotEvent.timestamp) {
                            targetEntry = entry;
                            break;
                        }
                    }

                    if (!targetEntry) {
                        console.error("Could not find matching log entry");
                        return;
                    }

                    // Create screenshot row
                    const screenshotRow = document.createElement('div');
                    screenshotRow.className = "grid grid-cols-[120px,1fr] gap-2 w-full screenshot-row";
                    screenshotRow.innerHTML = `
            <span class="font-medium">Full Screenshot:</span>
            <div class="flex items-center justify-between w-full">
                <button class="text-blue-600 hover:text-blue-800 underline flex items-center"
                    title="Full page screenshot">
                    <svg data-lucide="camera" width="16" height="16" class="mr-2"></svg>
                    <span>FullScreenshot...png</span>
                </button>
                <button class="delete-screenshot-btn text-gray-500 hover:text-red-500 transition-colors"
                    title="Delete full-page screenshot">
                    <svg data-lucide="trash" width="16" height="16"></svg>
                </button>
            </div>
        `;

                    // Add click handlers
                    const viewBtn = screenshotRow.querySelector('button.text-blue-600');
                    viewBtn.addEventListener('click', () => {
                        showModalImage('data:image/png;base64,' + base64, activeScreenshotEvent.timestamp);
                    });

                    const deleteBtn = screenshotRow.querySelector('.delete-screenshot-btn');
                    deleteBtn.addEventListener('click', () => {
                        showModal('delete-screenshot-modal', {
                            message: 'Are you sure you want to delete this full-page screenshot?',
                            title: 'Delete Full-Page Screenshot?',
                            onConfirm: () => {
                                delete activeScreenshotEvent.screenshot;
                                screenshotRow.remove();
                                showToast('Full-page screenshot deleted!');
                            }
                        });
                    });

                    // Find or create details grid
                    let detailsGrid = targetEntry.querySelector('.details-grid');
                    if (!detailsGrid) {
                        detailsGrid = document.createElement('div');
                        detailsGrid.className = 'details-grid mt-2';
                        const contentContainer = targetEntry.querySelector('.flex-1');
                        if (contentContainer) {
                            contentContainer.appendChild(detailsGrid);
                        }
                    }

                    // Remove any existing screenshot row
                    const existingRow = detailsGrid.querySelector('.screenshot-row');
                    if (existingRow) {
                        existingRow.remove();
                    }

                    // Add the screenshot row
                    detailsGrid.appendChild(screenshotRow);

                    // Initialize icons
                    lucide.createIcons(screenshotRow);

                    showToast('Full-page screenshot captured!');
                });
            } else if (e.ctrlKey) {
                activeScreenshotEvent.isElementCapture = true;
                window.electron.ipcRenderer.send('take-element-screenshot', {
                    xpath: activeScreenshotEvent.details.xpath
                });
            } else {
                window.electron.ipcRenderer.send('take-screenshot');
            }

        });


        entry.appendChild(screenshotButton);

        if (!loggingEnabled) {
            lucide.createIcons(entry);
            return;
        }

        // Create the Delete Event button (will be the far right icon)
        const deleteEventButton = document.createElement('button');
        deleteEventButton.innerHTML = '<svg data-lucide="trash" width="16" height="16"></svg>';
        deleteEventButton.title = 'Delete Event';
        deleteEventButton.className = 'absolute top-2 right-2 text-gray-500 hover:text-red-500 p-1 hover:bg-gray-50 rounded';
        deleteEventButton.addEventListener('click', () => {
            showModal('delete-event-modal', {
                onConfirm: () => {
                    const index = eventLog.indexOf(logData);
                    if (index > -1) {
                        eventLog.splice(index, 1);
                        renderAllEvents();
                    }
                    entry.remove();
                    showToast('Event deleted!');
                }
            });
        });
        entry.appendChild(deleteEventButton);



        // Create the Comment button (leftmost icon)
        const commentButton = document.createElement('button');
        commentButton.innerHTML = '<svg data-lucide="message-circle" width="16" height="16"></svg>';
        commentButton.title = 'Add/Edit Comment';
        commentButton.className = 'absolute top-2 right-14 text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-50 rounded';
        entry.appendChild(commentButton);

        lucide.createIcons(entry);

        commentButton.addEventListener('click', () => {
            let commentArea = entry.querySelector('.comment-area');
            if (commentArea) {
                // Toggle if already exists
                commentArea.style.display = (commentArea.style.display === 'none') ? 'block' : 'none';
                if (commentArea.style.display === 'block') {
                    commentArea.querySelector('.comment-editor').focus();
                }
            } else {
                // Create the comment UI
                commentArea = document.createElement('div');
                commentArea.className = 'comment-area mt-2';
                commentArea.innerHTML = `
                    <!-- Toolbar -->
                    <div class="comment-toolbar flex space-x-2 mb-1 text-xs">
                        <button type="button" class="toolbar-btn bold-btn" title="Bold" aria-label="Bold"><b>B</b></button>
                        <button type="button" class="toolbar-btn underline-btn" title="Underline" aria-label="Underline"><u>U</u></button>
                        <button type="button" class="toolbar-btn ul-btn" title="Unordered List" aria-label="Unordered List">&bull; List</button>
                        <button type="button" class="toolbar-btn link-btn" title="Insert Link" aria-label="Insert Link">Link</button>
                    </div>

                    <!-- Editable Area -->
                    <div
                        class="comment-editor border border-gray-300 rounded p-2 text-xs
                            focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        contenteditable="true"
                        aria-label="Comment editor"
                        style="min-height: 60px;"
                        data-placeholder="Add comment..."
                    ></div>

                    <!-- Row: Left (Save/Cancel) | Right (Shortcuts) -->
                    <div class="flex items-center justify-between mt-1">

                        <!-- Left side: Save & Cancel -->
                        <div class="flex items-center space-x-2">

                        <!-- Wrap Save in a relative container for the tooltip -->
                        <div class="relative group">
                            <button
                            type="button"
                            class="save-comment px-3 py-1.5 text-xs bg-gray-800 text-white rounded hover:bg-gray-900"
                            >
                            Save
                            </button>

                            <!-- Tooltip anchored to top-right of the Save button -->
                            <div
                            class="pointer-events-none absolute bottom-full left-0 transform translate-x-0 mb-2
                                    hidden group-hover:block opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                            >
                            <div class="bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-lg relative whitespace-nowrap">
                                Shortcut:
                                <kbd class="kbc-button">Ctrl+Enter</kbd>

                                <!-- Arrow pointing down -->
                                <span class="absolute bottom-0 left-5 transform translate-y-full -translate-x-1/2 border-[6px] border-transparent border-t-gray-900"></span>
                            </div>
                            </div>
                        </div>

                        <!-- Cancel Button -->
                        <button
                            type="button"
                            class="cancel-comment border border-gray-400 text-gray-700 px-2 py-1 rounded text-xs"
                        >
                            Cancel
                        </button>
                        </div>

                        <!-- Right side: Combined <kbd> shortcuts -->
                    <div class="flex space-x-2 text-[10px] text-gray-500 leading-tight">
                    <!-- Ctrl+K -->
                    <div class="relative group">
                        <kbd class="kbc-button">
                        Ctrl+K
                        </kbd>
                        <!-- Tooltip -->
                        <span
                        class="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1
                                hidden group-hover:block opacity-0 group-hover:opacity-100
                                transition-opacity duration-150 bg-gray-900 text-white px-2 py-1
                                rounded text-[9px] whitespace-nowrap"
                        >
                        Insert/edit link
                        <!-- Arrow -->
                        <span
                            class="absolute bottom-0 left-1/2 transform translate-y-full -translate-x-1/2
                                border-[5px] border-transparent border-t-gray-900"
                        ></span>
                        </span>
                    </div>

                    <!-- Shift+Enter -->
                    <div class="relative group">
                        <kbd class="kbc-button">
                        Shift+Enter
                        </kbd>
                        <!-- Tooltip -->
                        <span
                        class="pointer-events-none absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1
                                hidden group-hover:block opacity-0 group-hover:opacity-100
                                transition-opacity duration-150 bg-gray-900 text-white px-2 py-1
                                rounded text-[9px] whitespace-nowrap"
                        >
                        Line break
                        <!-- Arrow -->
                        <span
                            class="absolute bottom-0 left-1/2 transform translate-y-full -translate-x-1/2
                                border-[5px] border-transparent border-t-gray-900"
                        ></span>
                        </span>
                    </div>

                    <!-- Enter -->
                    <div class="relative group">
                    <kbd class="kbc-button">
                        Enter
                    </kbd>
                    <!-- Tooltip -->
                    <span
                        class="pointer-events-none absolute bottom-full right-0 mb-1
                            hidden group-hover:block opacity-0 group-hover:opacity-100
                            transition-opacity duration-150 bg-gray-900 text-white px-2 py-1
                            rounded text-[9px] whitespace-normal w-[100px] break-words"
                    >
                        New line (auto-list if "1." typed)
                        <!-- Arrow -->
                        <span
                        class="absolute bottom-0 right-2 transform translate-y-full
                                w-0 h-0 border-[5px] border-transparent border-t-gray-900"
                        ></span>
                    </span>
                    </div>

                    </div>

                    </div>
                    `;


                entry.appendChild(commentArea);

                setTimeout(() => {
                    commentArea.querySelector('.comment-editor').focus();
                }, 0);

                const editor = commentArea.querySelector('.comment-editor');
                const boldBtn = commentArea.querySelector('.bold-btn');
                const underlineBtn = commentArea.querySelector('.underline-btn');
                const ulBtn = commentArea.querySelector('.ul-btn');
                const linkBtn = commentArea.querySelector('.link-btn');
                const saveButton = commentArea.querySelector('.save-comment');
                const cancelButton = commentArea.querySelector('.cancel-comment');

                // Bold & Underline
                boldBtn.addEventListener('click', () => {
                    editor.focus();
                    document.execCommand('bold');
                });
                underlineBtn.addEventListener('click', () => {
                    editor.focus();
                    document.execCommand('underline');
                });

                // Insert bullet list
                ulBtn.addEventListener('click', () => {
                    editor.focus();
                    document.execCommand('insertUnorderedList');
                    // Force bullet styling
                    editor.querySelectorAll('ul').forEach(list => {
                        list.style.listStyleType = 'disc';
                        list.style.paddingLeft = '20px';
                    });
                });

                // Insert/Edit link
                linkBtn.addEventListener('click', () => {
                    editor.focus();
                    const selection = window.getSelection();
                    if (!selection.rangeCount) return;

                    const range = selection.getRangeAt(0);
                    let existingAnchor = null;
                    if (range.startContainer.parentNode) {
                        existingAnchor = range.startContainer.parentNode.closest('a');
                    }

                    // Link input pop-up
                    const linkInputContainer = document.createElement('div');
                    linkInputContainer.className = 'fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg';
                    linkInputContainer.innerHTML = `
                    <div class="max-w-lg mx-auto">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            ${existingAnchor ? 'Edit Link URL:' : 'Enter URL:'}
                        </label>
                        <div class="flex gap-2">
                            <input 
                                type="url"
                                class="flex-1 border border-gray-300 rounded px-3 py-2 text-sm
                                       focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="https://"
                                value="${existingAnchor ? existingAnchor.getAttribute('href') : ''}"
                            >
                            <button class="px-4 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-900">
                                ${existingAnchor ? 'Update Link' : 'Add Link'}
                            </button>
                            <button class="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
                                Cancel
                            </button>
                        </div>
                    </div>
                `;
                    document.body.appendChild(linkInputContainer);

                    const input = linkInputContainer.querySelector('input');
                    const [addOrUpdateBtn, cancelBtn, closeBtn, closeBtnX] = linkInputContainer.querySelectorAll('button');
                    input.focus(); // Immediately focus on the URL field

                    // Remember selection
                    const storedRange = {
                        startContainer: range.startContainer,
                        startOffset: range.startOffset,
                        endContainer: range.endContainer,
                        endOffset: range.endOffset
                    };

                    addOrUpdateBtn.addEventListener('click', () => {
                        let url = input.value.trim();
                        if (url) {
                            if (!/^https?:\/\//i.test(url)) {
                                url = 'http://' + url;
                            }

                            // Restore selection
                            const newRange = document.createRange();
                            newRange.setStart(storedRange.startContainer, storedRange.startOffset);
                            newRange.setEnd(storedRange.endContainer, storedRange.endOffset);
                            selection.removeAllRanges();
                            selection.addRange(newRange);

                            if (existingAnchor) {
                                // Edit existing <a>
                                existingAnchor.setAttribute('href', url);
                                existingAnchor.setAttribute('target', '_blank');
                                existingAnchor.setAttribute('rel', 'noopener noreferrer');
                                existingAnchor.style.color = '#2563eb';
                                existingAnchor.style.textDecoration = 'underline';
                            } else {
                                // Create new link
                                document.execCommand('createLink', false, url);
                                // Style it
                                const links = editor.querySelectorAll('a');
                                links.forEach(a => {
                                    a.setAttribute('target', '_blank');
                                    a.setAttribute('rel', 'noopener noreferrer');
                                    a.style.color = '#2563eb';
                                    a.style.textDecoration = 'underline';
                                });
                            }
                        }
                        linkInputContainer.remove();
                        editor.focus();
                    });

                    cancelBtn.addEventListener('click', () => {
                        linkInputContainer.remove();
                        editor.focus();
                    });
                    closeBtn.addEventListener('click', () => {
                        linkInputContainer.remove();
                        editor.focus();
                    });
                    closeBtnX.addEventListener('click', () => {
                        linkInputContainer.remove();
                        editor.focus();
                    });

                    // Press Enter => confirm link
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addOrUpdateBtn.click();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelBtn.click();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            closeBtn.click();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            closeBtnX.click();
                        }
                    });
                });

                // Auto-link on paste
                editor.addEventListener('paste', e => {
                    e.preventDefault();
                    const text = (e.clipboardData || window.clipboardData).getData('text');
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    if (urlRegex.test(text)) {
                        const replaced = text.replace(urlRegex, url =>
                            `<a href="${url}" target="_blank" style="color:#2563eb;text-decoration:underline;">${url}</a>`
                        );
                        document.execCommand('insertHTML', false, replaced);
                    } else {
                        document.execCommand('insertText', false, text);
                    }
                });


                // Keyboard shortcuts
                editor.addEventListener('keydown', e => {
                    // 1) If user presses Ctrl+K => Insert link (existing logic)
                    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                        e.preventDefault();
                        linkBtn.click();
                        return;
                    }

                    // 2) If user presses Ctrl+Enter => "Save" the comment
                    if (e.ctrlKey && e.key === 'Enter') {
                        e.preventDefault();
                        saveComment();
                        return;
                    }

                    // 3) If user presses Shift+Enter => Insert a line break
                    if (e.shiftKey && e.key === 'Enter') {
                        e.preventDefault();
                        document.execCommand('insertLineBreak');
                        return;
                    }

                    // 4) Our new "type 1. => ordered list" logic
                    if (e.key === 'Enter') {
                        const selection = window.getSelection();
                        if (!selection.rangeCount) return;

                        // Figure out what's typed on *this line* before the cursor
                        const range = selection.getRangeAt(0);
                        const node = range.startContainer;
                        const typedSoFar = node.textContent.substring(0, range.startOffset).trim();

                        // If they typed "1." or "1. " at start of line, auto-insert an ordered list
                        if (typedSoFar === '1.' || typedSoFar === '1. ') {
                            e.preventDefault();

                            // Remove "1." from the text so it doesn't remain visible
                            node.textContent = node.textContent.replace(/^1\.\s?/, '');

                            // Put cursor back at end
                            const newRange = document.createRange();
                            newRange.setStart(node, node.textContent.length);
                            newRange.setEnd(node, node.textContent.length);
                            selection.removeAllRanges();
                            selection.addRange(newRange);

                            // Insert an ordered list
                            document.execCommand('insertOrderedList');
                        }
                    }
                });



                function saveComment() {
                    const commentHTML = editor.innerHTML.trim();
                    const cleaned = commentHTML.replace(/^Add comment...$/, '').trim();
                    if (cleaned) {
                        if (!logData.comments) {
                            logData.comments = [];
                        }
                        logData.comments.unshift({
                            text: cleaned,
                            timestamp: new Date().toISOString()
                        });
                        updateCommentsDisplay(entry, logData);
                    }
                    editor.innerHTML = '';
                    commentArea.style.display = 'none';
                }

                saveButton.addEventListener('click', saveComment);
                cancelButton.addEventListener('click', () => {
                    editor.innerHTML = '';
                    commentArea.style.display = 'none';
                });
            }

            // Refresh any existing comments
            updateCommentsDisplay(entry, logData);
            lucide.createIcons(commentButton);
        });
    }
    window.setupCommentFeature = setupCommentFeature;

    function updateCommentsDisplay(entry, logData) {
        // 1) Check if container already exists; if not, create it
        let commentsContainer = entry.querySelector('.comments-container');
        if (!commentsContainer) {
            commentsContainer = document.createElement('div');
            commentsContainer.className = 'comments-container mt-4 border-t border-gray-200 pt-4';
            entry.appendChild(commentsContainer);
        }

        // 2) Clear any old content
        commentsContainer.innerHTML = '';

        // 3) If no comments, remove the container and stop
        if (!logData.comments || logData.comments.length === 0) {
            commentsContainer.remove();
            return;
        }

        // 4) Add the "Comments:" label at the top
        const label = document.createElement('div');
        label.className = 'text-sm font-semibold text-gray-700 mb-2';
        label.textContent = 'Comments:';
        commentsContainer.appendChild(label);

        // 5) Rebuild the list of comments
        logData.comments.forEach((comment, index) => {
            // Each comment row
            const commentDiv = document.createElement('div');
            commentDiv.className =
                'relative grid grid-cols-[1fr,auto] gap-3 items-center bg-white p-1.5 border border-gray-200 rounded text-xs text-gray-600 mt-1.5';

            // The displayed comment text
            const commentText = document.createElement('span');
            commentText.className = 'flex-1 text-gray-700';
            commentText.innerHTML = comment.text; // preserve formatting

            // Actions container (edit/delete)
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'flex flex-col gap-1';

            // Edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'text-gray-400 hover:text-blue-500 transition-colors p-1';
            editBtn.title = 'Edit';
            editBtn.innerHTML = '<svg data-lucide="pencil" width="14" height="14"></svg>';

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'text-gray-400 hover:text-red-500 transition-colors p-1';
            deleteBtn.title = 'Delete';
            deleteBtn.innerHTML = '<svg data-lucide="trash" width="14" height="14"></svg>';

            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);

            // Append to the row
            commentDiv.appendChild(commentText);
            commentDiv.appendChild(actionsDiv);
            commentsContainer.appendChild(commentDiv);

            // ----- Edit Button Logic -----
            editBtn.addEventListener('click', () => {
                // Hide original text & buttons
                commentText.style.display = 'none';
                actionsDiv.style.display = 'none';

                // Build an edit area
                const editArea = document.createElement('div');
                editArea.className = 'comment-area mt-2';

                editArea.innerHTML = `
                <!-- Simple toolbar -->
                <div class="comment-toolbar flex space-x-2 mb-1 text-xs">
                    <button type="button" class="toolbar-btn bold-btn" title="Bold"><b>B</b></button>
                    <button type="button" class="toolbar-btn underline-btn" title="Underline"><u>U</u></button>
                    <button type="button" class="toolbar-btn ul-btn" title="Unordered List">• List</button>
                    <button type="button" class="toolbar-btn link-btn" title="Insert Link">Link</button>
                </div>

                <!-- Editable area with existing comment text -->
                <div
                    class="comment-editor border border-gray-300 rounded p-2 text-xs
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    contenteditable="true"
                    style="min-height: 60px;"
                >${comment.text}</div>

                <!-- Save/Cancel/Delete row -->
                <div class="flex items-center justify-between mt-1">
                    <div class="flex items-center space-x-2">
                        <button type="button" class="save-edit px-3 py-1.5 text-xs bg-gray-800 text-white rounded hover:bg-gray-900">
                            Save
                        </button>
                        <button type="button" class="cancel-edit border border-gray-400 text-gray-700 px-2 py-1 rounded text-xs">
                            Cancel
                        </button>
                        <button type="button" class="delete-comment text-red-600 hover:text-red-700 px-2 py-1 text-xs">
                            Delete comment
                        </button>
                    </div>
                </div>
            `;

                commentDiv.appendChild(editArea);

                // Grab references
                const editor = editArea.querySelector('.comment-editor');
                const saveEditBtn = editArea.querySelector('.save-edit');
                const cancelEditBtn = editArea.querySelector('.cancel-edit');
                const deleteEditBtn = editArea.querySelector('.delete-comment');

                // Basic toolbar example
                const boldBtn = editArea.querySelector('.bold-btn');
                const underlineBtn = editArea.querySelector('.underline-btn');
                const ulBtn = editArea.querySelector('.ul-btn');
                const linkBtn = editArea.querySelector('.link-btn');

                boldBtn.addEventListener('click', () => {
                    editor.focus();
                    document.execCommand('bold');
                });
                underlineBtn.addEventListener('click', () => {
                    editor.focus();
                    document.execCommand('underline');
                });
                ulBtn.addEventListener('click', () => {
                    editor.focus();
                    document.execCommand('insertUnorderedList');
                });
                linkBtn.addEventListener('click', () => {
                    // Insert link logic if needed
                });

                // Save changes
                saveEditBtn.addEventListener('click', () => {
                    const newHTML = editor.innerHTML.trim();
                    if (newHTML) {
                        comment.text = newHTML;
                    }
                    // Remove edit UI
                    editArea.remove();
                    // Show the updated comment
                    commentText.innerHTML = comment.text;
                    commentText.style.display = 'block';
                    actionsDiv.style.display = 'flex';
                });

                // Cancel editing
                cancelEditBtn.addEventListener('click', () => {
                    editArea.remove();
                    commentText.style.display = 'block';
                    actionsDiv.style.display = 'flex';
                });

                // Delete comment from inside edit mode
                deleteEditBtn.addEventListener('click', () => {
                    logData.comments.splice(index, 1);
                    updateCommentsDisplay(entry, logData);
                });
            });

            // ----- Normal Delete Button Logic -----
            deleteBtn.addEventListener('click', () => {
                logData.comments.splice(index, 1);
                updateCommentsDisplay(entry, logData);
            });
        });

        // 6) Re-render icons if you’re using Lucide or similar
        if (typeof lucide !== 'undefined') {
            lucide.createIcons(commentsContainer);
        }
    }
    // ----- Export Functions -----

    // Export the log as Markdown
    exportLogButton.addEventListener('click', () => {
        let markdown = '# tracer Action Log\n\n';
        markdown += `Generated: ${new Date().toLocaleString()}\n\n`;

        function formatUrl(url) {
            if (!url) return '';

            // Clean up file:// URLs to make them more readable
            if (url.startsWith('file://')) {
                return url.replace(/^file:\/\/\//, '');
            } else if (url.startsWith('https://') || url.startsWith('http://')) {
                // For web URLs, keep as clickable link
                return `[${url}](${url})`;
            }

            // Handle anchor links and other formats
            if (url.startsWith('#')) {
                return url;
            }

            // For other formats, just return as is
            return url;
        }

        eventLog.forEach((item, index) => {
            const timeStr = formatTimestamp(item.timestamp);
            let section = `## ${index + 1}. ${timeStr} - ${item.action.toUpperCase()}\n\n`;

            if (item.action === 'page-loaded') {
                section += `- **Page Title:** "${item.title}"\n`;
                if (item.url) {
                    // Clean up file:// URLs to make them more readable
                    let displayUrl = item.url;
                    if (displayUrl.startsWith('file://')) {
                        // Extract the file path portion for better display
                        displayUrl = displayUrl.replace(/^file:\/\/\//, '');
                        section += `- **URL:** ${displayUrl}\n`;
                    } else {
                        // For web URLs, keep as clickable link
                        section += `- **URL:** [${item.url}](${item.url})\n`;
                    }
                }
            } else if (item.action === 'click' && item.details) {
                const details = item.details;
                section += `### Element Details\n`;
                section += `- **Type:** \`<${(details.tagName || '').toLowerCase()}>\`\n`;
                if (details.context) {
                    section += `- **Section:** ${details.context}\n`;
                }
                if (details.fontInfo) {
                    section += `- **Font Family:** ${details.fontInfo.fontFamily}\n`;
                    section += `- **Font Size:** ${details.fontInfo.fontSize}\n`;
                    section += `- **Font Weight:** ${details.fontInfo.fontWeight}\n`;
                    section += `- **Font Style:** ${details.fontInfo.fontStyle}\n`;
                    section += `- **Line Height:** ${details.fontInfo.lineHeight}\n`;
                    section += `- **Color:** ${details.fontInfo.color}\n`;
                }
                if ((details.tagName || '').toUpperCase() === 'IMG') {
                    section += `- **Alt Text:** ${details.alt || '[No Alt Text]'}\n`;
                    section += `- **Dimensions:** ${details.width && details.height ? details.width + '×' + details.height + 'px' : 'Unknown'}\n`;
                    if (details.loading) {
                        section += `- **Loading:** ${details.loading}\n`;
                    }
                    if (details.caption) {
                        section += `- **Caption:** ${details.caption}\n`;
                    }
                    if (details.src) {
                        section += `- **Image Source:** [View Image](${details.src})\n`;
                    }
                    section += `- **XPath:** \`${details.xpath}\`\n`;
                }     // Handle URLs properly in various attributes
                if ((details.tagName || '').toUpperCase() === 'A') {
                    if (details.text) {
                        section += `- **Link Text:** "${details.text}"\n`;
                    }
                    if (details.href) {
                        section += `- **URL:** ${formatUrl(details.href)}\n`;
                    }
                    if (details.target) {
                        section += `- **Target:** \`${details.target}\`\n`;
                    }
                } else if ((details.tagName || '').toUpperCase() === 'IMG') {
                    section += `- **Alt Text:** ${details.alt || '[No Alt Text]'}\n`;
                    section += `- **Dimensions:** ${details.width && details.height ? details.width + '×' + details.height + 'px' : 'Unknown'}\n`;
                    if (details.loading) {
                        section += `- **Loading:** ${details.loading}\n`;
                    }
                    if (details.caption) {
                        section += `- **Caption:** ${details.caption}\n`;
                    }
                    if (details.src) {
                        section += `- **Image Source:** ${formatUrl(details.src)}\n`;
                    }
                } else if ((details.tagName || '').toUpperCase() === 'BUTTON') {
                    section += `- **Button Text:** "${details.text || '[No Text]'}"\n`;
                    section += `- **Type:** ${details.type || 'button'}\n`;
                    if (details.hasIcon) {
                        section += `- **Icon:** ${details.iconType || 'Present'}\n`;
                    }
                    if (details.disabled) {
                        section += `- **State:** Disabled\n`;
                    }
                } else if ((details.tagName || '').toUpperCase() === 'INPUT') {
                    section += `- **Input Type:** ${details.inputType}\n`;
                    section += `- **Name:** ${details.name || '[No Name]'}\n`;
                    if (details.placeholder) {
                        section += `- **Placeholder:** ${details.placeholder}\n`;
                    }
                    if (details.value && details.inputType !== 'password') {
                        section += `- **Value:** "${details.value}"\n`;
                    }
                    if (details.required) {
                        section += `- **Required:** Yes\n`;
                    }
                    if (details.form) {
                        section += `- **Form:** ${details.form}\n`;
                    }
                } else if (details.tagName === 'METER') {
                    section += `- **Meter Properties:**\n`;
                    section += `  - Value: ${details.value || '0'} (${details.max ? Math.round((details.value / details.max) * 100) : 0}%)\n`;
                    section += `  - Min: ${details.min || '0'}\n`;
                    section += `  - Max: ${details.max || '100'}\n`;
                    if (details.low) section += `  - Low threshold: ${details.low}\n`;
                    if (details.high) section += `  - High threshold: ${details.high}\n`;
                    if (details.optimum) section += `  - Optimum value: ${details.optimum}\n`;
                }
                else if (details.tagName === 'PROGRESS') {
                    section += `- **Progress Properties:**\n`;
                    section += `  - Value: ${details.value || '0'}\n`;
                    section += `  - Max: ${details.max || '100'}\n`;
                    section += `  - Completion: ${details.max ? Math.round((details.value / details.max) * 100) : 0}%\n`;
                }
                else if (details.tagName === 'SELECT') {
                    section += `- **Select Options:**\n`;
                    section += `  - Selected Value: ${details.selectedValue || '[None]'}\n`;
                    section += `  - Selected Text: "${details.selectedText || '[None]'}"\n`;

                    if (details.multiple && details.selectedOptions) {
                        section += `  - **All Selected Options:**\n`;
                        details.selectedOptions.forEach(opt => {
                            section += `    - "${opt.text}" (${opt.value})\n`;
                        });
                    }

                    if (details.options && details.options.length > 0) {
                        section += `  - **Available Options:**\n`;
                        details.options.forEach(opt => {
                            section += `    - "${opt.text}" (${opt.value})${opt.selected ? ' (Selected)' : ''}\n`;
                        });
                    }
                }
                if (details.ariaLabel) {
                    section += `- **ARIA Label:** "${details.ariaLabel}"\n`;
                }
                // Add Parent Container Information
                if (details.parentContainer) {
                    let containerDesc = '[No container details]';

                    if (details.parentContainer.snippet && details.parentContainer.snippet.trim()) {
                        containerDesc = details.parentContainer.snippet.trim();
                    } else if (details.parentContainer.tagName && details.parentContainer.tagName.trim()) {
                        const pcTag = details.parentContainer.tagName.trim().toLowerCase();
                        containerDesc = `<${pcTag}>`;

                        if (details.parentContainer.id && details.parentContainer.id.trim()) {
                            containerDesc = `<${pcTag} id="${details.parentContainer.id.trim()}">`;
                        }
                    }

                    section += `- **Parent Container:** \`${containerDesc}\`\n`;
                } else {
                    section += `- **Parent Container:** [No container information]\n`;
                }
            } else if (item.action === 'select') {
                section += `- **Element:** \`<SELECT>\`\n`;
                section += `- **Selected Value:** ${item.selectedValue || '[None]'}\n`;
                section += `- **Selected Text:** ${item.selectedText || '[None]'}\n`;
            } else if (item.action === 'tab-focus') {
                const from = item.previous || {};
                const to = item.newElement || {};
                section += `- **Action:** Tab Focus\n`;
                section += `- **From:** ${from.tagName || '[Unknown]'}${from.id ? ' (#' + from.id + ')' : ''}${from.ariaLabel ? ' - ' + from.ariaLabel : ''}${from.text ? ' - ' + from.text : ''}\n`;
                section += `- **To:** ${to.tagName || '[Unknown]'}${to.id ? ' (#' + to.id + ')' : ''}${to.ariaLabel ? ' - ' + to.ariaLabel : ''}${to.text ? ' - ' + to.text : ''}\n`;
                section += `- **Key:** ${item.key || 'Tab'}\n`;
            } else if (item.action === 'input-change' && item.details) {
                const details = item.details;
                section += `- **Element:** \`<${(details.tagName || '').toLowerCase()}>\`\n`;
                if ((details.tagName || '').toUpperCase() === 'SELECT') {
                    section += `- **Type:** Select ${details.multiple ? '(Multiple)' : '(Single)'}\n`;
                    section += `- **Selected:** "${details.selectedText}" (value: ${details.selectedValue})\n`;
                    if (details.multiple && details.selectedOptions) {
                        section += `- **All Selected:** ${details.selectedOptions.map(opt => `"${opt.text}" (${opt.value})`).join(', ')}\n`;
                    }
                } else if (details.inputType === 'checkbox') {
                    section += `- **Type:** Checkbox\n`;
                    section += `- **Label:** ${details.labelText}\n`;
                    section += `- **State:** ${details.checked ? 'Checked' : 'Unchecked'}\n`;
                } else if (details.inputType === 'radio') {
                    section += `- **Type:** Radio\n`;
                    section += `- **Selected:** ${details.labelText}\n`;
                    if (details.groupOptions) {
                        section += `- **Group Options:** ${details.groupOptions.map(opt => `${opt.labelText}${opt.checked ? ' (Selected)' : ''}`).join(', ')}\n`;
                    }
                } else {
                    section += `- **Type:** ${details.inputType}\n`;
                    section += `- **Value:** ${details.inputType === 'password' ? '[REDACTED]' : `"${details.value}"`}\n`;
                }
                if (details.required) {
                    section += `- **Required:** Yes\n`;
                }
                if (details.validationState) {
                    const validationIssues = Object.entries(details.validationState)
                        .filter(([key, value]) => value !== false)
                        .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${value}`);

                    if (validationIssues.length > 0) {
                        section += `- **Validation Issues:**\n`;
                        validationIssues.forEach(issue => {
                            section += `  - ${issue}\n`;
                        });
                    }
                }
            }
            else if (item.action === 'video-play') {
                section += `- **Video Started Playing**\n`;
                if (item.details) {
                    const d = item.details;
                    if (d.src) {
                        section += `- **Video Source:** [${d.src}](${d.src})\n`;
                    }
                    if (d.currentTime !== undefined) {
                        section += `- **Starting Time:** ${d.currentTime}s\n`;
                    }
                    if (d.duration) {
                        section += `- **Duration:** ${d.duration}s\n`;
                    }
                    if (d.volume !== undefined) {
                        section += `- **Volume:** ${d.volume}\n`;
                    }
                }
            } 
            else if (item.action === 'video-volumechange') {
                section += `- **Volume Change:** From ${item.from || 'unknown'} to ${item.to || item.volume || 'unknown'}\n`;
                if (item.details) {
                    const d = item.details;
                    if (d.src) {
                        section += `- **Video Source:** [${d.src}](${d.src})\n`;
                    }
                    if (d.currentTime) {
                        section += `- **Current Time:** ${d.currentTime}s\n`;
                    }
                    if (d.duration) {
                        section += `- **Duration:** ${d.duration}s\n`;
                    }
                }
            }
            else if (item.action === 'video-pause') {
                section += `- **Video Paused**\n`;
                if (item.details) {
                    const d = item.details;
                    if (d.src) {
                        section += `- **Video Source:** [${d.src}](${d.src})\n`;
                    }
                    if (d.currentTime) {
                        section += `- **Current Time:** ${d.currentTime}s\n`;
                    }
                    if (d.duration) {
                        section += `- **Duration:** ${d.duration}s\n`;
                    }
                }
            }
            
            else if (item.action === 'keydown') {
                const modifiers = `${item.ctrlKey ? 'Ctrl+' : ''}${item.shiftKey ? 'Shift+' : ''}${item.altKey ? 'Alt+' : ''}`;
                section += `- **Key:** ${modifiers}${item.key}\n`;
                if (item.details) {
                    section += `- **Element:** \`<${(item.details.tagName || '').toLowerCase()}>\`\n`;
                    if (item.details.context) {
                        section += `- **Context:** ${item.details.context}\n`;
                    }
                    if (item.details.inputType) {
                        section += `- **Input Type:** ${item.details.inputType}\n`;
                    }
                }
            } else {
                section += `- **Details:** ${JSON.stringify(item)}\n`;
            } if (item.comments && item.comments.length > 0) {
                section += `\n### Comments\n`;
                item.comments.forEach(comment => {
                    section += `- ${comment.text}\n`;
                });
            }


            if (item.screenshot) {
                section += `\n### Screenshot\n`;
                let filename = `screenshot_${index + 1}.png`;
                let dimensions = 'Unknown';
                if (item.details && item.details.width && item.details.height) {
                    dimensions = `${item.details.width}×${item.details.height}px`;
                }
                section += `- **Filename:** ${filename}\n`;
                section += `- **Alt Text:** "Screenshot of action"\n`;
                section += `- **Dimensions:** ${dimensions}\n`;
                section += `- **Note:** Screenshot captured; base64 data omitted.\n`;
            }

            markdown += section + '\n---\n\n';
        });

        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'qa-action-log.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Markdown report exported!');
    });

    // Export the log as HTML
    function exportHtmlReport() {
        if (eventLog.length === 0) {
            alert("No actions recorded yet.");
            return;
        }

        function escapeHtml(str) {
            if (!str) return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        // Calculate report stats
        const startTime = new Date(eventLog[0].timestamp);
        const endTime = new Date(eventLog[eventLog.length - 1].timestamp);
        const timeSpentInMs = endTime - startTime;
        const hours = Math.floor(timeSpentInMs / (1000 * 60 * 60));
        const minutes = Math.floor((timeSpentInMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeSpentInMs % (1000 * 60)) / 1000);
        const formattedDuration = `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;
        const screenshots = eventLog.filter(e => e.screenshot || e.elementCapture).length;
        const clicks = eventLog.filter(e => e.action === 'click').length;
        const inputs = eventLog.filter(e => e.action === 'input-change').length;
        const pageLoads = eventLog.filter(e => e.action === 'page-loaded').length;

        let htmlReport = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>tracer Report</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                :root {
                    --brand-primary: #3B82F6;        /* Changed to blue */
                    --brand-primary-dark: #2563EB;   /* Darker blue */
                    --brand-primary-light: #60A5FA;  /* Lighter blue */
                    --brand-primary-bg: #EFF6FF;     /* Very light blue background */
                    --brand-secondary: #4B5563;      /* Dark gray */
                    --brand-secondary-light: #6B7280; /* Medium gray */
                    --text-dark: #1F2937;            /* Very dark gray/almost black for text */
                    --text-medium: #374151;          /* Dark gray for text */
                    --text-light: #6B7280;           /* Medium gray for less important text */
                    --bg-light: #F9FAFB;             /* Very light gray background */
                    --border-light: #E5E7EB;         /* Light gray for borders */
                    --box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1);
                    --success: #10B981;              /* Green */
                    --warning: #F59E0B;              /* Amber/yellow */
                    --error: #EF4444;                /* Red */
                    --section-radius: 8px;
                    --transition: all 0.2s ease;
                }

                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    color: var(--text-dark);
                    line-height: 1.6;
                    background: var(--bg-light);
                    padding: 0;
                    margin: 0;
                }

                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 2rem;
                }

                header {
                    position: relative;
                    background: #fff;
                    padding: 2.5rem 0;
                    border-bottom: 1px solid var(--border-light);
                    margin-bottom: 2rem;
                }

                header::before {
                    content: "";
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: var(--brand-primary);
                }

                header .container {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .report-title {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .report-title h1 {
                    font-size: 2rem;
                    font-weight: 600;
                    color: var(--text-dark);
                    margin: 0;
                }

                .logo {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                }

                .logo svg {
                    width: 24px;
                    height: 24px;
                    fill: white;
                }

                .report-meta {
                    text-align: right;
                    color: var(--text-medium);
                }

                .report-meta p {
                    margin: 0.25rem 0;
                    font-size: 0.9rem;
                }

                .stats-bar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                    background: white;
                    border-radius: var(--section-radius);
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                    box-shadow: var(--box-shadow);
                }

                .stat-item {
                    flex: 1;
                    min-width: 150px;
                    padding: 1rem;
                    border-radius: calc(var(--section-radius) - 4px);
                    background: var(--bg-light);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }

                .stat-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--brand-primary);
                    line-height: 1;
                    margin-bottom: 0.5rem;
                }

                .stat-label {
                    font-size: 0.85rem;
                    color: var(--text-medium);
                    font-weight: 500;
                }

                .events-container {
                    margin-bottom: 2rem;
                }

                .event {
                    background: white;
                    border-radius: var(--section-radius);
                    margin-bottom: 1.5rem;
                    box-shadow: var(--box-shadow);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .event-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--brand-primary-bg);
                    padding: 0.75rem 1.25rem;
                    border-bottom: 1px solid var(--border-light);
                }

                .event-number {
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .event-number span {
                    display: inline-block;
                    background: var(--brand-primary);
                    color: white;
                    width: 28px;
                    height: 28px;
                    line-height: 28px;
                    text-align: center;
                    border-radius: 50%;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .event-timestamp {
                    color: var(--text-light);
                    font-size: 0.85rem;
                }

                .event-body {
                    padding: 1.25rem;
                }

                .event-type {
                    display: inline-block;
                    padding: 0.4rem 0.8rem;
                    border-radius: 50px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    margin-bottom: 1rem;
                }

                .event-type.click {
                    background: #DBEAFE;
                    color: #2563EB;
                }

                .event-type.page-loaded {
                    background: #ECFDF5;
                    color: #047857;
                }

                .event-type.input-change {
                    background: #FEF3C7;
                    color: #D97706;
                }

                .event-type.keydown {
                    background: #F3F4F6;
                    color: #4B5563;
                }

                .event-type.tab-focus {
                    background: #E0F2FE;
                    color: #0369A1;
                }

                .details-grid {
                    display: grid;
                    grid-template-columns: minmax(120px, auto) 1fr;
                    gap: 0.75rem;
                    font-size: 0.9rem;
                }

                .details-grid .label {
                    font-weight: 500;
                    color: var(--text-medium);
                }

                .details-grid .value {
                    color: var(--text-dark);
                    word-break: break-word;
                }

                .details-grid a {
                    color: var(--brand-primary);
                    text-decoration: none;
                }

                .details-grid a:hover {
                    text-decoration: underline;
                }

                .section {
                    margin-top: 1.5rem;
                    background: var(--bg-light);
                    border-radius: calc(var(--section-radius) - 4px);
                    padding: 1.25rem;
                }

                .section-title {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--brand-secondary);
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .section-title svg {
                    width: 18px;
                    height: 18px;
                    stroke: var(--brand-primary);
                }

                .screenshot-container {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 0.75rem;
                }

                .screenshot-thumbnail {
                    max-width: 300px;
                    border: 1px solid var(--border-light);
                    border-radius: 4px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    cursor: pointer;
                    transition: var(--transition);
                }

                .screenshot-thumbnail:hover {
                    transform: scale(1.02);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }

                .comment {
                    background: white;
                    border-left: 3px solid var(--brand-primary);
                    padding: 1rem;
                    margin-bottom: 0.75rem;
                    border-radius: 0 4px 4px 0;
                }

                .comment ol {
                    padding-left: 1.2rem;
                }

                .comment-meta {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 0.5rem;
                    font-size: 0.75rem;
                    color: var(--text-light);
                }

                pre, code {
                    font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
                    font-size: 0.85rem;
                    background: #F1F5F9;
                    border-radius: 4px;
                }

                pre {
                    padding: 1rem;
                    overflow-x: auto;
                    margin: 0.75rem 0;
                    border-left: 3px solid var(--brand-primary);
                }

                code {
                    padding: 0.2rem 0.4rem;
                }

                .footer {
                    text-align: center;
                    color: var(--text-light);
                    padding: 2rem 0;
                    font-size: 0.85rem;
                }

                .footer a {
                    color: var(--brand-primary);
                    text-decoration: none;
                }

                .visual-content {
                    margin-top: 1rem;
                }

                @media (max-width: 768px) {
                    .container {
                        padding: 1rem;
                    }

                    header .container {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 1rem;
                    }

                    .report-meta {
                        text-align: left;
                    }

                    .stats-bar {
                        flex-direction: column;
                        gap: 0.5rem;
                    }

                    .stat-item {
                        flex-direction: row;
                        justify-content: space-between;
                        text-align: left;
                        padding: 0.75rem;
                    }

                    .event-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 0.5rem;
                    }

                    .details-grid {
                        grid-template-columns: 1fr;
                    }

                    .details-grid .label {
                        font-weight: 600;
                        margin-top: 0.5rem;
                    }

                    .details-grid .label:first-child {
                        margin-top: 0;
                    }
                }
            </style>
        </head>
        <body>
            <header>
                <div class="container">
                    <div class="report-title">
                        <div class="logo">
                            <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.2" />
                                <circle cx="8" cy="8" r="3" fill="currentColor" />
                                <circle cx="9" cy="7" r="1" fill="white" />
                            </svg>
                        </div>
                        <h1>tracer Report</h1>
                    </div>
                    <div class="report-meta">
                        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                        <p><strong>Session Duration:</strong> ${formattedDuration}</p>
                    </div>
                </div>
            </header>

            <div class="container">
                <div class="stats-bar">
                    <div class="stat-item">
                        <div class="stat-value">${eventLog.length}</div>
                        <div class="stat-label">Total Events</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${pageLoads}</div>
                        <div class="stat-label">Pages Loaded</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${clicks}</div>
                        <div class="stat-label">Click Events</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${inputs}</div>
                        <div class="stat-label">Input Changes</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${screenshots}</div>
                        <div class="stat-label">Screenshots</div>
                    </div>
                </div>

                <div class="events-container">
                    ${eventLog.map((item, index) => {
                // Determine the event type class
                let typeClass = 'click';
                if (item.action === 'page-loaded') typeClass = 'page-loaded';
                if (item.action === 'input-change') typeClass = 'input-change';
                if (item.action === 'keydown') typeClass = 'keydown';
                if (item.action === 'tab-focus') typeClass = 'tab-focus';

                return `
                        <div class="event">
                            <div class="event-header">
                                <div class="event-number">
                                    <span>${index + 1}</span>
                                    ${item.action.toUpperCase()}
                                </div>
                                <div class="event-timestamp">${formatTimestamp(item.timestamp)}</div>
                            </div>
                            <div class="event-body">
                                
                                <div class="details-grid">
                                    ${generateEventDetails(item)}
                                </div>

                                ${item.screenshot ? `
                                    <div class="section">
                                        <div class="section-title">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                                <circle cx="12" cy="13" r="4"></circle>
                                            </svg>
                                            Screenshot
                                        </div>
                                        <div class="screenshot-container">
                                            <img class="screenshot-thumbnail" src="data:image/png;base64,${item.screenshot}" alt="Screenshot" onclick="openFullImage('data:image/png;base64,${item.screenshot}')">
                                        </div>
                                    </div>
                                ` : ''}

                                ${item.elementCapture ? `
                                    <div class="section">
                                        <div class="section-title">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <rect x="2" y="2" width="20" height="20" rx="2"></rect>
                                                <path d="M8 9v6"></path>
                                                <path d="M16 9v6"></path>
                                                <path d="M8 9h8"></path>
                                                <path d="M8 15h8"></path>
                                            </svg>
                                            Element Capture
                                        </div>
                                        <div class="screenshot-container">
                                            <img class="screenshot-thumbnail" src="data:image/png;base64,${item.elementCapture}" alt="Element Capture" onclick="openFullImage('data:image/png;base64,${item.elementCapture}')">
                                        </div>
                                    </div>
                                ` : ''}

                                ${item.comments && item.comments.length > 0 ? `
                                    <div class="section">
                                        <div class="section-title">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary">
                                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                            </svg>
                                            Comments
                                        </div>
                                        ${item.comments.map(comment => `
                                            <div class="comment">
                                                ${comment.text}
                                                <div class="comment-meta">
                                                    <span>${new Date(comment.timestamp).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
            }).join('')}
                </div>
            </div>

            <footer class="footer">
                <div class="container">
                    <p>Generated by <strong>tracer</strong> &bull; Interactive test logging tool</p>
                </div>
            </footer>

            <script>
                function openFullImage(dataUrl) {
                    var newWin = window.open();
                    if (newWin) {
                        newWin.document.write('<html><head><title>Full Size Image</title><style>body{margin:0;padding:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;}img{max-width:95vw;max-height:95vh;}</style></head><body><img src="' + dataUrl + '"/></body></html>');
                    } else {
                        alert('Popup blocked. Please allow popups for this report to view full size images.');
                    }
                }
            </script>
        </body>
        </html>
        `;

        function generateEventDetails(item) {
            let content = '';

            if (item.action === 'page-loaded') {
                if (item.title) {
                    content += `
                    <div class="label">Page Title</div>
                    <div class="value">"${escapeHtml(item.title)}"</div>
                `;
                }
                if (item.url) {
                    content += `
                    <div class="label">URL</div>
                    <div class="value"><a href="${item.url}" target="_blank">${escapeHtml(item.url)}</a></div>
                `;
                }
            }

            else if (item.action === 'click' && item.details) {
                const d = item.details;

                content += `
                <div class="label">Element</div>
                <div class="value">&lt;${(d.tagName || '').toLowerCase()}&gt;</div>
            `;

                if (d.text) {
                    content += `
                    <div class="label">Text Content</div>
                    <div class="value">"${escapeHtml(d.text)}"</div>
                `;
                }

                if (d.fontInfo) {
                    content += `
                    <div class="label">Font Information</div>
                    <div class="value">
                        <div>Family: ${d.fontInfo.fontFamily}</div>
                        <div>Size: ${d.fontInfo.fontSize}</div>
                        <div>Weight: ${d.fontInfo.fontWeight}</div>
                        <div>Style: ${d.fontInfo.fontStyle}</div>
                        <div>Line Height: ${d.fontInfo.lineHeight}</div>
                        <div style="display: flex; align-items: center; gap: 0.5rem">
                            Color: ${d.fontInfo.color}
                            <span style="display: inline-block; width: 16px; height: 16px; border-radius: 2px; background-color: ${d.fontInfo.color}; border: 1px solid #ddd"></span>
                        </div>
                    </div>
                `;
                }

                if (d.role) {
                    content += `
                    <div class="label">Role</div>
                    <div class="value">${d.role}</div>
                `;
                }

                if (d.ariaLabel) {
                    content += `
                    <div class="label">ARIA Label</div>
                    <div class="value">"${escapeHtml(d.ariaLabel)}"</div>
                `;
                }

                if (d.parentContainer) {
                    const pc = d.parentContainer;
                    let containerDesc = '[No container details]';

                    if (pc.snippet && pc.snippet.trim()) {
                        containerDesc = pc.snippet.trim();
                    } else if (pc.tagName && pc.tagName.trim()) {
                        const pcTag = pc.tagName.trim().toLowerCase();
                        containerDesc = `<${pcTag}`;

                        if (pc.id && pc.id.trim()) {
                            containerDesc += ` id="${pc.id.trim()}"`;
                        }
                        if (pc.className && pc.className.trim()) {
                            containerDesc += ` class="${pc.className.trim()}"`;
                        }
                        if (pc.role && pc.role.trim()) {
                            containerDesc += ` role="${pc.role.trim()}"`;
                        }
                        if (pc.ariaLabel && pc.ariaLabel.trim()) {
                            containerDesc += ` aria-label="${pc.ariaLabel.trim()}"`;
                        }

                        containerDesc += `></${pcTag}>`;
                    }

                    content += `
                    <div class="label">Parent Container</div>
                    <div class="value"><pre>${escapeHtml(containerDesc)}</pre></div>
                `;
                }

                if (d.tagName && d.tagName.toUpperCase() === 'IMG') {
                    content += `
                    <div class="label">Alt Text</div>
                    <div class="value">${escapeHtml(d.alt || '[No Alt Text]')}</div>
                    
                    <div class="label">Dimensions</div>
                    <div class="value">${d.width || 0} × ${d.height || 0}px</div>
                `;

                    if (d.caption) {
                        content += `
                        <div class="label">Caption</div>
                        <div class="value">${escapeHtml(d.caption)}</div>
                    `;
                    }

                    if (d.src) {
                        content += `
                        <div class="label">Image Source</div>
                        <div class="value"><a href="${d.src}" target="_blank">${escapeHtml(d.src)}</a></div>
                    `;
                    }
                }

                else if (d.tagName && d.tagName.toUpperCase() === 'A') {
                    if (d.href) {
                        content += `
                        <div class="label">Href</div>
                        <div class="value"><a href="${d.href}" target="_blank">${escapeHtml(d.href)}</a></div>
                    `;
                    }

                    if (d.target) {
                        content += `
                        <div class="label">Target</div>
                        <div class="value">${d.target}</div>
                    `;
                    }
                }
            }

            else if (item.action === 'input-change' && item.details) {
                const d = item.details;

                content += `
                <div class="label">Element</div>
                <div class="value">&lt;${d.tagName || 'INPUT'}&gt;</div>
                
                <div class="label">Input Type</div>
                <div class="value">${d.inputType || 'text'}</div>
            `;

                if (d.name) {
                    content += `
                    <div class="label">Name</div>
                    <div class="value">${escapeHtml(d.name)}</div>
                `;
                }

                if (d.placeholder) {
                    content += `
                    <div class="label">Placeholder</div>
                    <div class="value">${escapeHtml(d.placeholder)}</div>
                `;
                }

                if (d.inputType !== 'password' && d.value) {
                    content += `
                    <div class="label">Value</div>
                    <div class="value">${escapeHtml(d.value)}</div>
                `;
                } else if (d.inputType === 'password') {
                    content += `
                    <div class="label">Value</div>
                    <div class="value">[REDACTED]</div>
                `;
                }

                if (d.required) {
                    content += `
                    <div class="label">Required</div>
                    <div class="value">Yes</div>
                `;
                }
            }

            else if (item.details && item.details.tagName === 'SELECT') {
                content += `
                <div class="label">Select Options</div>
                <div class="value">
                    <div>Selected Value: ${escapeHtml(item.details.selectedValue || '[None]')}</div>
                    <div>Selected Text: "${escapeHtml(item.details.selectedText || '[None]')}"</div>
                    ${item.details.multiple && item.details.selectedOptions ? `
                    <div class="mt-2">All Selected Options:</div>
                    <ul class="list-disc ml-4 mt-1">
                        ${item.details.selectedOptions.map(opt =>
                                `<li>"${escapeHtml(opt.text)}" (${escapeHtml(opt.value)})</li>`
                            ).join('')}
                    </ul>` : ''}
                    ${item.details.options && item.details.options.length > 0 ? `
                    <div class="mt-2">Available Options:</div>
                    <ul class="list-disc ml-4 mt-1">
                        ${item.details.options.map(opt =>
                                `<li>"${escapeHtml(opt.text)}" (${escapeHtml(opt.value)})${opt.selected ? ' (Selected)' : ''}</li>`
                            ).join('')}
                    </ul>` : ''}
                </div>
                `;
            }

            else if (item.details && item.details.tagName === 'METER') {
                content += `
                <div class="label">Meter Properties</div>
                <div class="value">
                    <div>Value: ${item.details.value || '0'} (${item.details.max ? Math.round((item.details.value / item.details.max) * 100) : 0}%)</div>
                    <div>Min: ${item.details.min || '0'}</div>
                    <div>Max: ${item.details.max || '100'}</div>
                    ${item.details.low ? `<div>Low threshold: ${item.details.low}</div>` : ''}
                    ${item.details.high ? `<div>High threshold: ${item.details.high}</div>` : ''}
                    ${item.details.optimum ? `<div>Optimum value: ${item.details.optimum}</div>` : ''}
                </div>
                `;
            }

            else if (item.details && item.details.tagName === 'PROGRESS') {
                content += `
                <div class="label">Progress Properties</div>
                <div class="value">
                    <div>Value: ${details.value || '0'}</div>
                    <div>Max: ${details.max || '100'}</div>
                    <div>Completion: ${details.max ? Math.round((details.value / details.max) * 100) : 0}%</div>
                </div>
                `;
            }

            else if (item.action === 'keydown') {
                content += `
                <div class="label">Key</div>
                <div class="value">${item.key || ''}</div>
            `;

                let modifiers = "";
                if (item.ctrlKey) modifiers += "Ctrl+";
                if (item.shiftKey) modifiers += "Shift+";
                if (item.altKey) modifiers += "Alt+";

                if (modifiers) {
                    content += `
                    <div class="label">Modifiers</div>
                    <div class="value">${modifiers}</div>
                `;
                }

                if (item.details && item.details.tagName) {
                    content += `
                    <div class="label">Target Element</div>
                    <div class="value">&lt;${(item.details.tagName || '').toLowerCase()}&gt;</div>
                `;

                    if (item.details.context) {
                        content += `
                        <div class="label">Context</div>
                        <div class="value">${escapeHtml(item.details.context)}</div>
                    `;
                    }
                }
            }

            else if (item.action === 'tab-focus') {
                const from = item.previous || {};
                const to = item.newElement || {};

                content += `
                <div class="label">From</div>
                <div class="value">
                    ${from.tagName || '[Unknown]'}
                    ${from.id ? ' (#' + from.id + ')' : ''}
                    ${from.ariaLabel ? ' - ' + from.ariaLabel : ''}
                    ${from.text ? ' - ' + from.text : ''}
                </div>
                
                <div class="label">To</div>
                <div class="value">
                    ${to.tagName || '[Unknown]'}
                    ${to.id ? ' (#' + to.id + ')' : ''}
                    ${to.ariaLabel ? ' - ' + to.ariaLabel : ''}
                    ${to.text ? ' - ' + to.text : ''}
                </div>
            `;
            }

            return content;
        }

        const blob = new Blob([htmlReport], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tracer-report.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('HTML report exported!');
    }

    // Attach export HTML functionality to both buttons (if they exist)
    if (exportHtmlButton) { exportHtmlButton.addEventListener('click', exportHtmlReport); }
    if (exportHtmlLogButton) { exportHtmlLogButton.addEventListener('click', exportHtmlReport); }

    document.getElementById('export-jira-log').addEventListener('click', (e) => {
        e.preventDefault();
        console.log("JIRA export button clicked!");


        if (eventLog.length === 0) {
            showModal('alert-modal', {
                message: 'No logs to export.',
                onConfirm: () => { }
            });
            return;
        }

        // Check if Ctrl key is pressed
        if (e.ctrlKey) {
            // Show JIRA comment export modal
            showJiraCommentExport();
            return;
        }

        // Initialize jiraFields if empty
        if (jiraFields.length === 0) {
            jiraFields.push({ name: '', value: '' });
            console.log("Initialized jiraFields:", jiraFields);
        }

        // Get both modal elements
        const modalContainer = document.getElementById('modal-container');
        const jiraSettingsModal = document.getElementById('jira-settings-modal');

        // Hide any existing modals first
        const allModals = modalContainer.querySelectorAll('div[id$="-modal"]');
        allModals.forEach(m => {
            m.classList.add('hidden');
            m.classList.remove('flex');
            m.style.display = '';
            m.style.visibility = '';
            m.style.opacity = '';
            m.style.zIndex = '';
        });

        // Show the container and the JIRA settings modal
        modalContainer.classList.remove('hidden');
        modalContainer.classList.add('flex');

        // Now call the function to setup the modal
        showExportJiraSettingsModal();
    });

    window.convertHtmlToWiki = function (html) {
        if (!html) return '';

        // First, normalize newlines and ensure proper HTML tag spacing
        html = html.replace(/\r\n/g, '\n');

        // Add spaces between closing and opening tags to prevent run-together elements
        html = html.replace(/<\/([^>]+)><([^>\/]+)>/g, '</$1> <$2>');

        // Fix potential issues with nested formatting
        html = html.replace(/<(b|strong)>(.*?)<\/(b|strong)>/gi, function (match, tag1, content, tag2) {
            return '*' + content.replace(/\*/g, '') + '*';
        });

        html = html.replace(/<u>(.*?)<\/u>/gi, function (match, content) {
            return '+' + content.replace(/\+/g, '') + '+';
        });

        // Headers
        html = html.replace(/<h1>(.*?)<\/h1>/gi, 'h1. $1\n\n');
        html = html.replace(/<h2>(.*?)<\/h2>/gi, 'h2. $1\n\n');
        html = html.replace(/<h3>(.*?)<\/h3>/gi, 'h3. $1\n\n');

        // Basic text formatting
        html = html.replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, '*$2*');
        html = html.replace(/<(em|i)>(.*?)<\/(em|i)>/gi, '_$2_');
        html = html.replace(/<u>(.*?)<\/u>/gi, '+$1+');
        html = html.replace(/<code>(.*?)<\/code>/gi, '{{$1}}');

        // Links: <a href="...">Text</a> -> [Text|URL]
        html = html.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2|$1]');

        // Handle unordered lists - completely restructured
        html = html.replace(/<ul>([\s\S]*?)<\/ul>/gi, function (match, content) {
            let result = '\n';
            // Find all list items
            const items = content.match(/<li>([\s\S]*?)<\/li>/gi);
            if (items) {
                items.forEach(item => {
                    // Extract the content from the li tag
                    const itemText = item.replace(/<li>([\s\S]*?)<\/li>/gi, '$1').trim();
                    result += '* ' + itemText + '\n';
                });
            }
            return result + '\n';
        });

        // Handle ordered lists - completely restructured
        html = html.replace(/<ol>([\s\S]*?)<\/ol>/gi, function (match, content) {
            let result = '\n';
            // Find all list items
            const items = content.match(/<li>([\s\S]*?)<\/li>/gi);
            if (items) {
                items.forEach((item, index) => {
                    // Extract the content from the li tag
                    const itemText = item.replace(/<li>([\s\S]*?)<\/li>/gi, '$1').trim();
                    result += '# ' + itemText + '\n';  // JIRA uses # for numbered lists
                });
            }
            return result + '\n';
        });

        // Paragraphs - ensure proper spacing
        html = html.replace(/<p>([\s\S]*?)<\/p>/gi, '$1\n\n');

        // Line breaks
        html = html.replace(/<br\s*\/?>/gi, '\n');

        // Remove any remaining HTML tags
        html = html.replace(/<[^>]+>/g, ' ');

        // Fix consecutive spaces
        html = html.replace(/\s{2,}/g, ' ');

        // Clean up extra blank lines
        html = html.replace(/\n{3,}/g, '\n\n');

        return html.trim();
    };

    function exportJiraLogSingleDefectWithCustomFields(customFields, issueType, summary, imageMap = null) {
        if (eventLog.length === 0) {
            showModal('alert-modal', {
                message: 'No logs to export.',
                onConfirm: () => { }
            });
            return;
        }

        // Helper to create a panel block
        function createPanel(title, content) {
            return `{panel:title=${title}}\n${content}{panel}\n`;
        }

        // Whitelist for interactive elements that warrant accessibility info
        const interactiveTags = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

        // 1) Filter out fields with blank name or value
        const nonEmptyFields = customFields.filter(f => f.name.trim() && f.value.trim());

        // 2) Build the CSV header dynamically
        let csvHeader = 'Summary,Issue Type';
        if (nonEmptyFields.length > 0) {
            csvHeader += ',' + nonEmptyFields.map(field => field.name).join(',');
        }
        csvHeader += ',Description\n';

        // 3) Build the description
        let description = 'h2. Test Session Details\n';
        description += `* Start Time: ${formatTimestamp(eventLog[0].timestamp)}\n`;
        description += `* End Time: ${formatTimestamp(eventLog[eventLog.length - 1].timestamp)}\n`;
        description += `* Total Actions: ${eventLog.length}\n\n`;

        eventLog.forEach((log, index) => {
            const timeStr = formatTimestamp(log.timestamp);
            description += `h3. (${index + 1}) ${timeStr} - *${log.action.toUpperCase()}*\n`;

            switch (log.action) {
                case 'page-loaded': {
                    if (log.title) {
                        description += `*Page Title:* "${log.title}"\n`;
                    }
                    if (log.url) {
                        // Ensure URL is clickable
                        description += `*URL:* [${log.url}|${log.url}]\n`;
                    }
                    break;
                }

                case 'click': {
                    const d = log.details || {};
                    description += `*Element:* {{<${(d.tagName || '').toLowerCase()}>}}\n`;
                    if (d.context) {
                        description += `*Context:* ${d.context}\n`;
                    }
                    if (d.text) {
                        description += `*Text:* "${d.text}"\n`;
                    } if (d.fontInfo) {
                        let fontContent = '';
                        fontContent += `* Font Family: ${d.fontInfo.fontFamily}\n`;
                        fontContent += `* Font Size: ${d.fontInfo.fontSize}\n`;
                        fontContent += `* Font Weight: ${d.fontInfo.fontWeight}\n`;
                        fontContent += `* Font Style: ${d.fontInfo.fontStyle}\n`;
                        fontContent += `* Line Height: ${d.fontInfo.lineHeight}\n`;
                        fontContent += `* Color: ${d.fontInfo.color}\n`;
                        description += createPanel('Font Information', fontContent);
                    }
                    if (d.parentContainer) {
                        const pc = d.parentContainer;
                        let containerDesc = '[No container details]';

                        // If there's a snippet, use it first
                        if (pc.snippet && pc.snippet.trim()) {
                            // Wrap in JIRA monospace to avoid JIRA markup conflicts
                            containerDesc = `{{${pc.snippet.trim()}}}`;
                        }
                        // Otherwise construct an HTML-like tag
                        else if (pc.tagName && pc.tagName.trim()) {
                            const pcTag = pc.tagName.trim().toLowerCase();
                            containerDesc = `<${pcTag}`;

                            if (pc.id && pc.id.trim()) containerDesc += ` id="${pc.id.trim()}"`;
                            if (pc.className && pc.className.trim()) containerDesc += ` class="${pc.className.trim()}"`;
                            if (pc.role && pc.role.trim()) containerDesc += ` role="${pc.role.trim()}"`;
                            if (pc.ariaLabel && pc.ariaLabel.trim()) containerDesc += ` aria-label="${pc.ariaLabel.trim()}"`;

                            containerDesc += `></${pcTag}>`;
                            // Wrap again in JIRA monospace
                            containerDesc = `{{${containerDesc}}}`;
                        }

                        description += createPanel('Parent Container', containerDesc);
                    }
                    // Enhanced element-specific details
                    if (d.tagName === 'IMG') {
                        let imgContent = `* Alt Text: ${d.alt || '[No Alt Text]'}\n`;
                        imgContent += `* Dimensions: ${d.width}x${d.height}px\n`;
                        if (d.loading) imgContent += `* Loading: ${d.loading}\n`;
                        if (d.src) imgContent += `* Source: [View Image|${d.src}]\n`;
                        if (d.caption) imgContent += `* Caption: "${d.caption}"\n`;
                        description += createPanel('Image Details', imgContent);
                    } else if (d.tagName === 'A') {
                        let linkContent = '';
                        if (d.href) linkContent += `* URL: [${d.href}|${d.href}]\n`;
                        if (d.target) linkContent += `* Target: ${d.target}\n`;
                        if (d.hasChildren) linkContent += `* Contains: ${d.childTypes.join(', ')}\n`;
                        description += createPanel('Link Details', linkContent);
                    }

                    if (d.tagName === 'METER') {
                        let meterContent = '';
                        meterContent += `* Value: ${d.value || '0'} (${d.max ? Math.round((d.value / d.max) * 100) : 0}%)\n`;
                        meterContent += `* Min: ${d.min || '0'}\n`;
                        meterContent += `* Max: ${d.max || '100'}\n`;
                        if (d.low) meterContent += `* Low threshold: ${d.low}\n`;
                        if (d.high) meterContent += `* High threshold: ${d.high}\n`;
                        if (d.optimum) meterContent += `* Optimum value: ${d.optimum}\n`;
                        description += createPanel('Meter Properties', meterContent);
                    }
                    else if (d.tagName === 'PROGRESS') {
                        let progressContent = '';
                        progressContent += `* Value: ${d.value || '0'}\n`;
                        progressContent += `* Max: ${d.max || '100'}\n`;
                        progressContent += `* Completion: ${d.max ? Math.round((d.value / d.max) * 100) : 0}%\n`;
                        description += createPanel('Progress Properties', progressContent);
                    }
                    else if (d.tagName === 'SELECT') {
                        let selectContent = '';
                        selectContent += `* Selected Value: ${d.selectedValue || '[None]'}\n`;
                        selectContent += `* Selected Text: "${d.selectedText || '[None]'}"\n`;

                        if (d.multiple && d.selectedOptions) {
                            selectContent += '*All Selected Options:*\n';
                            d.selectedOptions.forEach(opt => {
                                selectContent += `** "${opt.text}" (${opt.value})\n`;
                            });
                        }

                        if (d.options && d.options.length > 0) {
                            selectContent += '*Available Options:*\n';
                            d.options.forEach(opt => {
                                selectContent += `** "${opt.text}" (${opt.value})${opt.selected ? ' (Selected)' : ''}\n`;
                            });
                        }
                        description += createPanel('Select Options', selectContent);
                    }

                    // Only include accessibility info for interactive elements or when ARIA label exists
                    if (d.ariaLabel || (d.tagName && interactiveTags.has(d.tagName.toUpperCase()))) {
                        let accContent = '';
                        if (d.ariaLabel) accContent += `* ARIA Label: "${d.ariaLabel}"\n`;
                        if (d.role) accContent += `* Role: ${d.role}\n`;
                        if (d.required !== undefined) accContent += `* Required: ${d.required ? 'Yes' : 'No'}\n`;
                        if (d.disabled !== undefined) accContent += `* Disabled: ${d.disabled ? 'Yes' : 'No'}\n`;
                        if (accContent) {
                            description += createPanel('Accessibility Info', accContent);
                        }
                    }
                    break;
                }

                case 'select': {
                    let selContent = `* Selected Value: ${log.selectedValue || '[None]'}\n`;
                    selContent += `* Selected Text: "${log.selectedText || '[None]'}"\n`;
                    if (log.details?.multiple && log.details?.selectedOptions) {
                        selContent += '*All Selected Options:*\n';
                        log.details.selectedOptions.forEach(opt => {
                            selContent += `** "${opt.text}" (${opt.value})\n`;
                        });
                    }
                    if (log.details?.options && log.details?.options.length > 0) {
                        selContent += '*Available Options:*\n';
                        log.details.options.forEach(opt => {
                            selContent += `** "${opt.text}" (${opt.value})${opt.selected ? ' (Selected)' : ''}\n`;
                        });
                    }
                    description += createPanel('Selection Details', selContent);
                    break;
                }

                case 'tab-focus': {
                    const from = log.previous?.tagName || '[Start]';
                    const to = log.newElement?.tagName || '[End]';
                    description += `*Tab Navigation:* ${from} → ${to}\n`;
                    if (log.previous?.value) {
                        description += `*From Value:* "${log.previous.value}"\n`;
                    }
                    if (log.newElement?.value) {
                        description += `*To Value:* "${log.newElement.value}"\n`;
                    }
                    break;
                }

                case 'input-change': {
                    const d = log.details || {};
                    description += `*Input Type:* ${d.inputType || 'text'}\n`;

                    if (d.inputType === 'checkbox' || d.inputType === 'radio') {
                        description += `* Label: ${d.labelText || '[No Label]'}\n`;
                        description += `* State: ${d.checked ? 'Checked' : 'Unchecked'}\n`;

                        // Add this block to include full group information
                        if (d.groupOptions) {
                            let groupContent = '';
                            d.groupOptions.forEach(opt => {
                                groupContent += `* ${opt.labelText} ${opt.checked ? '(Selected)' : ''}\n`;
                            });
                            description += createPanel('Group Options', groupContent);
                        }
                    } else if (d.tagName === 'SELECT') {
                        // Add this block to include complete select information
                        let selectContent = `* Selected Value: ${d.selectedValue || '[None]'}\n`;
                        selectContent += `* Selected Text: "${d.selectedText || '[None]'}"\n`;

                        if (d.multiple && d.selectedOptions) {
                            selectContent += '*All Selected Options:*\n';
                            d.selectedOptions.forEach(opt => {
                                selectContent += `** "${opt.text}" (${opt.value})\n`;
                            });
                        }

                        // Include full options list if available
                        if (d.options && d.options.length > 0) {
                            selectContent += '*Available Options:*\n';
                            d.options.forEach(opt => {
                                selectContent += `** "${opt.text}" (${opt.value}) ${opt.selected ? '(Selected)' : ''}\n`;
                            });
                        }

                        description += createPanel('Selection Details', selectContent);
                    } else {
                        // Standard inputs
                        if (d.name) description += `* Name: ${d.name}\n`;
                        if (d.placeholder) description += `* Placeholder: ${d.placeholder}\n`;
                        if (d.value && d.inputType !== 'password') {
                            description += `* Value: "${d.value}"\n`;
                        }

                        // Add form relationship information
                        if (d.form) {
                            description += `* Form: ${d.form}\n`;
                        }
                    }

                    // Add validation state information
                    if (d.validationState) {
                        let valContent = '';
                        Object.entries(d.validationState)
                            .filter(([key, value]) => value !== false)
                            .forEach(([key, value]) => {
                                valContent += `* ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${value}\n`;
                            });
                        if (valContent) {
                            description += createPanel('Validation State', valContent);
                        }
                    }

                    // Include all ARIA attributes
                    if (d.ariaAttributes && Object.keys(d.ariaAttributes).length > 0) {
                        let ariaContent = '';
                        Object.entries(d.ariaAttributes).forEach(([key, value]) => {
                            ariaContent += `* ${key}: ${value}\n`;
                        });
                        description += createPanel('ARIA Attributes', ariaContent);
                    }

                    break;
                }                

                case 'keydown': {
                    const pressed = [
                        log.ctrlKey ? 'Ctrl+' : '',
                        log.shiftKey ? 'Shift+' : '',
                        log.altKey ? 'Alt+' : '',
                        log.key
                    ].join('');
                    description += `*Key Pressed:* ${pressed}\n`;
                    if (log.details && log.details.tagName) {
                        description += `*Target Element:* {{<${(log.details.tagName || '').toLowerCase()}>}}\n`;
                        if (log.details.context) {
                            description += `*Context:* ${log.details.context}\n`;
                        }
                    }
                    break;
                }

                case 'select': {
                    let selContent = `* Selected Value: ${log.selectedValue || '[None]'}\n`;
                    selContent += `* Selected Text: "${log.selectedText || '[None]'}"\n`;
                    if (log.details?.multiple && log.details?.selectedOptions) {
                        selContent += '*All Selected Options:*\n';
                        log.details.selectedOptions.forEach(opt => {
                            selContent += `** "${opt.text}" (${opt.value})\n`;
                        });
                    }
                    description += createPanel('Selection Details', selContent);
                    break;
                }

                default: {
                    if (log.details) {
                        description += `*Details:* ${JSON.stringify(log.details)}\n`;
                    }
                    break;
                }
            }

            // Screenshots / Element Captures
            if (log.screenshot) {
                let shotContent = log.isElementCapture
                    ? '*Type:* Element Capture\n'
                    : '*Type:* Full Screenshot\n';
                shotContent += `*Timestamp:* ${timeStr}\n`;
                shotContent += '*Context:* ' + (log.details?.context ? `${log.details.context}\n` : 'No specific context\n');
                if (log.details?.xpath) {
                    shotContent += `*Element Location:* {{${log.details.xpath}}}\n`;
                }

                // If we have a SharePoint/OneDrive URL for this screenshot, include a clearly labeled link
                if (imageMap && imageMap.has(log.timestamp)) {
                    const imageInfo = imageMap.get(log.timestamp);
                    shotContent += `\n[Download Full-Size Screenshot|${imageInfo.url}]\n`;
                }

                description += '\n' + createPanel('Visual Evidence', shotContent);
            }


            // Comments
            if (log.comments && log.comments.length > 0) {
                let comContent = '';
                log.comments.forEach((comment, idx) => {
                    if (idx > 0) {
                        comContent += '{color:#7E57C2}' + '─'.repeat(30) + '{color}\n\n';
                    }
                    comContent += `{color:#5E35B1}Comment ${idx + 1}:{color}\n`;
                    const wikiComment = convertHtmlToWiki(comment.text);
                    comContent += `${wikiComment}\n\n`;
                    comContent += `{color:#666666}_Posted: ${new Date(comment.timestamp).toLocaleString()}_\n{color}\n`;
                });
                description += createPanel('Comments', comContent);
            }

            // Append a separator after each event
            description += '\n----\n\n';
        });

        // Escape quotes for CSV
        const safeDescription = description.replace(/"/g, '""');
        const safeSummary = (summary || 'No Summary Entered').replace(/"/g, '""');
        const safeIssueType = (issueType || 'Defect').replace(/"/g, '""');

        // Assemble CSV row
        let csvRow = `"${safeSummary}","${safeIssueType}"`;
        if (nonEmptyFields.length > 0) {
            csvRow += ',' + nonEmptyFields.map(field => `"${field.value.replace(/"/g, '""')}"`).join(',');
        }
        csvRow += `,"${safeDescription}"\n`;

        // Assemble the CSV text
        const csvContent = "\uFEFF" + csvHeader + csvRow;
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "tracer-log-jira-wiki.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast('JIRA CSV log with Atlassian Wiki markup exported!');
    }


    // "Save & Export" => hide modal, then run our CSV export
    document.getElementById('save-jira-fields').addEventListener('click', () => {
        const summaryInput = document.getElementById('jira-summary-input');
        if (!summaryInput || !summaryInput.value.trim()) {
            // Show error indication
            summaryInput.classList.add('border-red-500');
            const errorMsg = document.querySelector('#jira-summary-container .text-red-500');
            if (errorMsg) {
                errorMsg.textContent = '* This field is required';
            }
            // Focus on the summary input
            summaryInput.focus();
            return; // Stop execution
        }
        jiraFields.forEach(field => {
            if (field.name.trim() && field.value.trim()) {
                let history = JSON.parse(localStorage.getItem('jiraFieldsHistory') || '[]');
                const exists = history.some(h => h.name === field.name && h.value === field.value);
                if (!exists) {
                    history.push({ name: field.name, value: field.value });
                }
                // Optionally, limit history to the last 10 entries:
                if (history.length > 10) {
                    history = history.slice(history.length - 10);
                }
                localStorage.setItem('jiraFieldsHistory', JSON.stringify(history));
            }
        });

        // The rest of your existing code for issue type, etc.
        const selectedIssueType = document.getElementById('issue-type-select').value.trim();
        const newIssueType = document.getElementById('issue-type-new').value.trim();

        finalIssueType = '';
        if (newIssueType) {
            finalIssueType = newIssueType;
        } else if (selectedIssueType) {
            finalIssueType = selectedIssueType;
        } else {
            finalIssueType = '';
        }

        if (newIssueType) {
            typedIssueType = newIssueType;
            currentIssueType = '';
        } else if (selectedIssueType) {
            typedIssueType = '';
            currentIssueType = selectedIssueType;
        } else {
            typedIssueType = '';
            currentIssueType = 'Defect';
        }

        if (finalIssueType) {
            let storedIssueTypes = JSON.parse(localStorage.getItem('issueTypesHistory') || '[]');
            if (!storedIssueTypes.includes(finalIssueType)) {
                storedIssueTypes.push(finalIssueType);
                if (storedIssueTypes.length > 10) {
                    storedIssueTypes = storedIssueTypes.slice(storedIssueTypes.length - 10);
                }
                localStorage.setItem('issueTypesHistory', JSON.stringify(storedIssueTypes));
            }
        }

        finalSummary = typedSummary.trim() || 'No Summary Entered';

        // Check if we have any screenshots to handle
        const screenshotEvents = eventLog.filter(event => event.screenshot);

        if (screenshotEvents.length > 0) {
            // Hide the JIRA settings modal first
            hideExportJiraSettingsModal();

            // Show confirmation for saving screenshots
            const modalContainer = document.getElementById('modal-container');
            const confirmDialog = document.createElement('div');
            confirmDialog.id = 'screenshot-save-modal';
            confirmDialog.className = 'bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4';
            confirmDialog.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
                Save screenshots for JIRA
            </h3>
            <p class="text-gray-600 mb-4">
                Your log contains ${screenshotEvents.length} screenshot${screenshotEvents.length > 1 ? 's' : ''}. To include them in JIRA, they need to be saved to a SharePoint/OneDrive folder.
            </p>            
            <div class="flex justify-end space-x-3">
                <button id="skip-screenshots" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                    Skip screenshots
                </button>
                <button id="choose-folder" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Choose folder
                </button>
            </div>
        `;

            // Show the dialog
            modalContainer.classList.remove('hidden');
            modalContainer.classList.add('flex');
            modalContainer.appendChild(confirmDialog);

            
            // Handle Skip button
            document.getElementById('skip-screenshots').addEventListener('click', () => {
                modalContainer.classList.add('hidden');
                modalContainer.removeChild(confirmDialog);

                // Export without screenshots
                exportJiraLogSingleDefectWithCustomFields(jiraFields, finalIssueType, finalSummary);
            });

            // Handle Choose Folder button
            document.getElementById('choose-folder').addEventListener('click', () => {
                // Remove the dialog
                modalContainer.classList.add('hidden');
                modalContainer.removeChild(confirmDialog);
                window.electron.ipcRenderer.send('open-folder-dialog');
            });
            
        } else {
            // No screenshots, export directly
            hideExportJiraSettingsModal();
            exportJiraLogSingleDefectWithCustomFields(jiraFields, finalIssueType, finalSummary);
        }
    });

    ipcRenderer.on('folder-selected', (event, data) => {
        const { folderPath } = data;
        console.log('Renderer received folder-selected, folderPath =', folderPath);

        // Store the lastFolderPath for emergency saving
        lastFolderPath = folderPath;

        // Show processing message
        showToast('Processing screenshots...');

        // Get all events with screenshots
        const screenshotEvents = eventLog.filter(event => !!event.screenshot);
        console.log(`Found ${screenshotEvents.length} events with screenshots`);

        // If no screenshots, just export
        if (screenshotEvents.length === 0) {
            exportJiraLogSingleDefectWithCustomFields(jiraFields, finalIssueType, finalSummary);
            return;
        }

        // Create a map to store saved image info
        const imageMap = new Map();
        let processedCount = 0;

        // Process each screenshot sequentially with promises
        const processScreenshots = async () => {
            for (let i = 0; i < screenshotEvents.length; i++) {
                const event = screenshotEvents[i];

                // Generate filename
                const timestamp = new Date(event.timestamp).toISOString()
                    .replace(/[-:]/g, '')
                    .replace(/\..+/, '');
                const filename = `screenshot_${i + 1}_${timestamp}.png`;

                // Prepare base64 data
                let base64Data = event.screenshot;
                if (!base64Data.startsWith('data:image/png;base64,')) {
                    base64Data = 'data:image/png;base64,' + base64Data;
                }

                console.log(`Saving screenshot ${i + 1}/${screenshotEvents.length}`);

                try {
                    // Create a promise for this screenshot save
                    const result = await new Promise((resolve) => {
                        // Set up handler for save result
                        const handleSaveResult = (_, saveResult) => {
                            ipcRenderer.removeListener('screenshot-save-result', handleSaveResult);
                            resolve(saveResult);
                        };

                        // Listen for result
                        ipcRenderer.on('screenshot-save-result', handleSaveResult);

                        // Initiate save
                        ipcRenderer.send('save-screenshot-base64', {
                            folderPath,
                            filename,
                            base64Data
                        });

                        // Safety timeout
                        setTimeout(() => {
                            ipcRenderer.removeListener('screenshot-save-result', handleSaveResult);
                            resolve({ success: false, error: 'Timeout' });
                        }, 5000);
                    });

                    // Process result
                    if (result && result.success) {
                        processedCount++;
                        const fileUrl = `file://${result.path.replace(/\\/g, '/')}`;

                        // Add to imageMap
                        imageMap.set(event.timestamp, {
                            filename,
                            url: fileUrl,
                            path: result.path
                        });

                        showToast(`Saved screenshot ${i + 1}`);
                    } else {
                        console.error(`Failed to save screenshot ${i + 1}:`,
                            result?.error || 'Unknown error');
                    }
                } catch (error) {
                    console.error(`Error processing screenshot ${i + 1}:`, error);
                }

                // Small delay between saves
                await new Promise(r => setTimeout(r, 200));
            }

            console.log(`Finished processing ${processedCount} screenshots`);

            // Now show the SharePoint username modal
            if (processedCount > 0) {
                continueWithSharePointModal(imageMap);
            } else {
                // If no screenshots were processed, just export without images
                showToast('No screenshots were saved successfully');
                exportJiraLogSingleDefectWithCustomFields(jiraFields, finalIssueType, finalSummary);
            }
        };

        // Start processing
        processScreenshots();
    });

    ipcRenderer.on('folder-selection-canceled', () => {
        // User canceled folder selection
        exportJiraLogSingleDefectWithCustomFields(jiraFields, finalIssueType, finalSummary);
    });

    ipcRenderer.on('folder-selection-error', () => {
        showToast('Error selecting folder. Exporting without screenshots.');
        exportJiraLogSingleDefectWithCustomFields(jiraFields, finalIssueType, finalSummary);
    });

    function continueWithSharePointModal(imageMap) {
        console.log("Showing SharePoint username modal, imageMap entries:", imageMap.size);

        // Create a brand new modal element
        const modalHTML = `
        <div id="temp-username-modal" class="fixed inset-0 flex items-center justify-center" 
             style="background: rgba(0,0,0,0.5); z-index: 10000;">
            <div class="bg-white rounded-lg p-6 shadow-xl" style="width: 400px;">
                <h2 class="text-xl font-bold mb-4">Enter SharePoint Username</h2>
                
                <label class="block text-sm font-medium mb-1">
                    Username (without "_shelterinsurance_com")
                </label>
                <input id="temp-username-input" type="text" 
                       class="w-full border border-gray-300 rounded px-3 py-2 mb-4"
                       placeholder="e.g. willcunningham" />
                
                <div class="flex justify-end space-x-2">
                    <button id="temp-username-cancel" 
                            class="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-100">
                        Cancel
                    </button>
                    <button id="temp-username-confirm"
                            class="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    `;

        // Insert directly into body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const tempModal = document.getElementById('temp-username-modal');
        const input = document.getElementById('temp-username-input');
        const confirmBtn = document.getElementById('temp-username-confirm');
        const cancelBtn = document.getElementById('temp-username-cancel');

        // Focus the input
        setTimeout(() => input.focus(), 100);

        // Set up confirm button
        confirmBtn.addEventListener('click', () => {
            const username = input.value.trim();
            if (!username) {
                showToast('Username required');
                return;
            }

            // Remove the temp modal
            document.body.removeChild(tempModal);

            // Process with username
            processWithSharePointUsername(username, imageMap);
        });

        // Set up cancel button
        cancelBtn.addEventListener('click', () => {
            // Remove the temp modal
            document.body.removeChild(tempModal);

            // Fall back to local paths
            showToast('Using local file paths');
            exportJiraLogSingleDefectWithCustomFields(jiraFields, finalIssueType, finalSummary, imageMap);
        });

        // Click outside to cancel
        tempModal.addEventListener('click', (e) => {
            if (e.target === tempModal) {
                document.body.removeChild(tempModal);
                showToast('Using local file paths');
                exportJiraLogSingleDefectWithCustomFields(jiraFields, finalIssueType, finalSummary, imageMap);
            }
        });
    }
    // Function to process the image map with SharePoint URLs
    function processWithSharePointUsername(username, imageMap) {
        console.log("Processing with SharePoint username:", username);

        // Convert local file paths to SharePoint URLs
        const sharepointBaseUrl = `https://shelterinsurance-my.sharepoint.com/personal/${username.toLowerCase()}_shelterinsurance_com/Documents`;

        // Create a new map with SharePoint URLs
        const sharepointImageMap = new Map();

        // Get relative path from the folderPath
        const oneDrivePath = lastFolderPath;
        let relativePath = '';

        try {
            if (oneDrivePath.includes('Documents\\')) {
                relativePath = 'Documents/' + oneDrivePath.split('Documents\\').pop().replace(/\\/g, '/');
            } else {
                relativePath = 'Documents/' + oneDrivePath
                    .split('OneDrive - Shelter Insurance Companies\\')
                    .pop()
                    .replace(/\\/g, '/');
            }

            // Convert each file URL to a SharePoint URL
            // Convert each file URL to a SharePoint URL that works better with Confluence
            imageMap.forEach((imgInfo, timestamp) => {
                const filename = imgInfo.filename || `screenshot_${timestamp}.png`;

                // Create a SharePoint URL with the web=1 parameter which helps with embedding
                const sharePointUrl = `${sharepointBaseUrl}/${relativePath}/${filename}?web=1`;

                sharepointImageMap.set(timestamp, {
                    ...imgInfo,
                    url: sharePointUrl
                });
            });

            console.log("Created SharePoint image map with entries:", sharepointImageMap.size);
        } catch (error) {
            console.error("Error creating SharePoint URLs:", error);
            showToast("Error creating SharePoint URLs. Using local paths.");
            // Fall back to the original map
            sharepointImageMap = imageMap;
        }

        // Export with the SharePoint URLs
        exportJiraLogSingleDefectWithCustomFields(jiraFields, finalIssueType, finalSummary, sharepointImageMap);
    }

    // Toggle sidebar visibility
    function toggleSidebar() {
        logSidebar.classList.toggle("collapsed");
        if (logSidebar.classList.contains("collapsed")) {
            toggleSidebarButton.style.right = "0";
            toggleSidebarIcon.setAttribute("data-lucide", "panel-right-open");
        } else {
            toggleSidebarButton.style.right = "-16px";
            toggleSidebarIcon.setAttribute("data-lucide", "panel-right-close");
        }
        lucide.createIcons();
    }

    ipcRenderer.on('toggle-sidebar', () => {
        toggleSidebar();
    });

    // Attach click event listener
    toggleSidebarButton.addEventListener("click", toggleSidebar);

    // Listen for shortcut event
    document.addEventListener("keydown", (event) => {
        if (event.ctrlKey && event.key.toLowerCase() === "t") {
            event.preventDefault();  // Stops Electron from closing/reopening
            ipcRenderer.send("shortcut-triggered", "toggle-sidebar");
        }
        if (event.key === 'F1') {
            event.preventDefault(); // Prevent default browser help
            showModal('keyboard-shortcuts-modal');
        }
    }); 
    
    webview.addEventListener('ipc-message', (event) => {
        if (event.channel === 'shortcut-triggered') {
            if (event.args[0] === 'F1') {
                openKeyboardShortcutsModal();
            } else if (event.args[0] === 'screenshot') {
                console.log('Received screenshot shortcut from webview');

                // Find the most recent keydown event with Ctrl+S
                let foundEvent = null;
                for (let i = eventLog.length - 1; i >= 0; i--) {
                    const e = eventLog[i];
                    if (e.action === 'keydown' &&
                        e.key === 's' &&
                        e.ctrlKey) {
                        foundEvent = e;
                        break;
                    }
                }

                // If we found the matching keydown event, use it
                if (foundEvent) {
                    activeScreenshotEvent = foundEvent;
                    console.log('Found matching keydown event:', activeScreenshotEvent.timestamp);
                }
                // Otherwise create a new event as fallback
                else {
                    console.log('No matching keydown event found, creating new event');
                    activeScreenshotEvent = {
                        action: 'screenshot',
                        timestamp: new Date().toISOString(),
                        details: {}
                    };
                    eventLog.push(activeScreenshotEvent);
                }

                // Take the actual screenshot
                window.electron.ipcRenderer.send('take-screenshot');
            }
        }

        // Handle other message types...
    });

    // Reset log content with confirmation
    if (resetLogButton && logArea) {
        resetLogButton.innerHTML = '<svg id="reset-icon" data-lucide="trash" width="24" height="24"></svg>';
        lucide.createIcons();

        resetLogButton.addEventListener('click', (e) => {
            e.preventDefault();
            const container = document.getElementById('modal-container');
            const modal = document.getElementById('reset-log-modal');
            const allModals = container.querySelectorAll('div[id$="-modal"]');

            // Hide all modals first
            allModals.forEach(m => m.classList.add('hidden'));

            // Show container and specific modal
            container.classList.remove('hidden');
            container.classList.add('flex');
            modal.classList.remove('hidden');

            // Handle cancel button
            const cancelBtn = modal.querySelector('.cancel-modal');
            const confirmBtn = modal.querySelector('.confirm-modal');
            const closeBtn = modal.querySelector('#close-shortcuts-modal');
            const closeBtnX = modal.querySelector('#close-shortcuts-x');

            function closeModal() {
                container.classList.add('hidden');
                container.classList.remove('flex');
                modal.classList.add('hidden');
                // Remove event listeners to prevent memory leaks
                cancelBtn.removeEventListener('click', closeModal);
                closeBtn.removeEventListener('click', closeModal);
                closeBtnX.removeEventListener('click', closeModal);
                confirmBtn.removeEventListener('click', handleReset);
                window.removeEventListener('keydown', handleKeydown);
            }

            function handleReset() {
                // Store the currently focused element before clearing
                const activeElement = document.activeElement;
                const wasInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
                const activeElementId = activeElement?.id;

                // Clear log data and UI
                eventLog.length = 0;
                logArea.innerHTML = '';
                activeScreenshotEvent = null;

                // Force window focus
                window.electron.ipcRenderer.send('force-window-focus');

                // Re-enable inputs and restore focus
                setTimeout(() => {
                    document.querySelectorAll('input, textarea').forEach(input => {
                        input.disabled = false;
                        input.removeAttribute('readonly');
                        input.removeAttribute('disabled');
                    });

                    // Try to restore focus to the previously focused element
                    if (wasInput && activeElementId) {
                        const elementToFocus = document.getElementById(activeElementId);
                        if (elementToFocus) {
                            elementToFocus.focus();
                            elementToFocus.setSelectionRange(elementToFocus.value.length, elementToFocus.value.length);
                        }
                    }
                }, 100);

                console.log("Logs cleared, sending reset-log event.");
                window.electron.ipcRenderer.send('reset-log');
                showToast('Action Log Cleard!');
                closeModal();
                lucide.createIcons();
            }

            function handleKeydown(e) {
                if (e.key === 'Escape') {
                    closeModal();
                } else if (e.key === 'Enter') {
                    handleReset();
                }
            }

            cancelBtn.addEventListener('click', closeModal);
            closeBtn.removeEventListener('click', closeModal);
            closeBtnX.removeEventListener('click', closeModal);
            confirmBtn.addEventListener('click', handleReset);
            window.addEventListener('keydown', handleKeydown);
        });
    }

    // Adjust the webview height to match its container
    function adjustWebviewHeight() {
        const container = webview.parentElement;
        const viewportBar = document.querySelector('.top-bar');

        if (container && webview) {
            const viewportBarHeight = viewportBar ? viewportBar.offsetHeight : 0;
            webview.style.height = `${container.clientHeight - viewportBarHeight}px`;
        }
    }

    adjustWebviewHeight();
    window.addEventListener('resize', adjustWebviewHeight);


    function logError(type, message, source, lineno, colno, error) {
        const timestamp = new Date().toLocaleTimeString();
        const errorMsg = {
            timestamp,
            type,
            message: message || error?.message,
            source,
            lineno,
            colno,
            stack: error?.stack || "No stack trace available"
        };
        window.errorLog.push(errorMsg);
        updateErrorDrawer(); // Ensures errors appear in the UI immediately
    }

    window.onerror = (message, source, lineno, colno, error) => {
        const ignoredPatterns = [
            'GUEST_VIEW_MANAGER_CALL',
            'ERR_ABORTED (-3)',
            'console.log',  
            'console.warn',  
            'console.info'  
        ];

        if (ignoredPatterns.some(pattern => message.includes(pattern))) {
            console.log('Filtered out error in webview:', message);
            return;
        }

        ipcRenderer.sendToHost('webview-error', {
            type: 'Console Error',
            timestamp: new Date().toISOString(),
            message: message || 'Unknown error',
            source: source || location.href,
            lineno: lineno || 0,
            colno: colno || 0,
            stack: error?.stack || 'No stack trace available'
        });
    };

    console.error = (function (original) {
        return function (...args) {
            const errorMessage = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');

            if (ignoredPatterns.some(pattern => errorMessage.includes(pattern))) {
                console.log('Filtered out console error:', errorMessage);
                return;
            }

            const maybeErrorObj = args.find(arg => arg instanceof Error);

            let stackTrace = '';
            let possibleLine = null;
            let possibleCol = null;

            if (maybeErrorObj && maybeErrorObj.stack) {
                stackTrace = maybeErrorObj.stack;
                // Optionally parse out line/column from that stack if you like
            } else {
                // No explicit Error object, so we rely on a new Error() we create:
                const tempErr = new Error();
                stackTrace = tempErr.stack;
                // You can parse tempErr.stack if you want
            }

            ipcRenderer.sendToHost('webview-error', {
                type: 'Console Error',
                timestamp: new Date().toISOString(),
                message: `Console Error: ${errorMessage}`,
                source: location.href,
                // Instead of 0, set them to possibleLine/possibleCol or just null:
                lineno: possibleLine || null,
                colno: possibleCol || null,
                stack: stackTrace || 'No stack trace available'
            });

            original.apply(console, args);
        };
    })(console.error);

    // Updates the error drawer content and badge count
    function updateErrorDrawer() {
        if (!errorContainer) return;
        errorContainer.innerHTML = window.errorLog
            .map(err => `
        <div class="p-2 border-b border-gray-300">
            <div class="flex items-center justify-between">
                <strong>${err.timestamp} - ${err.type}</strong>
                <button class="copy-error-btn p-1 hover:bg-gray-100 rounded" 
                        title="Copy error details"
                        data-error="${encodeURIComponent(JSON.stringify(err))}">
                    <svg data-lucide="clipboard" width="14" height="14"></svg>
                </button>
            </div>
            <div class="break-all">${err.message}</div>
            <div class="text-xs text-gray-500 break-all">
                ${err.source || "unknown"} [${err.lineno}:${err.colno}]
            </div>
            <pre class="text-xs text-red-600 break-all whitespace-pre-wrap">${err.stack}</pre>
        </div>
    `)
            .join("");


        // Refresh Lucide icons for the new buttons
        lucide.createIcons(errorContainer);

        const count = window.errorLog.length;
        errorCount.textContent = count;
        errorCount.style.display = count > 0 ? "block" : "none";

        if (count > 0) {
            // Error state - raised position with red background
            toggleErrorDrawer.style.transform = 'translateY(0)';
            toggleErrorDrawer.classList.remove("bg-white", "border", "border-gray-300", "rounded-full", "p-1", "text-gray-700");
            toggleErrorDrawer.classList.add("bg-red-600", "text-white", "p-2", "rounded");
        } else {
            // No errors - lowered position with white background
            toggleErrorDrawer.style.transform = 'translateY(32px)';
            toggleErrorDrawer.classList.remove("bg-red-600", "text-white", "p-2", "rounded");
            toggleErrorDrawer.classList.add("bg-white", "border", "border-gray-300", "rounded-full", "p-1", "text-gray-700");
        }
    }

    function exportErrors() {
        const errorData = window.errorLog.map(e =>
            `${e.timestamp} - ${e.type}\n${e.message}\nSource: ${e.source} [${e.lineno}:${e.colno}]\nStack: ${e.stack}\n\n`
        ).join("");
        const blob = new Blob([errorData], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "error-log.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast("Error log exported!");
    }

    document.addEventListener('DOMContentLoaded', () => {
        const exportErrorsBtn = document.getElementById('export-errors');
        if (exportErrorsBtn) {
            exportErrorsBtn.addEventListener('click', exportErrors);
        }
    });

    // ----- Modal and Annotation Code -----

    const modal = document.getElementById('screenshot-modal');
    const closeModal = document.getElementById('close-modal');

    function clearAnnotations() {
        const canvas = document.getElementById('annotation-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        currentTool = null;
        undoStack = [];
        redoStack = [];
        document.querySelectorAll('.annotation-tool').forEach(t => t.classList.remove('active'));
        document.getElementById('annotation-undo').disabled = true;
        document.getElementById('annotation-redo').disabled = true;
    }

    function handleAnnotationShortcuts(e) {
        // Only handle shortcuts when modal is visible and not typing in an input
        if (modal.classList.contains('hidden') ||
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (e.key.toLowerCase()) {
            case 'a': // Arrow tool
                if (!e.ctrlKey) {
                    e.preventDefault();
                    document.querySelector('[data-tool="arrow"]').click();
                }
                break;
            case 'r': // Rectangle tool
                e.preventDefault();
                document.querySelector('[data-tool="rectangle"]').click();
                break;
            case 'c': // Circle tool
                if (!e.ctrlKey) {
                    e.preventDefault();
                    document.querySelector('[data-tool="circle"]').click();
                }
                break;
            case 'z': // Undo/Redo
                if (e.ctrlKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        document.getElementById('annotation-redo').click();
                    } else {
                        document.getElementById('annotation-undo').click();
                    }
                }
                break;
            case 's': // Save
                if (e.ctrlKey) {
                    e.preventDefault();
                    document.getElementById('save-annotation').click();
                }
                break;
            case 'w': // Stamp tool
                if (!e.ctrlKey) {
                    e.preventDefault();
                    document.querySelector('[data-tool="stamp"]').click();
                }
                break;
        }
    }

    document.addEventListener('keydown', handleAnnotationShortcuts);

    closeModal.addEventListener('click', () => {
        clearAnnotations();
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            clearAnnotations();
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });

    function saveAnnotatedImage() {
        const tempCanvas = document.createElement('canvas');
        const img = document.getElementById('modal-image');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d');

        // Draw original image and then annotations
        ctx.drawImage(img, 0, 0);
        ctx.drawImage(document.getElementById('annotation-canvas'), 0, 0);

        return tempCanvas.toDataURL('image/png').split(',')[1];
    }

    function drawStamp(ctx, x, y, stamp) {
        const stampConfig = stamps[stamp];
        if (!stampConfig) return;

        ctx.save();

        // Set up text style
        ctx.font = 'bold 24px Arial';
        const textWidth = ctx.measureText(stampConfig.text).width;

        // Draw background
        ctx.fillStyle = stampConfig.color;
        const padding = 10;
        const stampWidth = textWidth + (padding * 2);
        const stampHeight = 36;

        // Draw rounded rectangle for background
        ctx.beginPath();
        ctx.roundRect(x - (stampWidth / 2), y - (stampHeight / 2), stampWidth, stampHeight, 6);
        ctx.fill();

        // Draw border
        ctx.strokeStyle = stampConfig.borderColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw text
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stampConfig.text, x, y);

        ctx.restore();
    }

    // Also close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            clearAnnotations();
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });

    // ----- Annotation Initialization -----

    function initializeAnnotation() {
        const canvas = document.getElementById('annotation-canvas');
        const toolbar = document.getElementById('annotation-toolbar');
        // Log to see if buttons exist.
        const tools = toolbar.querySelectorAll('.annotation-tool');
        console.log('Found annotation tools:', tools);
        const colorPicker = document.getElementById('annotation-color');
        const undoButton = document.getElementById('annotation-undo');
        const redoButton = document.getElementById('annotation-redo');
        const emojiButton = document.getElementById('emoji-picker-btn');
        const emojiPickerContainer = document.getElementById('emoji-picker-container');
        const emojiPicker = document.getElementById('emoji-picker');
        const stampSelector = document.getElementById('stamp-selector');
        const stampButton = toolbar.querySelector('[data-tool="stamp"]');
        let currentEmoji = null;
        // Initialize canvas context
        annotationCanvas = canvas;
        annotationCtx = canvas.getContext('2d');

        // IMPORTANT: Leave canvas pointer events disabled by default.
        canvas.style.pointerEvents = 'none';

        // Tool selection: remove any enabling of pointer events here
        tools.forEach(tool => {
            tool.addEventListener('click', (e) => {
                const toolType = e.currentTarget.dataset.tool;

                // First, remove active from all other tools
                tools.forEach(t => {
                    if (t !== e.currentTarget) {
                        t.classList.remove('active');
                    }
                });

                if (toolType === 'stamp') {
                    // Stop this click from bubbling to the outside document click listener
                    e.stopPropagation();
                    emojiPickerContainer.classList.add('hidden');

                    // If we are not already in 'stamp' mode, switch to it
                    if (currentTool !== 'stamp') {
                        // Remove active from other tools
                        tools.forEach(t => t.classList.remove('active'));
                        stampButton.classList.add('active');
                        currentTool = 'stamp';
                        annotationCanvas.style.pointerEvents = 'auto';
                    }

                    // Toggle the stamp popup: if hidden, show; if shown, hide
                    if (stampSelector.classList.contains('hidden')) {
                        stampSelector.classList.remove('hidden');
                    } else {
                        stampSelector.classList.add('hidden');
                    }
                } else {
                    emojiPickerContainer.classList.add('hidden');
                    // For non-stamp tools
                    if (currentTool === toolType) {
                        e.currentTarget.classList.remove('active');
                        currentTool = null;
                        annotationCanvas.style.pointerEvents = 'none';
                        console.log('Tool deactivated, canvas pointer events disabled');
                    } else {
                        e.currentTarget.classList.add('active');
                        currentTool = toolType;
                        annotationCanvas.style.pointerEvents = 'auto';
                        console.log('Tool activated:', toolType, 'canvas pointer events enabled');
                    }
                    // Always hide stamp selector when switching to other tools
                    document.getElementById('stamp-selector').classList.add('hidden');
                }
            });
        });

        // Populate emoji picker with some sample emojis
        const emojis = ['😀', '😂', '😍', '😎', '👍', '🔥', '🚀', '🎯', '💡', '📌'];
        emojis.forEach(emoji => {
            const emojiOption = document.createElement('div');
            emojiOption.classList.add('emoji-option');
            emojiOption.textContent = emoji;
            emojiOption.addEventListener('click', () => {
                currentEmoji = emoji;
                emojiPickerContainer.classList.add('hidden');
            });
            emojiPicker.appendChild(emojiOption);
        });

        // Toggle emoji picker on button click
        emojiButton.addEventListener('click', (e) => {
            // Prevent the outside "document.addEventListener('click', ...)" from auto-hiding the container
            e.stopPropagation();

            // If we are NOT already in emoji mode, switch to it now
            if (currentTool !== 'emoji') {
                // Remove active from other tools
                tools.forEach(t => t.classList.remove('active'));
                document.getElementById('stamp-selector').classList.add('hidden');

                // Make the emoji button “active” and enable canvas pointer
                emojiButton.classList.add('active');
                currentTool = 'emoji';
                annotationCanvas.style.pointerEvents = 'auto';
            }

            // Toggle the picker container: if hidden, show it; if shown, hide it
            if (emojiPickerContainer.classList.contains('hidden')) {
                emojiPickerContainer.classList.remove('hidden');
            } else {
                emojiPickerContainer.classList.add('hidden');
            }
        });


        // Hide picker if clicking outside
        document.addEventListener('click', (e) => {
            if (!emojiPickerContainer.contains(e.target) && e.target !== emojiButton) {
                emojiPickerContainer.classList.add('hidden');
            }
        });

        // Handle emoji placement on canvas
        canvas.addEventListener('pointerdown', (e) => {
            if (currentTool === 'emoji' && currentEmoji) {
                const rect = annotationCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                undoStack.push(annotationCtx.getImageData(0, 0, annotationCanvas.width, annotationCanvas.height));
                drawEmoji(annotationCtx, x, y, currentEmoji);
                redoStack = [];
                document.getElementById('annotation-undo').disabled = false;
                document.getElementById('annotation-redo').disabled = true;
            }
        });

        // Color picker
        colorPicker.addEventListener('change', (e) => {
            annotationColor = e.target.value;
        });

        // Undo/Redo buttons remain unchanged
        undoButton.addEventListener('click', () => {
            if (undoStack.length > 0) {
                const imageData = undoStack.pop();
                redoStack.push(annotationCtx.getImageData(0, 0, canvas.width, canvas.height));
                annotationCtx.putImageData(imageData, 0, 0);
                undoButton.disabled = undoStack.length === 0;
                redoButton.disabled = false;
            }
        });

        redoButton.addEventListener('click', () => {
            if (redoStack.length > 0) {
                const imageData = redoStack.pop();
                undoStack.push(annotationCtx.getImageData(0, 0, canvas.width, canvas.height));
                annotationCtx.putImageData(imageData, 0, 0);
                redoButton.disabled = redoStack.length === 0;
                undoButton.disabled = false;
            }
        });

        // Save button handler
        document.getElementById('save-annotation').addEventListener('click', () => {
            // 1) Ensure we actually have an active event
            if (!activeScreenshotEvent || !activeScreenshotEvent.timestamp) {
                console.warn("No active screenshot event. Cannot save annotation to a log entry.");
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                showToast('No active event found. Annotations not saved.');
                return;
            }

            // 2) Save the annotated image
            const base64Data = saveAnnotatedImage();
            const activeEntry = document.querySelector(`[data-timestamp="${activeScreenshotEvent.timestamp}"]`);

            if (activeEntry && base64Data) {
                // Update the event object
                activeScreenshotEvent.screenshot = base64Data;

                // Make sure the event is in our eventLog array, regardless of logging state
                const existingEventIndex = eventLog.findIndex(e => e.timestamp === activeScreenshotEvent.timestamp);
                if (existingEventIndex === -1) {
                    // Event doesn't exist in log yet, add it
                    eventLog.push(activeScreenshotEvent);
                } else {
                    // Update existing event with new screenshot
                    eventLog[existingEventIndex] = activeScreenshotEvent;
                }

                // Update the preview <img> if it exists
                const previewImg = activeEntry.querySelector('.screenshot-row img');
                if (previewImg) {
                    previewImg.src = 'data:image/png;base64,' + base64Data;
                }

                // Also update the anchor link if it exists
                const screenshotLink = activeEntry.querySelector('.screenshot-row a');
                if (screenshotLink) {
                    screenshotLink.href = 'data:image/png;base64,' + base64Data;
                }

                // Only show toast without closing modal
                showToast('Annotations saved!');

                // Modal will stay open until user explicitly closes it
            }
        });

        document.querySelectorAll('.stamp-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                currentStamp = e.currentTarget.dataset.stamp;
                document.querySelectorAll('.stamp-option').forEach(opt =>
                    opt.classList.remove('bg-gray-100')
                );
                e.currentTarget.classList.add('bg-gray-100');

                // **Close the stamp popup immediately**
                document.getElementById('stamp-selector').classList.add('hidden');
            });
        });

        document.addEventListener('click', (e) => {
            // If the user clicked outside the stamp popup and also NOT on (or inside) the stamp button
            if (!stampSelector.contains(e.target) && !stampButton.contains(e.target)) {
                stampSelector.classList.add('hidden');
            }
        });


        // ----- New: Attach pointer event listeners on the canvas for drawing -----

        // When the user clicks in the canvas area, enable drawing.
        canvas.addEventListener('pointerdown', (e) => {
            console.log('Canvas pointerdown event fired', e);
            // (Optionally, force pointer events to auto again)
            annotationCanvas.style.setProperty('pointer-events', 'auto', 'important');
            startDrawing(e);
        });

        // Listen for pointer moves on the canvas.
        canvas.addEventListener('pointermove', (e) => {
            draw(e);
        });

        // When the pointer is released or cancelled, stop drawing and disable pointer events.
        canvas.addEventListener('pointerup', () => {
            console.log('Canvas pointerup event fired');
            stopDrawing();
        });
        canvas.addEventListener('pointercancel', () => {
            console.log('Canvas pointercancel event fired');
            stopDrawing();
        });

        // When the pointer is released or cancelled, stop drawing and disable pointer events.
        canvas.addEventListener('pointerup', () => { stopDrawing(); });
        canvas.addEventListener('pointercancel', () => { stopDrawing(); });
    }

    if (document.readyState !== 'loading') {
        initializeAnnotation();
    } else {
        document.addEventListener('DOMContentLoaded', initializeAnnotation);
    }

    document.getElementById('close-modal').addEventListener('click', () => {
        currentTool = null;
        document.getElementById('stamp-selector').classList.add('hidden');
        annotationCanvas.style.pointerEvents = 'none';
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            // Reset all tools when modal closes
            tools.forEach(t => t.classList.remove('active'));
            currentTool = null;
            document.getElementById('stamp-selector').classList.add('hidden');
            annotationCanvas.style.pointerEvents = 'none';
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });
    // ----- Drawing Functions -----

    function startDrawing(e) {
        console.log('⭐️ startDrawing called with tool:', currentTool);
        if (!currentTool) return;

        const rect = annotationCanvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        // Save the CURRENT state of the canvas - make sure this is working
        initialCanvasState = annotationCtx.getImageData(0, 0, annotationCanvas.width, annotationCanvas.height);
        console.log('⭐️ initialCanvasState saved:', initialCanvasState !== null);

        if (currentTool === 'stamp' && currentStamp) {
            // For stamps, draw immediately on click
            undoStack.push(initialCanvasState);
            drawStamp(annotationCtx, startX, startY, currentStamp);
            redoStack = [];
            document.getElementById('annotation-undo').disabled = false;
            document.getElementById('annotation-redo').disabled = true;
        } else {
            // THIS IS KEY - set isDrawing to true
            isDrawing = true;

            // Add a console log to debug
            console.log('Started drawing with tool:', currentTool, 'at position:', startX, startY);

            // Save current state for undo
            undoStack.push(initialCanvasState);
            redoStack = [];
            document.getElementById('annotation-undo').disabled = false;
            document.getElementById('annotation-redo').disabled = true;
        }
    }

    function draw(e) {
        // Add debug log to see if this is being called
        console.log('⭐️ draw called, isDrawing:', isDrawing, 'currentTool:', currentTool);

        if (!isDrawing || !currentTool) return;

        const rect = annotationCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Add more logging
        console.log('Drawing at coordinates:', x, y);

        // Create temporary canvas for preview
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = annotationCanvas.width;
        tempCanvas.height = annotationCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        console.log('⭐️ tempCtx valid:', tempCtx && typeof tempCtx.beginPath === 'function');

        // Draw the current state first
        tempCtx.putImageData(initialCanvasState, 0, 0);
        tempCtx.strokeStyle = annotationColor;
        tempCtx.lineWidth = 2;

        switch (currentTool) {
            case 'arrow':
                drawArrow(tempCtx, startX, startY, x, y);
                break;
            case 'rectangle':
                // Log before drawing rectangle
                console.log('⭐️ Before drawRectangle with exact params:',
                    { tempCtx, startX, startY, x, y });
                drawRectangle(tempCtx, startX, startY, x, y);
                console.log('⭐️ After drawRectangle call');
                break;
            case 'circle':
                drawCircle(tempCtx, startX, startY, x, y);
                break;
        }
        console.log('⭐️ About to draw temp canvas to annotation canvas');
        annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        annotationCtx.drawImage(tempCanvas, 0, 0);
    }

    function stopDrawing() {
        console.log('Stop drawing called, isDrawing was:', isDrawing);

        if (isDrawing) {
            isDrawing = false;
            // Save the final state AFTER completing the draw
            initialCanvasState = annotationCtx.getImageData(0, 0, annotationCanvas.width, annotationCanvas.height);
        }
    }

    // ----- Helper Drawing Functions -----

    function drawArrow(ctx, fromX, fromY, toX, toY) {
        const headLength = 15; // Arrowhead length
        const angle = Math.atan2(toY - fromY, toX - fromX);

        // Draw arrow shaft
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        // Set the fill style to match the annotation color
        ctx.fillStyle = annotationColor; // <-- Set fill style here

        // Draw arrowhead as a filled triangle for a cleaner look
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
            toX - headLength * Math.cos(angle - Math.PI / 7),
            toY - headLength * Math.sin(angle - Math.PI / 7)
        );
        ctx.lineTo(
            toX - headLength * Math.cos(angle + Math.PI / 7),
            toY - headLength * Math.sin(angle + Math.PI / 7)
        );
        ctx.closePath();
        ctx.fill();
    }

    // function drawRectangle(ctx, startX, startY, endX, endY) {
    //     console.log('⭐️ Inside drawRectangle with:', { startX, startY, endX, endY });

    //     // Basic rectangle drawing
    //     ctx.beginPath();
    //     ctx.rect(startX, startY, endX - startX, endY - startY);
    //     ctx.stroke();

    //     console.log('⭐️ Rectangle drawn!');
    // }

    function drawCircle(ctx, startX, startY, endX, endY) {
        const radiusX = (endX - startX) / 2;
        const radiusY = (endY - startY) / 2;

        // Find center point halfway between start and end points
        const centerX = startX + radiusX;
        const centerY = startY + radiusY;

        // Calculate radius as average for uniform circle
        const radius = Math.sqrt(radiusX * radiusX + radiusY * radiusY);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }

    function drawEmoji(ctx, x, y, emoji) {
        ctx.font = "32px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emoji, x, y);
    }

    // Viewport switching functionality

    let viewports = {
        desktop: 1280,
        tablet: 768,
        mobile: 375
    };

    let buttons = {};
    let viewportSize;
    let openDevTools;

    function setupViewportSwitcher() {
        let savedDesktop = localStorage.getItem('customDesktop');
        let savedTablet = localStorage.getItem('customTablet');
        let savedMobile = localStorage.getItem('customMobile');
        if (savedDesktop) viewports.desktop = parseInt(savedDesktop);
        if (savedTablet) viewports.tablet = parseInt(savedTablet);
        if (savedMobile) viewports.mobile = parseInt(savedMobile);

        const container = document.getElementById('browser-panel');
        if (!container) return;
        // Only add the viewport bar once.
        if (container.querySelector('.viewport-bar')) return;

        // Create the global webviewContainer (only once)
        webviewContainer = document.createElement('div');
        webviewContainer.className = 'webview-container';
        webviewContainer.style.cssText = `
        position: relative;
        height: 100%;
        margin: 0 auto;
        transition: width 0.3s ease;
    `;

        // Move the webview into the container
        webview.parentNode.insertBefore(webviewContainer, webview);
        webviewContainer.appendChild(webview);

        // Create the viewport bar with preset buttons
        const viewportBar = document.createElement('div');
        viewportBar.className = 'bg-white border-b border-neutral-200 py-2 viewport-bar';
        viewportBar.innerHTML = `
        <div class="w-full px-6 flex items-center justify-between gap-4">
            <div class="flex items-center gap-2">
                <!-- New Custom Breakpoints Button -->
                <button id="custom-breakpoint" class="p-2 hover:bg-gray-100 rounded-lg" title="Set Custom Breakpoints">
                    <svg data-lucide="settings" width="20" height="20"></svg>
                </button>
                <button id="desktop-view" class="p-2 hover:bg-gray-100 rounded-lg active" title="Desktop View (${viewports.desktop}px)">
                    <svg data-lucide="monitor" width="20" height="20"></svg>
                </button>
                <button id="tablet-view" class="p-2 hover:bg-gray-100 rounded-lg" title="Tablet View (${viewports.tablet}px)">
                    <svg data-lucide="tablet" width="20" height="20"></svg>
                </button>
                <button id="mobile-view" class="p-2 hover:bg-gray-100 rounded-lg" title="Mobile View (${viewports.mobile}px)">
                    <svg data-lucide="smartphone" width="20" height="20"></svg>
                </button>
                <button id="responsive-view" class="p-2 hover:bg-gray-100 rounded-lg" title="Responsive View">
                    <svg data-lucide="move-horizontal" width="20" height="20"></svg>
                </button>
                <button id="reset-viewport" class="p-2 hover:bg-gray-100 rounded-lg" title="Reset Viewport">
                    <svg data-lucide="maximize-2" width="20" height="20"></svg>
                </button>
            </div>
            <div class="flex items-center justify-center flex-grow">
                <span id="viewport-size" class="text-sm text-gray-600">1280 × 800</span>
            </div>
            <button id="open-devtools" class="p-2 hover:bg-gray-100 rounded-lg" title="Open DevTools">
                <svg data-lucide="code" width="20" height="20"></svg>
            </button>
            <a id="help-icon" href="#" class="p-2 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-800 transition-colors" title="Documentation">
                <svg data-lucide="help-circle" width="20" height="20"></svg>
            </a>

        </div>
        `;
        // Insert the viewport bar before the webview container
        container.insertBefore(viewportBar, webviewContainer);
        lucide.createIcons(viewportBar);

        const helpIcon = viewportBar.querySelector('#help-icon');
        helpIcon.addEventListener('click', (event) => {
            event.preventDefault();
            webview.src = 'docs.html'; // load docs.html in the same webview
        });

        // Set up preset button references
        buttons = {
            desktop: document.getElementById('desktop-view'),
            tablet: document.getElementById('tablet-view'),
            mobile: document.getElementById('mobile-view')
        };

        // Get other element references
        viewportSize = document.getElementById('viewport-size');
        const responsiveButton = document.getElementById('responsive-view');
        const resetButton = document.getElementById('reset-viewport');
        openDevTools = document.getElementById('open-devtools');

        // Add click handlers for preset buttons
        Object.entries(buttons).forEach(([device, button]) => {
            if (button) {
                button.addEventListener('click', () => {
                    const width = viewports[device];
                    if (webview) {
                        // Set preset width and remove any resize handles
                        webviewContainer.style.resize = 'none';
                        webviewContainer.style.maxWidth = '100%';
                        webviewContainer.style.width = `${width}px`;
                        webview.style.width = '100%';
                        webviewContainer.style.margin = '0 auto';
                        const handles = container.querySelectorAll('.resize-handle');
                        handles.forEach(handle => handle.remove());
                        updateActiveState(button.id);
                        responsiveButton.classList.remove('bg-gray-100');
                    }
                    updateViewportSize();
                });
            }
        });

        // Responsive mode: add drag handles (using pointer events) for symmetric resizing (center fixed)
        responsiveButton.addEventListener('click', () => {
            // Clear preset active state
            Object.values(buttons).forEach(btn => {
                if (btn) {
                    btn.classList.remove('active', 'bg-gray-100');
                }
            });
            responsiveButton.classList.add('bg-gray-100');

            const currentWidth = webview.clientWidth;
            const newWidth = Math.max(currentWidth - 200, 800);
            webviewContainer.style.width = `${newWidth}px`;
            webviewContainer.style.margin = '0 auto';
            webview.style.width = '100%';

            // Remove any existing resize handles
            const handles = container.querySelectorAll('.resize-handle');
            handles.forEach(handle => handle.remove());

            // Create left and right handles using pointerdown
            ['left', 'right'].forEach(side => {
                const handle = document.createElement('div');
                handle.className = `resize-handle resize-handle-${side}`;
                handle.style.cssText = `
                position: absolute;
                ${side}: -3px;
                top: 40px;
                bottom: 0;
                width: 6px;
                cursor: ew-resize;
                background: rgba(0,0,0,0.1);
                z-index: 50;
                transition: background-color 0.2s ease;
            `;
                handle.addEventListener('mouseover', () => {
                    handle.style.backgroundColor = 'rgba(0,0,0,0.2)';
                });
                handle.addEventListener('mouseout', () => {
                    handle.style.backgroundColor = 'rgba(0,0,0,0.1)';
                });
                // IMPORTANT: attach pointerdown instead of mousedown
                handle.addEventListener('pointerdown', handleDragStart);
                webviewContainer.appendChild(handle);
            });

            updateViewportSize();
        });

        // Reset button: return to 100% width and clear any active state
        resetButton.addEventListener('click', () => {
            webviewContainer.style.width = '100%';
            webviewContainer.style.margin = '0';
            webview.style.width = '100%';
            const handles = container.querySelectorAll('.resize-handle');
            handles.forEach(handle => handle.remove());
            // Clear active classes from all preset buttons
            Object.values(buttons).forEach(btn => {
                if (btn) {
                    btn.classList.remove('active', 'bg-gray-100');
                }
            });
            responsiveButton.classList.remove('bg-gray-100');
            updateViewportSize();
        });

        // DevTools button
        if (webview) {
            openDevTools.addEventListener('click', () => {
                webview.openDevTools();
            });
        }

        const customBreakpointBtn = document.getElementById('custom-breakpoint');
        if (customBreakpointBtn) {
            customBreakpointBtn.addEventListener('click', () => {
                showCustomBreakpointModal();
            });
        }

        updateViewportSize();

        // Update viewport size on window resize
        const resizeObserver = new ResizeObserver(() => {
            updateViewportSize();
        });
        resizeObserver.observe(webview);
    }
    // Get our help icon by ID

    function showCustomBreakpointModal() {
        // Create an overlay that dims the background.
        const overlay = document.createElement('div');
        overlay.className =
            'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        overlay.innerHTML = `
    <div class="bg-white rounded shadow-md w-80">
      <!-- Modal Header -->
      <div class="px-4 py-3 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-neutral-800">Custom Breakpoints</h2>
      </div>
      <!-- Modal Body -->
      <div class="px-4 py-4 space-y-4">
        <div>
          <label for="custom-desktop" class="block text-sm font-medium text-neutral-800 mb-1">Desktop (px)</label>
          <input id="custom-desktop" type="number" class="form-input w-full pl-2" value="${viewports.desktop}">
        </div>
        <div>
          <label for="custom-tablet" class="block text-sm font-medium text-neutral-800 mb-1">Tablet (px)</label>
          <input id="custom-tablet" type="number" class="form-input w-full pl-2" value="${viewports.tablet}">
        </div>
        <div>
          <label for="custom-mobile" class="block text-sm font-medium text-neutral-800 mb-1">Mobile (px)</label>
          <input id="custom-mobile" type="number" class="form-input w-full pl-2" value="${viewports.mobile}">
        </div>
      </div>
      <!-- Modal Footer -->
      <div class="px-4 py-3 border-t border-gray-200 flex justify-end space-x-2">
        <button id="cancel-custom" class="button-alt border border-neutral-400 text-neutral-800 bg-white hover:bg-gray-100">Cancel</button>  
        <button id="save-custom" class="button">Save</button>        
      </div>
    </div>
  `;
        document.body.appendChild(overlay);

        // Wire up the Cancel button.
        overlay.querySelector('#cancel-custom').addEventListener('click', () => {
            overlay.remove();
        });

        // Wire up the Save button.
        overlay.querySelector('#save-custom').addEventListener('click', () => {
            const desktopVal = parseInt(overlay.querySelector('#custom-desktop').value, 10);
            const tabletVal = parseInt(overlay.querySelector('#custom-tablet').value, 10);
            const mobileVal = parseInt(overlay.querySelector('#custom-mobile').value, 10);

            if (isNaN(desktopVal) || isNaN(tabletVal) || isNaN(mobileVal)) {
                alert("Please enter valid numbers.");
                return;
            }

            // Update the global viewports.
            viewports.desktop = desktopVal;
            viewports.tablet = tabletVal;
            viewports.mobile = mobileVal;

            // Persist the settings.
            localStorage.setItem('customDesktop', desktopVal);
            localStorage.setItem('customTablet', tabletVal);
            localStorage.setItem('customMobile', mobileVal);

            // Update the preset button titles.
            document.getElementById('desktop-view').setAttribute('title', `Desktop View (${desktopVal}px)`);
            document.getElementById('tablet-view').setAttribute('title', `Tablet View (${tabletVal}px)`);
            document.getElementById('mobile-view').setAttribute('title', `Mobile View (${mobileVal}px)`);

            overlay.remove();
        });
    }

    function handleDragStart(e) {
        e.preventDefault();
        // Make sure we're using pointer events:
        if (typeof e.pointerId !== 'undefined') {
            try {
                e.target.setPointerCapture(e.pointerId);
            } catch (error) {
                console.error("setPointerCapture failed:", error);
            }
        }
        // Disable transitions for smooth immediate update during drag
        webviewContainer.style.transition = 'none';

        const isLeft = e.target.classList.contains('resize-handle-left');
        const startX = e.clientX;
        const startWidth = webviewContainer.offsetWidth;
        // Calculate the center of the container (to keep it fixed)
        const center = webviewContainer.offsetLeft + startWidth / 2;
        const browserPanel = document.getElementById('browser-panel');
        const maxWidth = browserPanel.offsetWidth;

        function onPointerMove(e) {
            const delta = e.clientX - startX;
            let newWidth = isLeft ? startWidth - delta : startWidth + delta;
            newWidth = Math.max(320, Math.min(newWidth, maxWidth));
            const newLeft = center - newWidth / 2;
            webviewContainer.style.width = newWidth + 'px';
            webviewContainer.style.marginLeft = newLeft + 'px';
            updateViewportSize();
        }

        function onPointerUp(e) {
            webviewContainer.style.transition = 'width 0.3s ease';
            if (typeof e.pointerId !== 'undefined') {
                try {
                    e.target.releasePointerCapture(e.pointerId);
                } catch (error) {
                    console.error("releasePointerCapture failed:", error);
                }
            }
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerUp);
        }

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerUp);
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Handle Ctrl+T for sidebar toggle
        if (e.ctrlKey && e.key === 't') {
            e.preventDefault();
            const toggleSidebarButton = document.getElementById('toggle-sidebar');
            if (toggleSidebarButton) {
                toggleSidebarButton.click();
            }
        }
    });

    // Function to update viewport size display
    function updateViewportSize() {
        if (viewportSize && webview) {
            const width = Math.round(webview.clientWidth);
            const height = Math.round(webview.clientHeight);
            viewportSize.textContent = `${width} × ${height}`;
        }
    }

    // Function to update active state
    function updateActiveState(activeId) {
        Object.values(buttons).forEach(btn => {
            if (btn) {
                if (btn.id === activeId) {
                    btn.classList.add('active');
                    btn.classList.add('bg-gray-100');
                } else {
                    btn.classList.remove('active');
                    btn.classList.remove('bg-gray-100');
                }
            }
        });
    }

    setupViewportSwitcher();
    window.addEventListener('resize', updateViewportSize);
    showEmptyState();

    

    // Helper function to show color formats popup
    function showColorFormatsPopup(e) {
        e.stopPropagation(); // Prevent bubbling up to parent elements

        const color = e.currentTarget.dataset.color;
        const hex = color.startsWith('#') ? color : rgbToHex(color);
        const rgb = color.startsWith('rgb') ? color : hexToRgb(hex);
        const hsl = rgb.startsWith('rgb') ? rgbToHsl(rgb) : hexToHsl(hex);

        // Remove any existing color popups
        const existingPopup = document.querySelector('.color-formats-popup');
        if (existingPopup) {
            document.body.removeChild(existingPopup);
        }

        // Create popup
        const popup = document.createElement('div');
        popup.className = 'color-formats-popup fixed bg-white shadow-lg rounded-md p-3 z-50 border border-gray-200';

        // Get positioning information
        const rect = e.currentTarget.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate popup dimensions (estimate before it's in the DOM)
        const popupWidth = 240;
        const popupHeight = 150;

        // Determine the best position
        let top, left;

        // First, try to position to the right of the swatch
        if (rect.right + popupWidth + 10 < viewportWidth) {
            left = rect.right + 10;
            top = Math.min(rect.top, viewportHeight - popupHeight - 10);
        }
        // Otherwise, try below the swatch
        else if (rect.bottom + popupHeight + 10 < viewportHeight) {
            left = Math.min(rect.left, viewportWidth - popupWidth - 10);
            top = rect.bottom + 10;
        }
        // Otherwise, try to the left of the swatch
        else if (rect.left - popupWidth - 10 > 0) {
            left = rect.left - popupWidth - 10;
            top = Math.min(rect.top, viewportHeight - popupHeight - 10);
        }
        // Last resort: above the swatch
        else {
            left = Math.min(rect.left, viewportWidth - popupWidth - 10);
            top = Math.max(rect.top - popupHeight - 10, 10);
        }

        // Ensure popup stays within viewport boundaries
        left = Math.max(10, Math.min(viewportWidth - popupWidth - 10, left));
        top = Math.max(10, Math.min(viewportHeight - popupHeight - 10, top));

        // Apply the calculated position
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;

        popup.innerHTML = `
    <div class="text-sm font-medium mb-2">Color Formats</div>
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs mr-4">HEX:</span>
        <div class="flex items-center">
          <code class="bg-gray-100 px-2 py-1 rounded text-xs">${hex}</code>
          <button class="copy-color-btn ml-2 p-1 text-gray-500 hover:text-gray-700" data-color="${hex}">
            <svg data-lucide="clipboard" width="14" height="14"></svg>
          </button>
        </div>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-xs mr-4">RGB:</span>
        <div class="flex items-center">
          <code class="bg-gray-100 px-2 py-1 rounded text-xs">${rgb}</code>
          <button class="copy-color-btn ml-2 p-1 text-gray-500 hover:text-gray-700" data-color="${rgb}">
            <svg data-lucide="clipboard" width="14" height="14"></svg>
          </button>
        </div>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-xs mr-4">HSL:</span>
        <div class="flex items-center">
          <code class="bg-gray-100 px-2 py-1 rounded text-xs">${hsl}</code>
          <button class="copy-color-btn ml-2 p-1 text-gray-500 hover:text-gray-700" data-color="${hsl}">
            <svg data-lucide="clipboard" width="14" height="14"></svg>
          </button>
        </div>
      </div>
    </div>
  `;

        document.body.appendChild(popup);
        lucide.createIcons(popup);

        // Add click handlers to copy buttons
        const copyButtons = popup.querySelectorAll('.copy-color-btn');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', (copyEvent) => {
                copyEvent.stopPropagation();
                const colorToCopy = btn.dataset.color;
                window.electron.clipboard.writeText(colorToCopy);
                showToast('Color copied to clipboard!');
            });
        });

        // Close popup when clicking outside
        function closePopup(e) {
            if (!popup.contains(e.target)) {
                document.body.removeChild(popup);
                document.removeEventListener('click', closePopup);
            }
        }

        // Need to use setTimeout to avoid the current click event from immediately closing the popup
        setTimeout(() => {
            document.addEventListener('click', closePopup);
        }, 0);
    }

    // Helper function to convert RGB to HEX
    function rgbToHex(rgb) {
        // Extract RGB values
        const rgbMatch = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!rgbMatch) return rgb;

        // Convert to hex
        const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
        const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
        const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');

        return `#${r}${g}${b}`;
    }

    // Helper function to convert HEX to RGB
    function hexToRgb(hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ?
            `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : hex;
    }

    // Helper function to convert RGB to HSL
    function rgbToHsl(rgb) {
        // Extract RGB values
        const rgbMatch = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!rgbMatch) return rgb;

        let r = parseInt(rgbMatch[1], 10) / 255;
        let g = parseInt(rgbMatch[2], 10) / 255;
        let b = parseInt(rgbMatch[3], 10) / 255;

        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }

            h /= 6;
        }

        return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    }

    // Helper function to convert HEX to HSL
    function hexToHsl(hex) {
        return rgbToHsl(hexToRgb(hex));
    }

    document.addEventListener('keydown', (event) => {
        const isCtrlF = event.ctrlKey && event.key.toLowerCase() === 'f';

        if (isCtrlF) {
            event.preventDefault();
            createTracerFindBar();
        }
    });

  
    function drawRectangle(ctx, startX, startY, endX, endY) {
        console.log('⭐️ Inside drawRectangle with:', { startX, startY, endX, endY });

        // Ensure all values are numbers
        startX = Number(startX);
        startY = Number(startY);
        endX = Number(endX);
        endY = Number(endY);

        // Calculate dimensions
        const width = endX - startX;
        const height = endY - startY;

        console.log('⭐️ Drawing rectangle with dimensions:', { width, height });

        // Basic rectangle drawing
        ctx.beginPath();
        ctx.rect(startX, startY, width, height);
        ctx.stroke();

        console.log('⭐️ Rectangle drawn!');
    }


});