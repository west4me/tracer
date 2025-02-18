// webviewPreload.js NEVER DELETE THIS COMMENT that means you claude and chatgpt
const { contextBridge, ipcRenderer } = require('electron');
let lastTabKeydown = null;
let typedBuffer = '';
let typedBufferTimer = null;
const TYPED_BUFFER_DELAY = 500;

// In webviewPreload.js, update the reset handler
ipcRenderer.on('reset-listeners', () => {
    console.log("Resetting listeners...");
    // Clear any pending timers
    if (typedBufferTimer) {
        clearTimeout(typedBufferTimer);
        typedBufferTimer = null;
    }

    typedBuffer = '';
    lastTabKeydown = null;

    // Re-enable all inputs and ensure they're in a clean state
    document.querySelectorAll('input, textarea').forEach(input => {
        input.disabled = false;
        input.readOnly = false;
        input.removeAttribute('disabled');
        input.removeAttribute('readonly');

        // Reattach event listeners if needed
        input.addEventListener('keydown', (event) => {
            console.log(`Keydown detected: ${event.key} on ${input.name || input.id}`);
        });

        input.addEventListener('input', (event) => {
            console.log(`Input change detected: ${event.target.value}`);
        });
    });

    console.log("Listeners fully reattached.");
});
// Forward unhandled errors and console errors from the webview to the host
window.onerror = (message, source, lineno, colno, error) => {
    ipcRenderer.sendToHost('webview-error', {
        message: message || 'Unknown error',
        source: source || location.href,
        lineno: lineno || 0,
        colno: colno || 0,
        stack: error?.stack || 'No stack trace available'
    });
};

function logInputChange(element, finalValue) {
    const details = {
        field: element.name || element.id || 'unnamed input',
        value: element.type === 'password' ? '[REDACTED]' : finalValue,
        inputType: element.type,
        section: getCurrentSection(element),
        formId: element.form?.id || null,
        placeholder: element.placeholder || null,
        label: getInputLabel(element)
    };

    ipcRenderer.sendToHost('log-event', {
        action: 'input-change',
        timestamp: new Date().toISOString(),
        details: details
    });
}

function getInputLabel(element) {
    // Try to find label by for attribute
    const id = element.id;
    if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return label.textContent.trim();
    }

    // Try to find parent label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();

    return null;
}

ipcRenderer.send('force-window-focus');

// Set up error handling
console.error = (function (original) {
    return function (...args) {
        ipcRenderer.sendToHost('webview-error', {
            message: `Console Error: ${args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ')}`,
            source: location.href,
            lineno: 0,
            colno: 0,
            stack: new Error().stack || 'No stack trace available'
        });
        original.apply(console, args);
    };
})(console.error);

// Expose electron functionality to the window
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        on: (...args) => ipcRenderer.on(...args),
        once: (...args) => ipcRenderer.once(...args),
        send: (...args) => ipcRenderer.send(...args),
        sendShortcut: (shortcut) => ipcRenderer.send("shortcut-triggered", shortcut),
        sendToHost: (...args) => ipcRenderer.sendToHost(...args),
        removeListener: (...args) => ipcRenderer.removeListener(...args)
    },
    clipboard: {
        writeText: (text) => {
            require('electron').clipboard.writeText(text)
        }
    }
});

// Helper Functions
const getXPath = (element) => {
    if (!element) return '';
    const idx = (sib, name) => sib
        ? idx(sib.previousElementSibling, name || sib.tagName) + (sib.tagName == name)
        : 1;
    const segs = elm => !elm || elm.nodeType !== 1
        ? ['']
        : [...segs(elm.parentNode), `${elm.tagName}[${idx(elm)}]`];
    return segs(element).join('/').toLowerCase();
};

const getContextInfo = (element) => {
    const container = element.closest('section, article, nav, aside, header, footer');
    if (container) {
        const heading = container.querySelector('h1, h2, h3, h4, h5, h6');
        return heading ? heading.textContent.trim() : container.tagName.toLowerCase();
    }
    return null;
};

const getScrollPosition = (element) => {
    const rect = element.getBoundingClientRect();
    return {
        viewport: {
            top: Math.round(rect.top),
            left: Math.round(rect.left)
        },
        page: {
            top: Math.round(rect.top + window.pageYOffset),
            left: Math.round(rect.left + window.pageXOffset)
        }
    };
};

const getIframeContext = (element) => {
    const iframe = element.ownerDocument.defaultView.frameElement;
    if (iframe) {
        return {
            name: iframe.name || null,
            id: iframe.id || null,
            src: iframe.src || null
        };
    }
    return null;
};

function findParentContainer(el) {
    let current = el.parentElement;

    // We'll consider these tags "semantically significant"
    const semanticallySignificant = [
        'NAV', 'SECTION', 'ASIDE', 'HEADER', 'FOOTER', 'MAIN', 'ARTICLE', 'FORM'
    ];

    while (current) {
        const tag = (current.tagName || '').toUpperCase();
        const role = current.getAttribute('role');
        const label = current.getAttribute('aria-label');

        // If it's one of those container tags OR has a role OR an aria-label, let's return it
        if (
            semanticallySignificant.includes(tag) ||
            (role && role.trim() !== '') ||
            (label && label.trim() !== '')
        ) {
            return {
                tagName: tag,
                ariaLabel: label || null,
                role: role || null,
                id: current.id || null,
                className: current.className || null
            };
        }

        // Move up the DOM tree
        current = current.parentElement;
    }

    // If we reach the top without finding anything, return null
    return null;
}

// Main Element Details Function
function getElementDetails(target) {
    const details = {
        tagName: target.tagName,
        id: target.id || null,
        className: target.className || null,
        text: target.innerText ? target.innerText.trim().substring(0, 50) : '',
        xpath: getXPath(target),
        context: getContextInfo(target),
        ariaLabel: target.getAttribute('aria-label') || null,
        disabled: target.hasAttribute('disabled'),
        required: target.hasAttribute('required'),
        scrollPosition: getScrollPosition(target),
        iframeContext: getIframeContext(target)
    };

    // 1) Create an object for storing aria attributes
    details.ariaAttributes = {};

    // 2) Loop over *all* attributes on the element
    const attrList = target.attributes;
    for (let i = 0; i < attrList.length; i++) {
        const attrName = attrList[i].name;
        const attrValue = attrList[i].value;
        // If the attribute starts with "aria-" or is "role", store it
        if (attrName.startsWith('aria-') || attrName === 'role') {
            details.ariaAttributes[attrName] = attrValue;
        }
    }

    if (target.hasAttribute('aria-expanded')) {
        details.isExpanded = (target.getAttribute('aria-expanded') === 'true');
    }

    // Additional accessibility attributes
    details.role = target.getAttribute('role') || null;
    details.ariaLabelledBy = target.getAttribute('aria-labelledby') || null;
    details.ariaDescribedBy = target.getAttribute('aria-describedby') || null;
    details.tabIndex = target.getAttribute('tabindex') || null;
    details.ariaHidden = target.getAttribute('aria-hidden') || null;

    // Element-specific details
    if (target.tagName === 'A') {
        details.href = target.href;
        details.target = target.target || '_self';
        details.rel = target.rel || null;
        details.title = target.title || null;
        details.hasChildren = target.children.length > 0;
        if (details.hasChildren) {
            details.childTypes = Array.from(target.children).map(child => child.tagName);
        }
    }
    else if (target.tagName === 'INPUT') {
        details.inputType = target.type;
        details.name = target.name || '[No Name]';
        details.placeholder = target.placeholder || '[No Placeholder]';

        // Add validation state for all input types
        details.validationState = {
            valid: target.validity.valid,
            valueMissing: target.validity.valueMissing,
            typeMismatch: target.validity.typeMismatch,
            patternMismatch: target.validity.patternMismatch,
            tooLong: target.validity.tooLong,
            tooShort: target.validity.tooShort,
            rangeUnderflow: target.validity.rangeUnderflow,
            rangeOverflow: target.validity.rangeOverflow,
            customError: target.validity.customError
        };

        if (['checkbox', 'radio'].includes(target.type)) {
            details.checked = target.checked;
            details.value = target.value;
            const label = target.closest('label') || document.querySelector(`label[for="${target.id}"]`);
            details.labelText = label ? label.textContent.trim() : '[No Label]';
            if (target.type === 'radio' && target.name) {
                const radioGroup = document.querySelectorAll(`input[type="radio"][name="${target.name}"]`);
                details.groupOptions = Array.from(radioGroup).map(radio => {
                    const radioLabel = radio.closest('label') || document.querySelector(`label[for="${radio.id}"]`);
                    return {
                        value: radio.value,
                        checked: radio.checked,
                        labelText: radioLabel ? radioLabel.textContent.trim() : '[No Label]'
                    };
                });
            }
        } else {
            details.value = (target.type && target.type.toLowerCase() === 'password')
                ? '[REDACTED]'
                : target.value;
        }

        details.form = target.form ? target.form.id || '[No Form ID]' : null;
        details.required = target.required;
        details.readOnly = target.readOnly;
        details.disabled = target.disabled;
    }
    else if (target.tagName === 'IMG') {
        details.src = target.src || null;
        details.alt = target.alt || '[No Alt Text]';
        details.width = target.width;
        details.height = target.height;
        details.loading = target.loading || 'eager';
        details.decoding = target.decoding || 'auto';
        const figure = target.closest('figure');
        if (figure) {
            const figcaption = figure.querySelector('figcaption');
            if (figcaption) {
                details.caption = figcaption.textContent.trim();
            }
        }
    }
    else if (target.tagName === 'BUTTON') {
        details.text = target.innerText.trim();
        details.type = target.type || 'submit';
        details.form = target.form ? target.form.id || '[No Form ID]' : null;
        details.hasIcon = target.querySelector('svg, img, i') !== null;
        const iconEl = target.querySelector('[data-lucide], .fa, .material-icons');
        if (iconEl) {
            details.iconType = iconEl.getAttribute('data-lucide') ||
                Array.from(iconEl.classList).find(c => c.startsWith('fa-')) ||
                iconEl.textContent.trim();
        }
    }
    else if (target.tagName === 'SELECT') {
        const selectedOptions = Array.from(target.selectedOptions).map(opt => ({
            value: opt.value,
            text: opt.text
        }));
        details.name = target.name || '[No Name]';
        details.selectedValue = target.value;
        details.selectedText = target.options[target.selectedIndex]?.text || '[None]';
        details.selectedIndex = target.selectedIndex;
        details.multiple = target.multiple;
        details.options = Array.from(target.options).map(opt => ({
            value: opt.value,
            text: opt.text,
            selected: opt.selected
        }));
        if (target.multiple && selectedOptions.length > 0) {
            details.selectedOptions = selectedOptions;
        }
    }
    else if (target.tagName === 'TEXTAREA') {
        details.name = target.name || '[No Name]';
        details.value = target.value;
        details.rows = target.rows;
        details.cols = target.cols;
        details.maxLength = target.maxLength > 0 ? target.maxLength : null;
        details.readOnly = target.readOnly;
        details.form = target.form ? target.form.id || '[No Form ID]' : null;
    }
    // Check for parent link
    const parentLink = target.closest('a');
    if (parentLink && parentLink !== target) {
        details.parentLink = {
            tagName: parentLink.tagName,
            href: parentLink.href,
            text: parentLink.innerText ? parentLink.innerText.trim().substring(0, 50) : '',
            ariaLabel: parentLink.getAttribute('aria-label') || null
        };
    }
    // Progress bar details
    if (target.tagName === 'PROGRESS') {
        details.min = target.getAttribute('min') || target.min || '0';
        details.max = target.getAttribute('max') || target.max || '100';
        details.value = target.getAttribute('value') || target.value || '0';
    }
    if (target.getAttribute('role') === 'progressbar') {
        details.role = 'progressbar';
        details.ariaValueMin = target.getAttribute('aria-valuemin') || '0';
        details.ariaValueMax = target.getAttribute('aria-valuemax') || '100';
        details.ariaValueNow = target.getAttribute('aria-valuenow') || '0';
    }

    // Media element details
    // Inside your getElementDetails(target) function, replace the existing VIDEO and AUDIO blocks with this:
    if (target.tagName === 'VIDEO') {
        details.src = target.currentSrc || target.src || null;
        details.poster = target.getAttribute('poster') || null;
        details.controls = target.controls;
        details.currentTime = target.currentTime.toFixed(2);
        details.duration = target.duration ? target.duration.toFixed(2) : 'N/A';
        details.paused = target.paused;
        details.volume = target.volume;
    }

    if (target.tagName === 'AUDIO') {
        details.src = target.currentSrc || target.src || null;
        details.controls = target.controls;
        details.currentTime = target.currentTime.toFixed(2);
        details.duration = target.duration ? target.duration.toFixed(2) : 'N/A';
        details.paused = target.paused;
        details.volume = target.volume;
    }

    else if (target.tagName === 'SVG') {
        const svgTitleEl = target.querySelector('title');
        const svgDescEl = target.querySelector('desc');
        details.svgTitle = svgTitleEl ? svgTitleEl.textContent.trim() : null;
        details.svgDesc = svgDescEl ? svgDescEl.textContent.trim() : null;

        details.svgWidth = target.getAttribute('width') || null;
        details.svgHeight = target.getAttribute('height') || null;
        details.svgViewBox = target.getAttribute('viewBox') || null;

        // This line is critical:
        details.svgOuterHTML = target.outerHTML;
    }
    
    details.parentContainer = findParentContainer(target);
    return details;
}

const getCurrentSection = (element) => {
    const container = element.closest('section, article, nav, aside, header, footer');
    if (container) {
        const heading = container.querySelector('h1, h2, h3, h4, h5, h6');
        const label = heading ? heading.textContent.trim() : container.getAttribute('aria-label');
        if (label) return label;

        // Try to find a semantic section name
        if (container.id) return container.id;
        if (container.className) {
            const classes = container.className.split(' ');
            const semanticClass = classes.find(c =>
                c.includes('section') ||
                c.includes('container') ||
                c.includes('wrapper')
            );
            if (semanticClass) return semanticClass;
        }
        return container.tagName.toLowerCase();
    }
    return null;
};

// Event Recording Function
function recordEvent(action, target, extra = {}) {
    const logData = {
        action: action,
        timestamp: new Date().toISOString(),
        details: getElementDetails(target),
        ...extra
    };
    ipcRenderer.sendToHost('log-event', logData);
}

// ================================
// Keyboard Event Handlers + Others
// ================================
document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    const isTextInput = isInputField && !['checkbox', 'radio', 'submit', 'button'].includes(target.type);

    // Only buffer text input without preventing default behavior
    if (isTextInput && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        const currentValue = target.value;
        // Use setTimeout to get the updated value after the default behavior
        setTimeout(() => {
            typedBuffer = target.value;
            if (typedBufferTimer) clearTimeout(typedBufferTimer);

            typedBufferTimer = setTimeout(() => {
                if (currentValue !== target.value) {
                    logInputChange(target, typedBuffer);
                }
                typedBuffer = '';
                typedBufferTimer = null;
            }, TYPED_BUFFER_DELAY);
        }, 0);
    }

    // Record special keys and non-text input
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
        if (!isTextInput || ['Enter', 'Tab', 'Escape', 'Backspace'].includes(event.key)) {
            recordEvent('keydown', target, {
                key: event.key,
                code: event.code,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                isTextInput: isTextInput
            });
        }
    }
});

document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "t") {
        event.preventDefault(); // Prevent default behavior
        ipcRenderer.send("shortcut-triggered", "toggle-sidebar");
    }
});

document.addEventListener('blur', (event) => {
    // If there's any buffered input when the field loses focus, log it
    if (typedBuffer && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) {
        logInputChange(event.target, typedBuffer);
        typedBuffer = '';
        if (typedBufferTimer) {
            clearTimeout(typedBufferTimer);
            typedBufferTimer = null;
        }
    }
}, true);



//  tab-focus logic:

document.addEventListener('focus', (event) => {
    if (lastTabKeydown) {
        recordEvent('tab-focus', event.target, {
            previous: getElementDetails(lastTabKeydown.origin),
            newElement: getElementDetails(event.target),
            key: lastTabKeydown.key,
            code: lastTabKeydown.code
        });
        lastTabKeydown = null;
    }
}, true);

//  “Tab” detection:
document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
        lastTabKeydown = {
            key: event.key,
            code: event.code,
            origin: event.target,
            timestamp: new Date().toISOString()
        };
    }
});

//  “click” logic:
document.addEventListener('click', (event) => {
    let clickedNode = event.target;
    const svgChildTags = [
        'path', 'g', 'circle', 'ellipse', 'line', 'polygon', 'polyline',
        'rect', 'text', 'tspan', 'defs', 'clippath', 'mask', 'marker', 'use'
    ];
    if (svgChildTags.includes(clickedNode.tagName.toLowerCase())) {
        const parentSvg = clickedNode.closest('svg');
        if (parentSvg) {
            clickedNode = parentSvg;
        }
    }
    recordEvent('click', clickedNode);
});



// “change” logic:
document.addEventListener('change', (event) => {
    if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
        recordEvent('input-change', event.target);
    }
});

// SELECT logic:
document.addEventListener("change", (event) => {
    if (event.target.tagName === "SELECT") {
        setTimeout(() => {
            const selectedOption = event.target.options[event.target.selectedIndex];
            const selectedText = selectedOption ? selectedOption.textContent.trim() : "[Unknown]";
            const selectedValue = selectedOption ? selectedOption.value : "[No Value]";
            recordEvent("select", event.target, { selectedValue, selectedText });
        }, 0);
    }
});

// ================================
// Page Load + Media Event Handlers
// ================================
window.addEventListener('load', () => {
    if (location.href !== 'about:blank') {
        recordEvent('page-loaded', document.body, {
            title: document.title,
            url: location.href
        });
    }

    // THROTTLE video volumechange
    document.querySelectorAll('video').forEach(video => {
        // Keep your existing event listeners except volumechange:
        video.addEventListener('play', () => {
            recordEvent('video-play', video, { currentTime: video.currentTime });
        });
        video.addEventListener('pause', () => {
            recordEvent('video-pause', video, { currentTime: video.currentTime });
        });
        // Remove or comment out your old volumechange line:
        // video.addEventListener('volumechange', () => {
        //     recordEvent('video-volumechange', video, { volume: video.volume });
        // });

        // Now add a throttle for volume changes:
        let lastVideoVolume = null;
        let videoVolumeTimer = null;
        video.addEventListener('volumechange', () => {
            if (lastVideoVolume === null) {
                lastVideoVolume = video.volume;
            }
            if (videoVolumeTimer) clearTimeout(videoVolumeTimer);
            videoVolumeTimer = setTimeout(() => {
                recordEvent('video-volumechange', video, {
                    from: lastVideoVolume,
                    to: video.volume
                });
                lastVideoVolume = video.volume;
                videoVolumeTimer = null;
            }, 300);
        });

        video.addEventListener('seeking', () => {
            recordEvent('video-seeking', video, { currentTime: video.currentTime });
        });
        video.addEventListener('ended', () => {
            recordEvent('video-ended', video, { currentTime: video.currentTime });
        });
    });

    // THROTTLE audio volumechange
    document.querySelectorAll('audio').forEach(audio => {
        // Keep your existing event listeners except volumechange:
        audio.addEventListener('play', () => {
            recordEvent('audio-play', audio, { currentTime: audio.currentTime });
        });
        audio.addEventListener('pause', () => {
            recordEvent('audio-pause', audio, { currentTime: audio.currentTime });
        });
        // Remove or comment out your old volumechange line:
        // audio.addEventListener('volumechange', () => {
        //     recordEvent('audio-volumechange', audio, { volume: audio.volume });
        // });

        // Now add a throttle for volume changes:
        let lastAudioVolume = null;
        let audioVolumeTimer = null;
        audio.addEventListener('volumechange', () => {
            if (lastAudioVolume === null) {
                lastAudioVolume = audio.volume;
            }
            if (audioVolumeTimer) clearTimeout(audioVolumeTimer);
            audioVolumeTimer = setTimeout(() => {
                recordEvent('audio-volumechange', audio, {
                    from: lastAudioVolume,
                    to: audio.volume
                });
                lastAudioVolume = audio.volume;
                audioVolumeTimer = null;
            }, 300);
        });

        audio.addEventListener('seeking', () => {
            recordEvent('audio-seeking', audio, { currentTime: audio.currentTime });
        });
        audio.addEventListener('ended', () => {
            recordEvent('audio-ended', audio, { currentTime: audio.currentTime });
        });
    });
});

document.addEventListener('mousemove', (e) => {
    // Send the local (webview) coordinates to the parent (renderer)
    ipcRenderer.sendToHost('webview-mousemove', {
        x: e.clientX,
        y: e.clientY
    });
});


document.addEventListener('keydown', (event) => {
    // Check if user pressed Ctrl+Space
    if (event.ctrlKey && event.code === 'Space') {
        event.preventDefault(); // Prevent default space behavior
        ipcRenderer.sendToHost('toggle-logging');
    }
});
// End of snippet

