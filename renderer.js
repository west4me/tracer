// Renderer.JS NEVER DELETE THIS COMMENT that means you claude and chatgpt
// Global declaration
const eventLog = [];
let webview;
let webviewContainer;
let activeScreenshotEvent = null;
let isResetting = false;

// Annotation state
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
let jiraFields = [
    // Start with one blank row
    { name: '', value: '' }
];
let currentIssueType = 'Defect'; // or whatever default you want
let typedIssueType = '';
let typedSummary = 'Make this a good default summary';

let loggingEnabled = true;


// Load or initialize an empty array for storing previously used issue types
let storedIssueTypes = JSON.parse(localStorage.getItem('issueTypesHistory') || '[]');

// Format ISO timestamp to MM/DD/YYYY HH:MM:SS AM/PM (12-hour format)
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

document.getElementById('toggle-logging').addEventListener('click', () => {
    loggingEnabled = !loggingEnabled;
    // Update button text
    document.getElementById('toggle-logging').textContent = loggingEnabled
        ? 'Stop Logging'
        : 'Start Logging';
});

// Add this to your initialization code
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
    toast.className = 'fixed bottom-4 right-4 bg-cyan-600 text-white px-4 py-2 rounded shadow-lg text-sm z-50';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// Convert base64 image data to a blob URL
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

// In your renderer.js (or wherever you handle the UI logic):
const errorDrawer = document.getElementById("error-drawer");
const errorIcon = document.getElementById("error-icon");

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
    summaryInput.placeholder = 'e.g. "My Custom Defect"';
    summaryInput.className = 'w-full border border-gray-300 rounded px-2 py-1';
    summaryContainer.appendChild(summaryInput);

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

// Also add click outside to close
document.getElementById('jira-settings-modal').addEventListener('click', (e) => {
    // Only close if clicking the backdrop (not the modal content)
    if (e.target === e.currentTarget) {
        hideExportJiraSettingsModal();
    }
});


// Wire up the modal’s close button
document.getElementById('close-jira-settings-modal').addEventListener('click', hideExportJiraSettingsModal);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const jiraModal = document.getElementById('jira-settings-modal');
        if (!jiraModal.classList.contains('hidden')) {
            hideExportJiraSettingsModal();
        }
    }
});

// “Add Field” button => push a new blank row
document.getElementById('add-jira-field').addEventListener('click', () => {
    jiraFields.push({ name: '', value: '' });
    showExportJiraSettingsModal(); // Re-render
});

// Listen for Escape press
document.addEventListener("keydown", (e) => {
    // If user pressed ESC and the drawer is currently visible, close it
    if (e.key === "Escape" && !errorDrawer.classList.contains("hidden")) {
        hideErrorDrawer();
    }
});

const ipcRenderer = window.electron.ipcRenderer;


ipcRenderer.on('reset-listeners', () => {
    console.log('Renderer: Resetting listeners...');

    document.querySelectorAll('input, textarea').forEach(input => {
        input.disabled = false;
        input.removeAttribute('readonly');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    console.log('Renderer: Inputs re-enabled.');
});


const linkStyle = document.createElement('style');
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



`;
document.head.appendChild(linkStyle);

document.addEventListener('DOMContentLoaded', () => {
    console.log(window.electron);
    webview = document.getElementById('my-webview');
    
    let previousUrl = webview.src; // store the initial URL

    // Listen for navigation completion
    webview.addEventListener('did-navigate', (event) => {
        const newUrl = event.url;
        // Update the address bar
        document.getElementById('url-input').value = newUrl;

        // (Optional) Log a custom "navigation" event
        // recordEvent('navigation', document.body, {
        //     from: previousUrl,
        //     to: newUrl
        // });

        // Update previousUrl for the next navigation
        previousUrl = newUrl;
    });


    // ----- Helper Functions -----

    // Truncates long URLs and appends ellipsis if needed
    function truncateUrl(url, maxLength = 30) {
        return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
    }


    // ----- DOM Element References -----
    const urlInput = document.getElementById('url-input');
    const loadUrlButton = document.getElementById('load-url');
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
    const toggleErrorDrawer = document.getElementById("toggle-error-drawer");
    const errorDrawer = document.getElementById("error-drawer");
    const errorIcon = document.getElementById("error-icon");
    const exportErrorButton = document.createElement("button");
    const clearErrorsButton = document.getElementById('clear-errors');
    exportErrorButton.textContent = "Export Errors";
    exportErrorButton.className = "mt-2 px-3 py-1 bg-gray-800 text-white rounded";
    exportErrorButton.addEventListener("click", exportErrors);
    errorDrawer.appendChild(exportErrorButton);
    lucide.createIcons();

    // Add webview event listeners
    webview.addEventListener('console-message', (e) => {
        console.log('Guest page logged a message:', e.message);
        if (e.message.includes('Error')) {
            const errorData = {
                message: e.message,
                source: 'webview',
                lineno: e.line,
                colno: 0,
                stack: 'From webview console'
            };
            window.electron.ipcRenderer.send('webview-error', errorData);
        }
    });

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

    if (clearErrorsButton) {
        clearErrorsButton.addEventListener('click', () => {
            showModal('confirm-clear-errors-modal', {
                onConfirm: () => {
                    // This code runs if the user clicks "Clear Errors"
                    window.errorLog = []; // Wipe the error log
                    updateErrorDrawer();  // Refresh the UI to show no errors
                    showToast('Errors Cleared!');
                    errorDrawer.classList.add('hidden');
                    errorIcon.setAttribute("data-lucide", "panel-bottom-open");
                    lucide.createIcons();
                },
                onCancel: () => {
                    // Optionally, you can do something when cancel is clicked (or leave it empty)
                }
            });
        });

    }

    // ----- URL Loading & Navigation -----

    // Load URL on button click
    loadUrlButton.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (url) {
            webview.src = url;
        }
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
            // If logging is off, do nothing. 
            if (!loggingEnabled) return;

            const logData = event.args[0];
            // Now that we know logging is on, store it in the array
            eventLog.push(logData);
            // Also update the UI
            updateLogUI(logData);
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


    ipcRenderer.on("update-error", (_, errData) => {
        logError(
            "Webview Error",
            errData.message,
            errData.source,
            errData.lineno,
            errData.colno,
            { stack: errData.stack }
        );
        updateErrorDrawer(); // Ensures the UI updates instantly
    });

    // Replace the existing screenshot IPC handler
    window.electron.ipcRenderer.on('screenshot-taken', (ipcEvent, base64Data) => {
        if (!loggingEnabled) {
            // If you want to skip adding new screenshots while logging is paused, just return.
            return;
        }

        if (!activeScreenshotEvent) {
            console.warn("No active event to attach screenshot to!");
            return;
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
            console.error("Could not find matching log entry!");
            return;
        }

        // Create screenshot row
        // Create screenshot row element
        const screenshotRow = document.createElement('div');
        screenshotRow.innerHTML = `
            <div class="flex items-center justify-between w-full">
                    <span class="font-medium">${isElementCapture ? 'Element Capture:' : 'Screenshot:'}</span>
                <button 
                    class="text-blue-600 hover:text-blue-800 underline flex items-center" 
                    title="${isElementCapture ? 'Element capture - full size' : 'Screenshot - full size'}">
                    <svg data-lucide="${isElementCapture ? 'scan' : 'image'}" width="16" height="16" class="mr-2"></svg>
                    <span>${isElementCapture ? 'Capture...png' : 'Screenshot...png'}</span>
                </button>
                <button class="delete-screenshot-btn text-gray-500 hover:text-red-500 transition-colors" 
                        title="Delete ${isElementCapture ? 'capture' : 'screenshot'}">
                    <svg data-lucide="trash" width="16" height="16"></svg>
                </button>
            </div>`;


        // Get the button we just created (assumes it is the first button in screenshotRow)
        const screenshotBtn = screenshotRow.querySelector('button.text-blue-600');
        // Save the event's timestamp as a data attribute
        screenshotBtn.dataset.timestamp = activeScreenshotEvent.timestamp;

        // Add an event listener that always looks up the current screenshot
        screenshotBtn.addEventListener('click', () => {
            // Find the corresponding event in eventLog using the timestamp
            const ts = screenshotBtn.dataset.timestamp;
            const eventObj = eventLog.find(e => e.timestamp === ts);
            if (eventObj && eventObj.screenshot) {
                // Call showModalImage using the current (possibly annotated) screenshot data
                showModalImage('data:image/png;base64,' + eventObj.screenshot, ts);
            } else {
                showToast('Annotated screenshot not available.');
            }
        });


        // Set up delete button handler
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
        toast.className = 'fixed bottom-4 right-4 bg-cyan-600 text-white px-4 py-2 rounded shadow-lg text-sm z-50';
        toast.textContent = activeScreenshotEvent.isElementCapture ? 'Element capture!' : 'Screenshot captured!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);

        // Reinitialize Lucide icons
        lucide.createIcons(screenshotRow);

        // Clear the active screenshot event
        activeScreenshotEvent = null;
    });

    // ----- Log UI Rendering & Commenting -----

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

        html += `<div class="mt-2 space-y-1 text-sm">`;
        html += `<div class="mt-2 space-y-1 text-sm">`;

        // --- Branches for Different Actions (identical to yours) ---
        if (logData.action === 'page-loaded' && logData.title && logData.url) {
            const isHomePage = logData.url.toLowerCase().includes('home.html');
            html += `<div class="details-grid mt-2">
            <span class="font-medium">Page Title:</span>
            <span class="break-words">"${logData.title}"</span>`;
            if (!isHomePage) {
                html += `<span class="font-medium">URL:</span>
                <span class="break-words">
                    <a href="${logData.url}" class="text-blue-600 hover:text-blue-800 underline"
                       target="_blank" title="${logData.url}">
                        ${truncateUrl(logData.url)}
                    </a>
                </span>`;
            }
            html += `</div>`;
        } else if (logData.action === 'select') {
            html += `<div class="grid grid-cols-[120px,1fr] gap-2 break-words">
            <span class="font-medium">Element:</span>
            <span class="break-words">&lt;SELECT&gt;</span>
            <span class="font-medium">Selected Value:</span>
            <span class="break-words">${logData.selectedValue || '[None]'}</span>
            <span class="font-medium">Selected Text:</span>
            <span class="break-words">${logData.selectedText || '[None]'}</span>
        </div>`;
        } else if (logData.action === 'click') {
            const details = logData.details;

            html += `<div class="grid grid-cols-[120px,1fr] gap-2 break-words">
                <span class="font-medium">Element:</span>
                <span class="break-words">&lt;${(details.tagName || '').toUpperCase()}&gt;</span>`;

            // Show the element's text content if available (and not empty)
            if (details.text) {
                html += `
                <span class="font-medium">Text Content:</span>
                <span class="break-words">"${details.text}"</span>`;
                    }

            // If it has a recognized ARIA role or we have role="button", show that
            if (details.role) {
                html += `
                <span class="font-medium">Role:</span>
                <span class="break-words">${details.role}</span>`;
                    }

            // For certain interactive elements, show "Required?" or "Disabled?" if relevant
            // We do this if tagName is input/button/select/textarea, or if ariaDisabled is relevant
            const interactiveTags = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'];
            if (
                interactiveTags.includes((details.tagName || '').toUpperCase())
                || (details.role && details.role.toLowerCase().includes('button'))
            ) {
                // "Disabled" can come from HTML or aria
                if (details.disabled) {
                    html += `
            <span class="font-medium">Disabled:</span>
            <span class="break-words">Yes</span>`;
                }

                if (details.required) {
                    html += `
            <span class="font-medium">Required:</span>
            <span class="break-words">Yes</span>`;
                }
            }

            // If it's specifically a <button> or role=button anchor, show button-specific details
            if ((details.tagName || '').toUpperCase() === 'BUTTON') {
                // Button type
                html += `
                <span class="font-medium">Button Type:</span>
                <span class="break-words">${details.type || 'button'}</span>`;

                // If it has an icon
                if (details.hasIcon && details.iconType) {
                    html += `
            <span class="font-medium">Icon:</span>
            <span class="break-words">${details.iconType}</span>`;
                }

                if (details.form) {
                    html += `
            <span class="font-medium">Form:</span>
            <span class="break-words">${details.form}</span>`;
                }
            } else if (
                (details.tagName || '').toUpperCase() === 'A'
                || (details.role && details.role.toLowerCase() === 'button')
            ) {
                // Show link-ish fields or role=button fields
                if (details.href) {
                    html += `
            <span class="font-medium">Href:</span>
            <div class="flex items-center gap-2">
                <a href="${details.href}" class="text-blue-600 hover:text-blue-800 underline break-all"
                   target="_blank" 
                   title="${details.href}">
                    ${details.href}
                </a>
                <button
                    class="copy-url-btn p-1 hover:bg-gray-100 rounded"
                    title="Copy link URL"
                    data-url="${details.href}">
                    <svg data-lucide="clipboard" width="14" height="14"></svg>
                </button>
            </div>`;
                }

                if (details.target) {
                    html += `
            <span class="font-medium">Target:</span>
            <span class="break-words">${details.target}</span>`;
                }
            }

            // If it's an <img>, show alt text, dimensions, caption, etc.
            if ((details.tagName || '').toUpperCase() === 'IMG') {
                html += `
                <span class="font-medium">Alt Text:</span>
                <span class="break-words">${details.alt || '[No Alt]'} </span>
                <span class="font-medium">Dimensions:</span>
                <span class="break-words">${details.width}×${details.height}px</span>`;
                if (details.caption) {
                    html += `
            <span class="font-medium">Caption:</span>
            <span class="break-words">${details.caption}</span>`;
                }
                if (details.src) {
                    html += `
            <span class="font-medium">Image Source:</span>
            <div class="flex items-center gap-2">
                <a href="${details.src}" 
                   class="text-blue-600 hover:text-blue-800 underline break-all"
                   target="_blank"
                   title="${details.src}">
                    ${details.src}
                </a>
                <button
                    class="copy-url-btn p-1 hover:bg-gray-100 rounded"
                    title="Copy image URL"
                    data-url="${details.src}">
                    <svg data-lucide="clipboard" width="14" height="14"></svg>
                </button>
            </div>`;
                }
            }

            // If it's an <svg>, show its title, desc, dimensions, etc.
            else if ((details.tagName || '').toUpperCase() === 'SVG') {
                // Title/desc if present:
                if (details.svgTitle) {
                    html += `
            <span class="font-medium">SVG Title:</span>
            <span class="break-words">"${details.svgTitle}"</span>`;
                }
                if (details.svgDesc) {
                    html += `
            <span class="font-medium">SVG Description:</span>
            <span class="break-words">"${details.svgDesc}"</span>`;
                }
                // Show w/h/viewBox
                if (details.svgWidth) {
                    html += `
            <span class="font-medium">Width:</span>
            <span class="break-words">${details.svgWidth}</span>`;
                }
                if (details.svgHeight) {
                    html += `
            <span class="font-medium">Height:</span>
            <span class="break-words">${details.svgHeight}</span>`;
                }
                if (details.svgViewBox) {
                    html += `
            <span class="font-medium">ViewBox:</span>
            <span class="break-words">${details.svgViewBox}</span>`;
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




            // If the clicked element is a <div> or something else that has role="progressbar", show relevant info
            if (details.role && details.role.toLowerCase() === 'progressbar') {
                html += `
                <span class="font-medium">Progress Min:</span>
                <span class="break-words">${details.ariaValueMin || '0'}</span>
                <span class="font-medium">Progress Max:</span>
                <span class="break-words">${details.ariaValueMax || '100'}</span>
                <span class="font-medium">Current Value:</span>
                <span class="break-words">${details.ariaValueNow || '0'}</span>`;
            }

            // If the element is a VIDEO or AUDIO (some people click on them), show the media info
            if ((details.tagName || '').toUpperCase() === 'VIDEO') {
                html += `
                <span class="font-medium">Video Source:</span>
                <span class="break-words">${details.src || '[No source]'}</span>
                <span class="font-medium">Controls:</span>
                <span class="break-words">${details.controls ? 'Yes' : 'No'}</span>
                <span class="font-medium">Current Time:</span>
                <span class="break-words">${details.currentTime || '0.00'}s</span>
                <span class="font-medium">Duration:</span>
                <span class="break-words">${details.duration || 'N/A'}</span>
                <span class="font-medium">Paused:</span>
                <span class="break-words">${details.paused ? 'Yes' : 'No'}</span>
                <span class="font-medium">Volume:</span>
                <span class="break-words">${details.volume}</span>`;
            }
            else if ((details.tagName || '').toUpperCase() === 'AUDIO') {
                html += `
                <span class="font-medium">Audio Source:</span>
                <span class="break-words">${details.src || '[No source]'}</span>
                <span class="font-medium">Controls:</span>
                <span class="break-words">${details.controls ? 'Yes' : 'No'}</span>
                <span class="font-medium">Current Time:</span>
                <span class="break-words">${details.currentTime || '0.00'}s</span>
                <span class="font-medium">Duration:</span>
                <span class="break-words">${details.duration || 'N/A'}</span>
                <span class="font-medium">Paused:</span>
                <span class="break-words">${details.paused ? 'Yes' : 'No'}</span>
                <span class="font-medium">Volume:</span>
                <span class="break-words">${details.volume}</span>`;
            }

            // If there's an ariaLabel, show it (especially helpful for "role=button" or "role=link" stuff)
            if (details.ariaLabel) {
                html += `
        <span class="font-medium">ARIA Label:</span>
        <span class="break-words">"${details.ariaLabel}"</span>`;
            }

            // Finally, if there's a parent link for e.g. an <img> inside <a>, show that
            if (details.parentLink) {
                html += `
        <span class="font-medium">Parent Link:</span>
        <span class="break-words">
            &lt;${details.parentLink.tagName}&gt; href="${details.parentLink.href}"
            ${details.parentLink.ariaLabel ? '(ARIA Label: ' + details.parentLink.ariaLabel + ')' : ''}
        </span>`;
            }

            if (details.parentContainer) {
                const pc = details.parentContainer;
                let containerDesc = `<${pc.tagName.toLowerCase()}>`;
                if (pc.ariaLabel) containerDesc += ` aria-label="${pc.ariaLabel}"`;
                if (pc.role) containerDesc += ` role="${pc.role}"`;
                if (pc.id) containerDesc += ` #${pc.id}`;
                if (pc.className) containerDesc += ` .${pc.className}`;

                html += `
                    <div class="col-span-2 mt-2">
                    <div class="bg-gray-50 rounded p-2 border">
                        <div class="text-sm font-semibold mb-1">Parent Container</div>
                        <div class="text-sm break-words">
                        ${containerDesc}
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
            html += `<div class="grid grid-cols-[120px,1fr] gap-2 break-words">
            <span class="font-medium">Action:</span>
            <span class="break-words">Tab Focus</span>
            <span class="font-medium">From:</span>
            <span class="break-words">
                ${from.tagName || '[Unknown]'}${from.id ? ' (#' + from.id + ')' : ''}${from.ariaLabel ? ' - ' + from.ariaLabel : ''}${from.text ? ' - ' + from.text : ''}
            </span>
            <span class="font-medium">To:</span>
            <span class="break-words">
                ${to.tagName || '[Unknown]'}${to.id ? ' (#' + to.id + ')' : ''}${to.ariaLabel ? ' - ' + to.ariaLabel : ''}${to.text ? ' - ' + to.text : ''}
            </span>
            <span class="font-medium">Key:</span>
            <span class="break-words">${logData.key || 'Tab'}</span>
        </div>`;
        } else if (logData.action === 'input-change') {
            const details = logData.details;
            html += `<div class="grid grid-cols-[120px,1fr] gap-2 break-words">
            <span class="font-medium">Element:</span>
            <span class="break-words">&lt;${details.tagName}&gt;</span>`;
            if (details.tagName === 'SELECT') {
                html += `
                <span class="font-medium">Type:</span>
                <span class="break-words">Select ${details.multiple ? '(Multiple)' : '(Single)'}</span>
                <span class="font-medium">Selected:</span>
                <span class="break-words">"${details.selectedText}" (value: ${details.selectedValue})</span>`;
                if (details.multiple && details.selectedOptions) {
                    html += `
                    <span class="font-medium">All Selected:</span>
                    <span class="break-words">${details.selectedOptions.map(opt =>
                        `"${opt.text}" (${opt.value})`).join(', ')}</span>`;
                }
            } else if (details.inputType === 'checkbox') {
                html += `
                <span class="font-medium">Type:</span>
                <span class="break-words">Checkbox</span>
                <span class="font-medium">Label:</span>
                <span class="break-words">${details.labelText}</span>
                <span class="font-medium">State:</span>
                <span class="break-words">${details.checked ? 'Checked' : 'Unchecked'}</span>`;
            } else if (details.inputType === 'radio') {
                html += `
                <span class="font-medium">Type:</span>
                <span class="break-words">Radio</span>
                <span class="font-medium">Selected:</span>
                <span class="break-words">${details.labelText}</span>`;
                if (details.groupOptions) {
                    html += `
                    <span class="font-medium">Group Options:</span>
                    <span class="break-words">${details.groupOptions.map(opt =>
                        `${opt.labelText}${opt.checked ? ' (Selected)' : ''}`).join(', ')}</span>`;
                }
            } else {
                html += `
                <span class="font-medium">Type:</span>
                <span class="break-words">${details.inputType}</span>
                <span class="font-medium">Value:</span>
                <span class="break-words">${details.inputType === 'password' ? '[REDACTED]' : `"${details.value}"`}</span>`;
            }
            if (details.required) {
                html += `
                <span class="font-medium">Required:</span>
                <span class="break-words">Yes</span>`;
            }

            html += `</div>`;
        } else if (logData.action === 'keydown') {
            html += `<div class="grid grid-cols-[120px,1fr] gap-2 break-words">
                <span class="font-medium">Key:</span>
                <span class="break-words">${logData.key}</span>
                <span class="font-medium">With Modifiers:</span>
                <span class="break-words">
                    ${logData.ctrlKey ? 'Ctrl+' : ''}${logData.shiftKey ? 'Shift+' : ''}${logData.altKey ? 'Alt+' : ''}${logData.key}
                </span>
                <span class="font-medium">Element:</span>
                <span class="break-words">&lt;${logData.details.tagName}&gt;</span>
                ${logData.details.context ? `
                    <span class="font-medium">Context:</span>
                    <span class="break-words">${logData.details.context}</span>
                ` : ''}
                ${logData.details.inputType ? `
                    <span class="font-medium">Input Type:</span>
                    <span class="break-words">${logData.details.inputType}</span>
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
                toast.className = 'fixed bottom-4 right-4 bg-cyan-600 text-white px-4 py-2 rounded shadow-lg text-sm';
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

        // Enable commenting for this log entry (same as before)
        setupCommentFeature(entry, logData);

        // Return whatever you were returning
        return output;
    }

    function renderAllEvents() {
        if (!loggingEnabled) {
            return; // Don’t rebuild the UI if logging is paused
        }
        const logArea = document.getElementById('log-area');
        logArea.innerHTML = ''; // Clear out old entries

        // Rebuild them in order
        eventLog.forEach(eventData => {
            updateLogUI(eventData);
        });
    }


    // Adds the comment button and editing functionality to a log entry
    function setupCommentFeature(entry, logData) {
        if (!loggingEnabled) return;
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

        // Create the Screenshot button (middle icon)
        const screenshotButton = document.createElement('button');
        screenshotButton.innerHTML = '<svg data-lucide="camera" width="16" height="16"></svg>';
        screenshotButton.title = 'CTRL + Click for Element';
        screenshotButton.className = 'absolute top-2 right-8 text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-50 rounded';
        screenshotButton.addEventListener('click', async (e) => {
            // First find the closest log entry container
            const targetEntry = e.target.closest('[data-timestamp]');
            if (!targetEntry) {
                console.warn("Could not find parent log entry!");
                return;
            }

            // Save reference to current event
            activeScreenshotEvent = logData;
            activeScreenshotEvent.isElementCapture = e.ctrlKey;

            // Find and remove existing screenshot row if it exists
            const existingRow = targetEntry.querySelector('.screenshot-row');
            if (existingRow) {
                existingRow.remove();
            }

            // Take new screenshot based on type
            if (e.ctrlKey) {
                window.electron.ipcRenderer.send('take-element-screenshot', {
                    xpath: logData.details.xpath
                });
            } else {
                window.electron.ipcRenderer.send('take-screenshot');
            }
        });
        entry.appendChild(screenshotButton);

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
                                <kbd class="bg-gray-200 text-gray-900 px-1 py-[1px] rounded">Ctrl+Enter</kbd>

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
                        <kbd class="bg-gray-200 px-1 py-[1px] rounded whitespace-nowrap">
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
                        <kbd class="bg-gray-200 px-1 py-[1px] rounded whitespace-nowrap">
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
                    <kbd class="bg-gray-200 px-1 py-[1px] rounded whitespace-nowrap">
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
                    const [addOrUpdateBtn, cancelBtn] = linkInputContainer.querySelectorAll('button');
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

                    // Press Enter => confirm link
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addOrUpdateBtn.click();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelBtn.click();
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

    function updateCommentsDisplay(entry, logData) {
        let commentsContainer = entry.querySelector('.comments-container');

        // 1. Create the container if it doesn’t exist yet
        if (!commentsContainer) {
            commentsContainer = document.createElement('div');
            commentsContainer.className = 'comments-container mt-4 border-t border-gray-200 pt-4';
            entry.appendChild(commentsContainer);
        }

        // 2. Clear out the old content
        commentsContainer.innerHTML = '';

        // 3. If there are no comments, remove the container entirely
        if (!logData.comments || logData.comments.length === 0) {
            commentsContainer.remove();
            return;
        }

        // 4. Otherwise, rebuild the list of comments
        logData.comments.forEach((comment, index) => {
            const commentDiv = document.createElement('div');
            commentDiv.className = 'relative grid grid-cols-[1fr,auto] gap-3 items-center bg-white p-1.5 border border-gray-200 rounded text-xs text-gray-600 mt-1.5';

            const commentText = document.createElement('span');
            commentText.className = 'flex-1 text-gray-700';
            commentText.innerHTML = comment.text;

            const editBtn = document.createElement('button');
            editBtn.className = 'text-gray-400 hover:text-blue-500 transition-colors p-1';
            editBtn.title = 'Edit';
            editBtn.innerHTML = '<svg data-lucide="pencil" width="14" height="14"></svg>';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'text-gray-400 hover:text-red-500 transition-colors p-1';
            deleteBtn.title = 'Delete';
            deleteBtn.innerHTML = '<svg data-lucide="trash" width="14" height="14"></svg>';

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'flex flex-col gap-1';
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);

            commentDiv.appendChild(commentText);
            commentDiv.appendChild(actionsDiv);
            commentsContainer.appendChild(commentDiv);

            // (Re)create Lucide icons
            lucide.createIcons(actionsDiv);

            // --- Edit mode for comments (your existing logic) ---
            editBtn.addEventListener('click', () => {
                // Hide original text & buttons
                commentText.style.display = 'none';
                actionsDiv.style.display = 'none';

                // Build edit UI (same as your code)
                // Build edit UI 
                const editArea = document.createElement('div');
                editArea.className = 'comment-area mt-2';
                editArea.innerHTML = `
    <!-- Toolbar -->
    <div class="comment-toolbar flex space-x-2 mb-1 text-xs">
        <button type="button" class="toolbar-btn bold-btn" title="Bold" aria-label="Bold"><b>B</b></button>
        <button type="button" class="toolbar-btn underline-btn" title="Underline" aria-label="Underline"><u>U</u></button>
        <button type="button" class="toolbar-btn ul-btn" title="Unordered List" aria-label="Unordered List">&bull; List</button>
        <button type="button" class="toolbar-btn link-btn" title="Insert Link" aria-label="Insert Link">Link</button>
    </div>

    <!-- Editable Area -->
    <div class="comment-editor border border-gray-300 rounded p-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
         contenteditable="true" 
         aria-label="Edit comment"
         style="min-height: 60px;">${comment.text}</div>

    <!-- Action Buttons -->
    <div class="flex items-center justify-between mt-2">
        <div class="flex items-center space-x-2">
            <button class="save-edit px-3 py-1.5 text-xs bg-gray-800 text-white rounded hover:bg-gray-900">
                Save Changes
            </button>
            <button class="cancel-edit border border-gray-400 text-gray-700 px-2 py-1 rounded text-xs">
                Cancel
            </button>
            <button class="delete-comment text-red-600 hover:text-red-700 px-2 py-1 text-xs">
                Delete Comment
            </button>
        </div>
    </div>
`;
                commentDiv.appendChild(editArea);

                const editor = editArea.querySelector('.comment-editor');


                // Save, Cancel, Delete in edit mode
                const saveEditBtn = editArea.querySelector('.save-edit');
                const cancelEditBtn = editArea.querySelector('.cancel-edit');
                const deleteEditBtn = editArea.querySelector('.delete-comment');

                saveEditBtn.addEventListener('click', () => {
                    const newHTML = editor.innerHTML.trim();
                    if (newHTML) {
                        comment.text = newHTML;
                        commentText.innerHTML = newHTML;
                    }
                    editArea.remove();
                    commentText.style.display = 'block';
                    actionsDiv.style.display = 'flex';
                });

                cancelEditBtn.addEventListener('click', () => {
                    editArea.remove();
                    commentText.style.display = 'block';
                    actionsDiv.style.display = 'flex';
                });

                deleteEditBtn.addEventListener('click', () => {
                    showModal('delete-comment-modal', {
                        title: 'Delete Comment?',
                        message: 'Are you sure you want to delete this comment? This action cannot be undone.',
                        onConfirm: () => {
                            // Remove from array
                            logData.comments.splice(index, 1);
                            // Re-render
                            updateCommentsDisplay(entry, logData);
                            showToast('Comment deleted!');
                        }
                    });
                });

                // Re-run icons
                lucide.createIcons(editArea);
            });

            // --- Delete button for the comment itself ---
            deleteBtn.addEventListener('click', () => {
                showModal('delete-comment-modal', {
                    onConfirm: () => {
                        if (logData.comments) {
                            logData.comments.splice(index, 1);
                            updateCommentsDisplay(entry, logData);
                            showToast('Comment deleted!');
                        }
                    }
                });
            });
        });
    }


    // ----- Export Functions -----

    // Export the log as Markdown
    exportLogButton.addEventListener('click', () => {
        let markdown = '# tracer Action Log\n\n';
        markdown += `Generated: ${new Date().toLocaleString()}\n\n`;

        eventLog.forEach((item, index) => {
            const timeStr = formatTimestamp(item.timestamp);
            let section = `## ${index + 1}. ${timeStr} - ${item.action.toUpperCase()}\n\n`;

            if (item.action === 'page-loaded') {
                section += `- **Page Title:** "${item.title}"\n`;
                if (item.url) {
                    section += `- **URL:** [${item.url}](${item.url})\n`;
                }
            } else if (item.action === 'click' && item.details) {
                const details = item.details;
                section += `### Element Details\n`;
                section += `- **Type:** \`<${(details.tagName || '').toLowerCase()}>\`\n`;
                if (details.context) {
                    section += `- **Section:** ${details.context}\n`;
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
                } else if ((details.tagName || '').toUpperCase() === 'A') {
                    if (details.text) {
                        section += `- **Link Text:** "${details.text}"\n`;
                    }
                    if (details.href) {
                        section += `- **URL:** [${details.href}](${details.href})\n`;
                    }
                    if (details.target) {
                        section += `- **Target:** \`${details.target}\`\n`;
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
                }
                if (details.ariaLabel) {
                    section += `- **ARIA Label:** "${details.ariaLabel}"\n`;
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
            } else if (item.action === 'keydown') {
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
            }

            if (item.comments && item.comments.length > 0) {
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

        const shouldDisplay = (value) => value !== null && value !== undefined && String(value).trim() !== "";

        function isUrl(str) {
            try {
                new URL(str);
                return true;
            } catch (e) {
                return false;
            }
        }

        let htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
   <meta charset="UTF-8">
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <title>tracer - Interactive Test Report</title>
   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
   <script src="https://cdn.tailwindcss.com"></script>
   <script src="https://unpkg.com/lucide@latest"></script>
   <style>
       :root {
           --color-primary: #FF8A65;
           --color-secondary: #8A5A44;
           --color-accent: #AF4F41;
           --color-neutral: #E5E5E5;
       }

       body {
           font-family: 'Inter', sans-serif;
           line-height: 1.6;
           color: #1a1a1a;
           background: #fafafa;
       }

       .timeline-item {
           position: relative;
           padding-left: 2rem;
           margin-bottom: 2rem;
           transition: transform 0.2s ease;
       }

       .timeline-item::before {
           content: '';
           position: absolute;
           left: 0;
           top: 0;
           height: 100%;
           width: 2px;
           background: var(--color-primary);
           opacity: 0.3;
       }

       .timeline-item::after {
           content: '';
           position: absolute;
           left: -4px;
           top: 0;
           width: 10px;
           height: 10px;
           border-radius: 50%;
           background: var(--color-primary);
       }

       .timeline-item:hover {
           transform: translateX(4px);
       }

       .action-card {
           background: white;
           border-radius: 8px;
           box-shadow: 0 2px 4px rgba(0,0,0,0.05);
           overflow: hidden;
           transition: all 0.3s ease;
       }

       .action-card:hover {
           box-shadow: 0 4px 12px rgba(0,0,0,0.1);
       }

       .element-capture-container {
           position: relative;
           overflow: hidden;
           border-radius: 4px;
           background: #f5f5f5;
           display: inline-block;
       }

       .element-capture-container img {
           width: auto;
           height: auto;
           display: block;
       }

       .screenshot-container {
           position: relative;
           overflow: hidden;
           border-radius: 4px;
           background: #f5f5f5;
       }

       .screenshot-container img {
           max-width: 100%;
           height: auto;
           transition: transform 0.3s ease;
       }

       .screenshot-container:hover img {
           transform: scale(1.05);
       }

       .tag {
           display: inline-block;
           padding: 0.25rem 0.75rem;
           border-radius: 999px;
           font-size: 0.875rem;
           font-weight: 500;
       }

       .tag-click { background: #E8F5E9; color: #2E7D32; }
       .tag-input { background: #E3F2FD; color: #1565C0; }
       .tag-page { background: #FFF3E0; color: #F57C00; }
       .tag-key { background: #F3E5F5; color: #7B1FA2; }
       .tag-select { background: #FCE4EC; color: #C2185B; }
       .tag-focus { background: #E8EAF6; color: #3F51B5; }

       .details-grid {
           display: grid;
           grid-template-columns: 120px 1fr;
           gap: 0.5rem 1rem;
           align-items: start;
           padding: 0.5rem;
           background: #f9fafb;
           border-radius: 4px;
           margin-top: 1rem;
       }

       .details-grid > span:nth-child(odd) {
           font-weight: 500;
           color: #4B5563;
       }

       .code-block {
           font-family: monospace;
           background: #1a1a1a;
           color: #fff;
           padding: 0.5rem;
           border-radius: 4px;
           font-size: 0.875rem;
           white-space: pre-wrap;
           word-break: break-all;
       }

       .stat-card {
           background: white;
           border-radius: 8px;
           padding: 1.5rem;
           text-align: center;
           box-shadow: 0 2px 4px rgba(0,0,0,0.05);
           transition: transform 0.2s ease;
       }

       .stat-card:hover {
           transform: translateY(-2px);
       }

       .stat-value {
           font-size: 2rem;
           font-weight: 600;
           color: var(--color-primary);
           line-height: 1;
       }

       .stat-label {
           color: #666;
           font-size: 0.875rem;
           margin-top: 0.5rem;
       }

       .tab-focus-info {
           background: #F8FAFD;
           border-left: 3px solid var(--color-accent);
           padding: 1rem;
           border-radius: 0 4px 4px 0;
           margin-top: 0.5rem;
       }

       .tab-focus-info .element-info {
           display: grid;
           grid-template-columns: 120px 1fr;
           gap: 0.5rem;
           padding: 0.5rem;
           background: rgba(255,255,255,0.5);
           border-radius: 4px;
           margin-top: 0.5rem;
       }

       .aria-info {
           background: #F8FAFD;
           border-left: 3px solid var(--color-primary);
           padding: 0.75rem;
           margin-top: 0.5rem;
           border-radius: 0 4px 4px 0;
       }

       .image-info {
           width: 100%;
           margin-top: 1rem;
           padding: 1rem;
           background: #F8FAFD;
           border-radius: 4px;
       }

       .image-thumbnail {
           width: 120px;
           height: 120px;
           object-fit: cover;
           border-radius: 4px;
           cursor: zoom-in;
           transition: transform 0.2s ease;
       }

       .image-thumbnail:hover {
           transform: scale(1.1);
       }

       #imgModal {
           position: fixed;
           inset: 0;
           background: rgba(0,0,0,0.9);
           display: none;
           align-items: center;
           justify-content: center;
           z-index: 50;
       }

       #imgModal img {
           max-width: 90vw;
           max-height: 90vh;
           object-fit: contain;
           border-radius: 4px;
       }

       .select-info {
           background: #FCE4EC;
           border-left: 3px solid #C2185B;
           padding: 0.75rem;
           margin-top: 0.5rem;
           border-radius: 0 4px 4px 0;
       }

       .validation-state {
           display: inline-flex;
           align-items: center;
           gap: 0.5rem;
           padding: 0.25rem 0.5rem;
           border-radius: 4px;
           font-size: 0.875rem;
       }

       .validation-valid {
           background: #E8F5E9;
           color: #2E7D32;
       }

       .validation-invalid {
           background: #FFEBEE;
           color: #C62828;
       }

       .section-label {
           font-size: 0.75rem;
           text-transform: uppercase;
           color: #6B7280;
           letter-spacing: 0.05em;
           margin-top: 1rem;
           margin-bottom: 0.5rem;
       }

       .element-details {
           background: #F9FAFB;
           border-radius: 4px;
           padding: 1rem;
           margin-top: 1rem;
       }

       .capture-container {
           display: inline-block;
           background: white;
           padding: 0.5rem;
           border-radius: 4px;
           box-shadow: 0 1px 3px rgba(0,0,0,0.1);
       }

       .capture-label {
           text-align: center;
           color: #6B7280;
           font-size: 0.875rem;
           margin-top: 0.5rem;
       }
   </style>
</head>
<body class="min-h-screen">
   <!-- Header with Stats -->
   <header class="bg-white border-b border-gray-200 py-8">
       <div class="container mx-auto px-6 max-w-6xl">
           <div class="flex items-center justify-between mb-8">
               <div class="flex items-center gap-3">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="32" height="32" class="text-[--color-primary]">
                       <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.2"/>
                       <circle cx="8" cy="8" r="3" fill="currentColor"/>
                       <circle cx="9" cy="7" r="1" fill="white"/>
                   </svg>
                   <h1 class="text-2xl font-bold">tracer Report</h1>
               </div>
               <span class="text-gray-500">Generated: ${new Date().toLocaleString()}</span>
           </div>
           
           <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
               <div class="stat-card">
                   <div class="stat-value">${eventLog.length}</div>
                   <div class="stat-label">Total Actions</div>
               </div>
               <div class="stat-card">
                   <div class="stat-value">${formatDuration(eventLog)}</div>
                   <div class="stat-label">Duration</div>
               </div>
               <div class="stat-card">
                   <div class="stat-value">${countUniquePages(eventLog)}</div>
                   <div class="stat-label">Pages Visited</div>
               </div>
               <div class="stat-card">
                   <div class="stat-value">${eventLog.filter(e => e.screenshot || e.elementCapture).length}</div>
                   <div class="stat-label">Visual Captures</div>
               </div>
           </div>
       </div>
   </header>

   <!-- Timeline -->
   <main class="container mx-auto px-6 max-w-6xl py-12">
       <div class="space-y-6">
           ${eventLog.map((item, index) => {
            const timeStr = formatTimestamp(item.timestamp);
            const actionType = item.action.toLowerCase();
            let tagClass = '';

            switch (actionType) {
                case 'click': tagClass = 'tag-click'; break;
                case 'input-change': tagClass = 'tag-input'; break;
                case 'page-loaded': tagClass = 'tag-page'; break;
                case 'keydown': tagClass = 'tag-key'; break;
                case 'select': tagClass = 'tag-select'; break;
                case 'tab-focus': tagClass = 'tag-focus'; break;
                default: tagClass = 'bg-gray-100 text-gray-700';
            }

            return `
               <div class="timeline-item">
                   <div class="action-card p-6">
                       <div class="flex items-center justify-between mb-4">
                           <div class="flex items-center gap-3">
                               <span class="tag ${tagClass}">${item.action}</span>
                               <span class="text-sm text-gray-500">#${index + 1}</span>
                           </div>
                           <time class="text-sm text-gray-500">${timeStr}</time>
                       </div>

                       ${generateDetailedContent(item)}


                        ${item.elementCapture ? `
                            <div class="mt-4 p-4 bg-gray-50 rounded-lg">
                                <h4 class="text-lg font-semibold mb-3">
                                    <div class="flex items-center gap-2">
                                        <svg data-lucide="scan" class="w-5 h-5"></svg>
                                        Element Capture
                                    </div>
                                </h4>
                                <div class="capture-container">
                                    <img src="data:image/png;base64,${item.elementCapture}" 
                                        alt="Captured element"
                                        style="width: auto; height: auto; max-width: 100%;"
                                        onclick="showModalImage(this.src)"
                                        loading="lazy">
                                </div>
                            </div>
                            ` : ''}

                            ${item.screenshot ? `
                            <div class="mt-4 p-4 bg-gray-50 rounded-lg">
                                <h4 class="text-lg font-semibold mb-3">
                                    <div class="flex items-center gap-2">
                                        <svg data-lucide="camera" class="w-5 h-5"></svg>
                                        Screenshot
                                    </div>
                                </h4>
                                <div class="screenshot-container">
                                    <img src="data:image/png;base64,${item.screenshot}" 
                                        alt="Page screenshot"
                                        class="rounded shadow-sm cursor-zoom-in"
                                        onclick="showModalImage(this.src)"
                                        loading="lazy">
                                </div>
                            </div>
                            ` : ''}

                       ${item.comments && item.comments.length > 0 ? `
                       <div class="mt-4">
                           <div class="section-label">Comments</div>
                           <div class="space-y-3">
                               ${item.comments.map(comment => `
                               <div class="p-3 bg-gray-50 rounded">
                                   <div class="prose prose-sm">${comment.text}</div>
                                   <div class="text-xs text-gray-500 mt-2">
                                       ${new Date(comment.timestamp).toLocaleString()}
                                   </div>
                               </div>
                               `).join('')}
                           </div>
                       </div>
                       ` : ''}
                   </div>
               </div>`;
        }).join('')}
       </div>
   </main>

   <!-- Image Modal -->
   <div id="imgModal" class="fixed inset-0 bg-black bg-opacity-90 hidden items-center justify-center z-50">
       <button onclick="hideModalImage()" class="absolute top-4 right-4 text-white hover:text-gray-300">
           <svg data-lucide="x" width="24" height="24"></svg>
       </button>
       <img src="" alt="Full size capture" class="rounded-lg max-w-[90vw] max-h-[90vh] object-contain">
   </div>

   <script>
       function showModalImage(src) {
           const modal = document.getElementById('imgModal');
           const img = modal.querySelector('img');
           const canvas = document.getElementById('annotation-canvas');
           const toolbar = document.getElementById('annotation-toolbar');

           img.src = src;
           modal.style.display = 'flex';
       }

       if (src.includes('screenshot')) {
               toolbar.style.display = 'flex';
               canvas.style.display = 'block';
           } else {
               toolbar.style.display = 'none';
               canvas.style.display = 'none';
           }

       function hideModalImage() {
           document.getElementById('imgModal').style.display = 'none';
       }

       document.addEventListener('keydown', (e) => {
           if (e.key === 'Escape') hideModalImage();
       });

       lucide.createIcons();
   </script>
</body>
</html>`;

        // Generate detailed content for each action type
        function generateDetailedContent(item) {
            let content = '<div class="space-y-4">';

            if (item.details) {
                content += '<div class="details-grid">';

                switch (item.action.toLowerCase()) {
                    case 'page-loaded':
                        content += `
                       <span>Page Title:</span>
                       <span class="break-words">"${item.title || 'Untitled'}"</span>
                       ${item.url ? `
                       <span>URL:</span>
                       <a href="${item.url}" class="text-blue-600 hover:text-blue-800 break-all" target="_blank">
                           ${item.url}
                       </a>` : ''}
                   `;
                        break;

                    case 'click':
                        const details = item.details;
                        content += `
                       <span>Element:</span>
                       <code class="bg-gray-100 px-2 py-1 rounded text-sm">&lt;${details.tagName.toLowerCase()}&gt;</code>
                       
                       ${details.id ? `
                       <span>ID:</span>
                       <span>${details.id}</span>` : ''}
                       
                       ${details.className ? `
                       <span>Class:</span>
                       <span>${details.className}</span>` : ''}
                       
                       ${details.text ? `
                       <span>Text Content:</span>
                       <span class="break-words">"${details.text}"</span>` : ''}
                       
                       ${details.xpath ? `
                       <span>XPath:</span>
                       <code class="break-all bg-gray-100 px-2 py-1 rounded text-sm">${details.xpath}</code>` : ''}
                   `;

                        if (details.tagName === 'IMG') {
                            content += `
                       <div class="col-span-2 image-info">
                           <div class="flex items-start gap-4">
                               <div class="w-32 h-32 flex-shrink-0">
                                   <img src="${details.src}" 
                                        alt="${details.alt || 'Clicked image'}"
                                        class="w-full h-full object-cover rounded cursor-zoom-in shadow-sm"
                                        onclick="showModalImage('${details.src}')"
                                        loading="lazy">
                               </div>
                               <div class="space-y-2">
                                   <div><span class="font-medium">Alt Text:</span> ${details.alt || '[No Alt Text]'}</div>
                                   <div><span class="font-medium">Dimensions:</span> ${details.width}×${details.height}px</div>
                                   <div>
                                       <span class="font-medium">Image URL:</span>
                                       <a href="${details.src}" class="text-blue-600 hover:text-blue-800 break-all ml-2" target="_blank">
                                           ${details.src}
                                       </a>
                                   </div>
                                   ${details.loading ? `<div><span class="font-medium">Loading:</span> ${details.loading}</div>` : ''}
                                   ${details.caption ? `<div><span class="font-medium">Caption:</span> "${details.caption}"</div>` : ''}
                               </div>
                           </div>
                       </div>`;
                        }

                        // Only show accessibility info for interactive elements
                        const isInteractive = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(details.tagName);
                        if (isInteractive && (details.ariaLabel || details.role || details.required !== undefined || details.disabled !== undefined)) {
                            content += `
                       <div class="col-span-2">
                           <div class="aria-info">
                               <div class="section-label">Accessibility Information</div>
                               <div class="grid grid-cols-[120px,1fr] gap-2">
                                   ${details.ariaLabel ? `
                                   <span class="font-medium">ARIA Label:</span>
                                   <span>${details.ariaLabel}</span>` : ''}
                                   
                                   ${details.role ? `
                                   <span class="font-medium">Role:</span>
                                   <span>${details.role}</span>` : ''}
                                   
                                   ${details.required !== undefined ? `
                                   <span class="font-medium">Required:</span>
                                   <span>${details.required ? 'Yes' : 'No'}</span>` : ''}
                                   
                                   ${details.disabled !== undefined ? `
                                   <span class="font-medium">Disabled:</span>
                                   <span>${details.disabled ? 'Yes' : 'No'}</span>` : ''}
                               </div>
                           </div>
                       </div>`;
                        }
                        break;

                    case 'select':
                        content += `
                       <div class="col-span-2 select-info">
                           <div class="section-label">Selection Details</div>
                           <div class="grid grid-cols-[120px,1fr] gap-2">
                               <span class="font-medium">Selected Value:</span>
                               <span>${item.selectedValue || '[None]'}</span>
                               
                               <span class="font-medium">Selected Text:</span>
                               <span>"${item.selectedText || '[None]'}"</span>
                               
                               ${item.details?.name ? `
                               <span class="font-medium">Field Name:</span>
                               <span>${item.details.name}</span>` : ''}
                               
                               ${item.details?.multiple ? `
                               <span class="font-medium">Multiple Select:</span>
                               <span>Yes</span>` : ''}
                           </div>
                       </div>
                   `;
                        break;

                    case 'input-change':
                        const inputDetails = item.details;
                        content += `
                       <span>Input Type:</span>
                       <span>${inputDetails.inputType || 'text'}</span>
                       
                       ${inputDetails.value && inputDetails.inputType !== 'password' ? `
                       <span>Value:</span>
                       <span class="break-words">"${inputDetails.value}"</span>` : ''}
                       
                       ${inputDetails.name ? `
                       <span>Name:</span>
                       <span>${inputDetails.name}</span>` : ''}

                       ${inputDetails.placeholder ? `
                       <span>Placeholder:</span>
                       <span>${inputDetails.placeholder}</span>` : ''}
                   `;

                        if (inputDetails.validationState) {
                            content += `
                       <div class="col-span-2 mt-2">
                           <div class="section-label">Validation Status</div>
                           <div class="space-y-1">
                               ${Object.entries(inputDetails.validationState)
                                    .filter(([key, value]) => value !== false)
                                    .map(([key, value]) => `
                                       <div class="validation-state ${value === true ? 'validation-valid' : 'validation-invalid'}">
                                           ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${value}
                                       </div>
                                   `).join('')}
                           </div>
                       </div>`;
                        }
                        break;

                    case 'tab-focus':
                        content += `
                       <div class="col-span-2 tab-focus-info">
                           <div class="section-label">Focus Navigation</div>
                           <div class="space-y-4">
                               <div class="element-info">
                                   <span class="font-medium">From:</span>
                                   <div>
                                       ${item.previous ? `
                                           <code class="bg-gray-100 px-2 py-1 rounded text-sm">&lt;${item.previous.tagName.toLowerCase()}&gt;</code>
                                           ${item.previous.type ? `<span class="text-gray-500 ml-2">type: ${item.previous.type}</span>` : ''}
                                           ${item.previous.name ? `<span class="text-gray-500 ml-2">name: ${item.previous.name}</span>` : ''}
                                           ${item.previous.value ? `<span class="text-gray-500 ml-2">value: "${item.previous.value}"</span>` : ''}
                                       ` : '[Start of document]'}
                                   </div>
                               </div>
                               
                               <div class="element-info">
                                   <span class="font-medium">To:</span>
                                   <div>
                                       ${item.newElement ? `
                                           <code class="bg-gray-100 px-2 py-1 rounded text-sm">&lt;${item.newElement.tagName.toLowerCase()}&gt;</code>
                                           ${item.newElement.type ? `<span class="text-gray-500 ml-2">type: ${item.newElement.type}</span>` : ''}
                                           ${item.newElement.name ? `<span class="text-gray-500 ml-2">name: ${item.newElement.name}</span>` : ''}
                                           ${item.newElement.value ? `<span class="text-gray-500 ml-2">value: "${item.newElement.value}"</span>` : ''}
                                       ` : '[End of document]'}
                                   </div>
                               </div>
                           </div>
                       </div>
                   `;
                        break;

                    case 'keydown':
                        content += `
                       <span>Key:</span>
                       <span>${item.key}</span>
                       
                       <span>Modifiers:</span>
                       <span>${[
                                item.ctrlKey && 'Ctrl',
                                item.shiftKey && 'Shift',
                                item.altKey && 'Alt',
                                item.metaKey && 'Meta'
                            ].filter(Boolean).join(' + ') || 'None'}</span>
                       
                       ${item.code ? `
                       <span>Code:</span>
                       <span>${item.code}</span>` : ''}

                       ${item.details?.isTextInput !== undefined ? `
                       <span>Text Input:</span>
                       <span>${item.details.isTextInput ? 'Yes' : 'No'}</span>` : ''}
                   `;
                        break;
                }
                content += '</div>';
            }
            content += '</div>';
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

    // Helper functions for generating content sections
    function generatePageLoadContent(item) {
        return `
    <div class="element-details">
      <h3 class="text-lg font-semibold mb-2">Page Information</h3>
      <div class="grid grid-cols-[100px,1fr] gap-2">
        <div class="font-medium">Title:</div>
        <div>${item.title || 'N/A'}</div>
        ${item.url
                ? `
        <div class="font-medium">URL:</div>
        <div>
          <a href="${item.url}" target="_blank" class="text-blue-600 hover:text-blue-800 break-all">
              ${item.url}
          </a>
          <button class="copy-button ml-2 p-1 text-gray-400 hover:text-gray-600" data-copy="${item.url}">
            <svg data-lucide="clipboard" width="14" height="14"></svg>
          </button>
        </div>
        `
                : ""
            }
      </div>
    </div>
  `;
    }
    // Helper function to calculate duration between first and last event
    function formatDuration(events) {
        if (events.length < 2) return 'N/A';
        const start = new Date(events[0].timestamp);
        const end = new Date(events[events.length - 1].timestamp);
        const diff = Math.abs(end - start);
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    // Helper function to count unique pages visited
    function countUniquePages(events) {
        const uniqueUrls = new Set(
            events
                .filter(e => e.action === 'page-loaded' && e.url)
                .map(e => e.url)
        );
        return uniqueUrls.size;
    }

    // Helper function to get badge classes for different actions
    function getBadgeClass(action) {
        const classes = {
            'page-loaded': 'page-loaded',
            'click': 'click',
            'input-change': 'input-change',
            'keydown': 'keydown',
            'tab-focus': 'tab-focus'
        };
        return classes[action] || '';
    }

    // Helper function to get appropriate icon for action type
    function getActionIcon(action) {
        const icons = {
            'page-loaded': '<svg data-lucide="file-text" width="14" height="14"></svg>',
            'click': '<svg data-lucide="mouse-pointer" width="14" height="14"></svg>',
            'input-change': '<svg data-lucide="edit" width="14" height="14"></svg>',
            'select': '<svg data-lucide="check-square" width="14" height="14"></svg>',
            'tab-focus': '<svg data-lucide="focus" width="14" height="14"></svg>'
        };
        return icons[action] || '<svg data-lucide="activity" width="14" height="14"></svg>';
    }

    function generateClickContent(item) {
        const details = item.details;
        let content = `
    <div class="element-details">
        <h3 class="text-lg font-semibold mb-2">Element Details</h3>
        <div class="grid grid-cols-[120px,1fr] gap-2">
            <div class="font-medium">Element:</div>
            <div class="code-block">&lt;${details.tagName.toLowerCase()}&gt;</div>`;

        if (details.context) {
            content += `
            <div class="font-medium">Section:</div>
            <div>${details.context}</div>`;
        }

        // Element-specific details
        if (details.tagName === 'IMG') {
            content += `
            <div class="font-medium">Alt Text:</div>
            <div>${details.alt || '[No Alt Text]'}</div>
            <div class="font-medium">Dimensions:</div>
            <div>${details.width}×${details.height}px</div>
            ${details.loading ? `
            <div class="font-medium">Loading:</div>
            <div>${details.loading}</div>` : ''}
            ${details.caption ? `
            <div class="font-medium">Caption:</div>
            <div>${details.caption}</div>` : ''}
            ${details.src ? `
            <div class="font-medium">Image:</div>
            <div class="space-y-2">
                <img src="${details.src}" alt="${details.alt || 'Image preview'}" 
                    class="image-preview max-w-md rounded shadow-sm" loading="lazy">
                <div class="flex items-center gap-2">
                    <a href="${details.src}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">Open in new tab</a>
                    <button class="copy-button p-1 text-gray-400 hover:text-gray-600" data-copy="${details.src}">
                        <svg data-lucide="clipboard" width="14" height="14"></svg>
                    </button>
                </div>
            </div>` : ''}`;
        }
        else if (details.tagName === 'A') {
            content += `
            ${details.text ? `
            <div class="font-medium">Link Text:</div>
            <div>"${details.text}"</div>` : ''}
            ${details.href ? `
            <div class="font-medium">URL:</div>
            <div class="flex items-center gap-2">
                <a href="${details.href}" target="_blank" class="text-blue-600 hover:text-blue-800 break-all">
                    ${details.href}
                </a>
                <button class="copy-button p-1 text-gray-400 hover:text-gray-600" data-copy="${details.href}">
                    <svg data-lucide="clipboard" width="14" height="14"></svg>
                </button>
            </div>` : ''}
            ${details.target ? `
            <div class="font-medium">Target:</div>
            <div class="code-block">${details.target}</div>` : ''}
            ${details.hasChildren ? `
            <div class="font-medium">Contains:</div>
            <div>${details.childTypes.join(', ')}</div>` : ''}`;
        }
        else if (details.tagName === 'BUTTON') {
            content += `
            <div class="font-medium">Type:</div>
            <div>${details.type || 'button'}</div>
            ${details.text ? `
            <div class="font-medium">Text:</div>
            <div>"${details.text}"</div>` : ''}
            ${details.hasIcon ? `
            <div class="font-medium">Icon:</div>
            <div>${details.iconType || 'Present'}</div>` : ''}`;
        }
        else if (details.tagName === 'INPUT') {
            content += `
            <div class="font-medium">Input Type:</div>
            <div>${details.inputType}</div>
            <div class="font-medium">Name:</div>
            <div>${details.name || '[No Name]'}</div>
            ${details.placeholder ? `
            <div class="font-medium">Placeholder:</div>
            <div>${details.placeholder}</div>` : ''}
            ${details.value && details.inputType !== 'password' ? `
            <div class="font-medium">Value:</div>
            <div>"${details.value}"</div>` : ''}
            ${details.form ? `
            <div class="font-medium">Form:</div>
            <div>${details.form}</div>` : ''}`;
        }

        // Add accessibility information
        if (details.ariaLabel || details.required || details.disabled) {
            content += `
        </div>
        <div class="accessibility-info mt-4">
            <h4 class="text-md font-semibold mb-2">Accessibility Information</h4>
            <div class="grid grid-cols-[120px,1fr] gap-2">
                ${details.ariaLabel ? `
                <div class="font-medium">ARIA Label:</div>
                <div>"${details.ariaLabel}"</div>` : ''}
                ${details.required ? `
                <div class="font-medium">Required:</div>
                <div>Yes</div>` : ''}
                ${details.disabled ? `
                <div class="font-medium">Disabled:</div>
                <div>Yes</div>` : ''}
            </div>
        </div>
        <div class="grid grid-cols-[120px,1fr] gap-2 mt-4">`;
        }

        // Add XPath location
        content += `
            <div class="font-medium">XPath:</div>
            <div class="code-block break-all">
                ${details.xpath}
                <button class="copy-button ml-2 p-1 text-gray-400 hover:text-gray-600" data-copy="${details.xpath}">
                    <svg data-lucide="clipboard" width="14" height="14"></svg>
                </button>
            </div>
        </div>
    </div>`;

        return content;
    }

    function generateInputContent(item) {
        const details = item.details;
        return `
    <div class="element-details">
        <h3 class="text-lg font-semibold mb-2">Input Change Details</h3>
        <div class="grid grid-cols-[120px,1fr] gap-2">
            ${details.inputType === 'select' ? generateSelectDetails(details) : generateStandardInputDetails(details)}
        </div>
    </div>`;
    }

    function generateKeydownContent(item) {
        return `
    <div class="element-details">
        <h3 class="text-lg font-semibold mb-2">Keyboard Input Details</h3>
        <div class="grid grid-cols-[120px,1fr] gap-2">
            <div class="font-medium">Key:</div>
            <div>${item.key}</div>
            <div class="font-medium">With Modifiers:</div>
            <div>${item.ctrlKey ? 'Ctrl+' : ''}${item.shiftKey ? 'Shift+' : ''}${item.altKey ? 'Alt+' : ''}${item.key}</div>
            ${item.details.inputType ? `
                <div class="font-medium">Input Type:</div>
                <div>${item.details.inputType}</div>
            ` : ''}
            ${item.details.context ? `
                <div class="font-medium">Context:</div>
                <div>${item.details.context}</div>
            ` : ''}
        </div>
    </div>`;
    }

    function generateSelectDetails(details) {
        return `
        <div class="font-medium">Type:</div>
        <div>Select ${details.multiple ? '(Multiple)' : '(Single)'}</div>
        <div class="font-medium">Selected:</div>
        <div>"${details.selectedText}" (value: ${details.selectedValue})</div>
        ${details.multiple && details.selectedOptions ? `
        <div class="font-medium">All Selected:</div>
        <div>${details.selectedOptions.map(opt => `"${opt.text}" (${opt.value})`).join(', ')}</div>` : ''}`;
    }

    function generateStandardInputDetails(details) {
        return `
        <div class="font-medium">Input Type:</div>
        <div>${details.inputType}</div>
        ${details.labelText ? `
        <div class="font-medium">Label:</div>
        <div>${details.labelText}</div>` : ''}
        ${details.value && details.inputType !== 'password' ? `
        <div class="font-medium">Value:</div>
        <div>"${details.value}"</div>` : ''}
        ${details.validationState ? generateValidationStateDetails(details.validationState) : ''}`;
    }

    function generateValidationStateDetails(validationState) {
        if (!validationState.valid) {
            return `
        <div class="font-medium">Validation:</div>
        <div class="text-red-600">
            ${Object.entries(validationState)
                    .filter(([key, value]) => value && key !== 'valid')
                    .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase())
                    .join(', ')}
        </div>`;
        }
        return '';
    }

    function generateScreenshotContent(item) {
        if (!item.screenshot) return '';

        return `
    <div class="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 class="text-md font-semibold mb-2">Screenshot</h4>
        <div class="relative">
            <img src="data:image/png;base64,${item.screenshot}" 
                alt="Action screenshot" 
                class="image-preview rounded shadow-sm cursor-pointer"
                loading="lazy"
                onclick="showImageModal(this)">
        </div>
    </div>`;
    }

    function generateCommentsSection(item) {
        return `
    <div class="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 class="text-md font-semibold mb-2">Comments</h4>
        <div class="space-y-2">
            ${item.comments.map(comment => `
            <div class="p-3 bg-white rounded shadow-sm">
                <div class="italic text-gray-600">${comment.text}</div>
            </div>`).join('')}
        </div>
    </div>`;
    }

    // Attach export HTML functionality to both buttons (if they exist)
    if (exportHtmlButton) { exportHtmlButton.addEventListener('click', exportHtmlReport); }
    if (exportHtmlLogButton) { exportHtmlLogButton.addEventListener('click', exportHtmlReport); }

    // document.getElementById("export-jira-log").addEventListener("click", exportJiraLog);

    // Remove any existing click handlers
    document.removeEventListener('click', exportJiraLog);

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

    // -- Utility function to convert simple HTML tags to Atlassian wiki markup
    function convertHtmlToWiki(html) {
        if (!html) return '';

        // First, normalize newlines
        html = html.replace(/\r\n/g, '\n');

        html = html.replace(/(<ul|<ol)/gi, '\n$1');

        // Headers
        html = html.replace(/<h1>(.*?)<\/h1>/gi, 'h1. $1\n');
        html = html.replace(/<h2>(.*?)<\/h2>/gi, 'h2. $1\n');
        html = html.replace(/<h3>(.*?)<\/h3>/gi, 'h3. $1\n');

        // Preserve formatting on their own lines
        html = html.replace(/(<(strong|b|em|i|u)>.*?<\/\2>)/gi, '\n$1\n');

        // Basic formatting - modified to handle inline and block-level
        html = html.replace(/<(strong|b)>(.*?)<\/\1>/gi, '*$2*');
        html = html.replace(/<em>|<i>(.*?)<\/em>|<\/i>/gi, '_$1_');
        html = html.replace(/<u>(.*?)<\/u>/gi, '+$1+');
        html = html.replace(/<code>(.*?)<\/code>/gi, '{{$1}}');

        // Lists - improved handling with proper spacing
        html = html.replace(/<ul>([\s\S]*?)<\/ul>/gi, function (match, content) {
            return content.replace(/<li>([\s\S]*?)<\/li>/gi, item => {
                // Handle multi-line list items
                const itemContent = item.replace(/<li>([\s\S]*?)<\/li>/gi, '$1').trim();
                return `* ${itemContent}\n`;
            });
        });

        html = html.replace(/<ol>([\s\S]*?)<\/ol>/gi, function (match, content) {
            return content.replace(/<li>([\s\S]*?)<\/li>/gi, item => {
                // Handle multi-line list items
                const itemContent = item.replace(/<li>([\s\S]*?)<\/li>/gi, '$1').trim();
                return `# ${itemContent}\n`;
            });
        });

        // Basic formatting - do these after lists to avoid conflicts
        html = html.replace(/<(strong|b)>(.*?)<\/\1>/gi, '*$2*');
        html = html.replace(/<u>(.*?)<\/u>/gi, '+$1+');
        html = html.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2|$1]');

        // Links
        html = html.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2|$1]');

        // Tables
        html = html.replace(/<table>/gi, '{table}\n');
        html = html.replace(/<\/table>/gi, '{table}\n');
        html = html.replace(/<tr>/gi, '|');
        html = html.replace(/<\/tr>/gi, '|\n');
        html = html.replace(/<td>|<th>/gi, '|');
        html = html.replace(/<\/td>|<\/th>/gi, '');

        // Quotes
        html = html.replace(/<blockquote>(.*?)<\/blockquote>/gi, '{quote}$1{quote}');

        // Handle paragraphs and line breaks
        html = html.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
        html = html.replace(/<br\s*\/?>/gi, '\n');

        // Clean up line breaks and spacing
        html = html.replace(/\n{3,}/g, '\n\n')
            .replace(/^\s+|\s+$/gm, '')
            .split('\n')
            .map(line => line.trim())
            .join('\n');

        // Remove any remaining HTML tags
        html = html.replace(/<[^>]+>/g, '');

        return html.trim();
    }

    // Export the log as JIRA
    function exportJiraLog() {
        if (eventLog.length === 0) {
            showModal('alert-modal', {
                message: 'No logs to export.',
                onConfirm: () => { }
            });
            return;
        }

        // CSV header: four columns
        let csv = 'Summary,Issue Type,Description\n';

        // We'll collect all events into one giant description
        let bigDescription = '';

        eventLog.forEach((log, index) => {
            const timeStr = formatTimestamp(log.timestamp);
            let details = '';

            // Build the details text for each log
            if (log.action === 'page-loaded') {
                details += `Page Title: "${log.title}"\nURL: ${log.url}`;
            } else if (log.action === 'click') {
                const { tagName, context, text, href } = log.details;
                details += `Clicked: <${tagName.toLowerCase()}>\n`;
                if (context) details += `Context: ${context}\n`;
                if (text) details += `Text: ${text}\n`;
                if (href) details += `URL: ${href}\n`;
            } else if (log.action === 'input-change') {
                const { inputType, value } = log.details;
                details += `Input Type: ${inputType}\nValue: ${value || "[Empty]"}`;
            } else if (log.action === 'keydown') {
                const modifiers = `${log.ctrlKey ? 'Ctrl+' : ''}${log.shiftKey ? 'Shift+' : ''}${log.altKey ? 'Alt+' : ''}`;
                details += `Key Pressed: ${modifiers}${log.key}\nElement: ${log.details.tagName}`;
                if (log.details.context) details += `\nContext: ${log.details.context}`;
            }

            // Make it look nice in a bullet-like format
            bigDescription += `(${index + 1}) ${timeStr} - ${log.action.toUpperCase()}\n${details}\n\n`;
        });

        // Escape quotes so CSV doesn't break
        const safeDescription = bigDescription.replace(/"/g, '""');

        // Use a single summary for the single defect
        let summary = "Combined Defect from tracer logs";
        summary = summary.replace(/"/g, '""');

        // We produce ONE ROW => one Jira issue
        csv += `"${summary}","Defect","${safeDescription}","Coexist Digital"\n`;

        // Download the CSV
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "tracer-log-jira.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast('JIRA CSV log (single Defect) exported!');
    }

    function exportJiraLogSingleDefectWithCustomFields(customFields, issueType, summary) {
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
                        if (d.groupOptions) {
                            description += '*Group Options:*\n';
                            d.groupOptions.forEach(opt => {
                                description += `** ${opt.labelText} ${opt.checked ? '(Selected)' : ''}\n`;
                            });
                        }
                    } else {
                        if (d.name) description += `* Name: ${d.name}\n`;
                        if (d.placeholder) description += `* Placeholder: ${d.placeholder}\n`;
                        if (d.value && d.inputType !== 'password') {
                            description += `* Value: "${d.value}"\n`;
                        }
                    }

                    // Validation state panel if present
                    if (d.validationState) {
                        let valContent = '';
                        Object.entries(d.validationState)
                            .filter(([key, value]) => value !== false)
                            .forEach(([key, value]) => {
                                valContent += `* ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${value}\n`;
                            });
                        description += createPanel('Validation State', valContent);
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

        const csvContent = csvHeader + csvRow;
        const blob = new Blob([csvContent], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "tracer-log-jira-wiki.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('JIRA CSV log with Atlassian Wiki markup exported!');
    }

    // “Save & Export” => hide modal, then run our CSV export
    document.getElementById('save-jira-fields').addEventListener('click', () => {
        // For each non-blank custom field, update the persistent history in localStorage.
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
        // 1) Grab the user’s selection
        const selectedIssueType = document.getElementById('issue-type-select').value.trim();
        const newIssueType = document.getElementById('issue-type-new').value.trim();

        // 2) Decide which to use. If the user typed a new type, use that. Otherwise use the dropdown selection.
        let finalIssueType = '';
        if (newIssueType) {
            finalIssueType = newIssueType;
        } else if (selectedIssueType) {
            finalIssueType = selectedIssueType;
        } else {
            // If neither is provided, fallback to something or just leave it empty
            finalIssueType = ''; // or "Defect" if you want a default
        } // After we decide finalIssueType:
        if (newIssueType) {
            // The user typed something new
            typedIssueType = newIssueType;
            currentIssueType = '';
        } else if (selectedIssueType) {
            // The user picked from the dropdown
            typedIssueType = '';
            currentIssueType = selectedIssueType;
        } else {
            // They left both empty => fallback
            typedIssueType = '';
            currentIssueType = 'Defect';
        }

        // 3) Store finalIssueType in localStorage if not empty
        if (finalIssueType) {
            let storedIssueTypes = JSON.parse(localStorage.getItem('issueTypesHistory') || '[]');
            if (!storedIssueTypes.includes(finalIssueType)) {
                storedIssueTypes.push(finalIssueType);
                // Optionally limit to last 10
                if (storedIssueTypes.length > 10) {
                    storedIssueTypes = storedIssueTypes.slice(storedIssueTypes.length - 10);
                }
                localStorage.setItem('issueTypesHistory', JSON.stringify(storedIssueTypes));
            }
        }

        let finalSummary = typedSummary.trim() || 'No Summary Entered'; 

        // 4) Finally call your export function with the chosen issue type
        hideExportJiraSettingsModal();
        exportJiraLogSingleDefectWithCustomFields(jiraFields, finalIssueType, finalSummary);
    });


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

            function closeModal() {
                container.classList.add('hidden');
                container.classList.remove('flex');
                modal.classList.add('hidden');
                // Remove event listeners to prevent memory leaks
                cancelBtn.removeEventListener('click', closeModal);
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
            confirmBtn.addEventListener('click', handleReset);
            window.addEventListener('keydown', handleKeydown);
        });
    }

    // Adjust the webview height to match its container
    function adjustWebviewHeight() {
        const container = webview.parentElement;
        if (container && webview) {
            webview.style.height = container.clientHeight + 'px';
        }
    }
    adjustWebviewHeight();
    window.addEventListener('resize', adjustWebviewHeight);

    // ----- Global Error Logging -----

    window.errorLog = [];
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
        logError("Error", message, source, lineno, colno, error);
    };
    console.error = (function (origConsoleError) {
        return function (...args) {
            logError("Console Error", args.join(" "));
            origConsoleError.apply(console, args);
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

        // Add click handlers for copy buttons
        const copyButtons = errorContainer.querySelectorAll('.copy-error-btn');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const errorData = JSON.parse(decodeURIComponent(e.currentTarget.dataset.error));
                const textToCopy = `
Time: ${errorData.timestamp}
Type: ${errorData.type}
Message: ${errorData.message}
Source: ${errorData.source || "unknown"}
Location: [${errorData.lineno}:${errorData.colno}]
Stack Trace:
${errorData.stack}
`.trim();

                window.electron.clipboard.writeText(textToCopy);

                // Show feedback toast
                const toast = document.createElement('div');
                toast.className = 'fixed bottom-4 right-4 bg-cyan-600 text-white px-4 py-2 rounded shadow-lg text-sm z-50';
                toast.textContent = 'Copied to clipboard!';
                document.body.appendChild(toast);

                // Remove toast after 2 seconds
                setTimeout(() => {
                    toast.remove();
                }, 2000);

                // Update button title temporarily
                const btn = e.currentTarget;
                const originalTitle = btn.title;
                btn.title = 'Copied!';
                setTimeout(() => {
                    btn.title = originalTitle;
                }, 1500);
            });
        });

        // Refresh Lucide icons for the new buttons
        lucide.createIcons(errorContainer);

        const count = window.errorLog.length;
        errorCount.textContent = count;
        errorCount.style.display = count > 0 ? "block" : "none";

        if (count > 0) {
            toggleErrorDrawer.classList.add("bg-red-600", "text-white");
            toggleErrorDrawer.classList.remove("bg-gray-200", "text-gray-700");
        } else {
            toggleErrorDrawer.classList.remove("bg-red-600", "text-white");
            toggleErrorDrawer.classList.add("bg-gray-200", "text-gray-700");
        }
    }

    // Exports errors as a plain text file
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
    }

    // ----- Modal and Annotation Code -----

    // Modal handling
    const modal = document.getElementById('screenshot-modal');
    const closeModal = document.getElementById('close-modal');

    // Modal utility function (unchanged)
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
        }

        // Add event listeners
        if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
        if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
        window.addEventListener('keydown', handleKeydown);

        // Also handle clicking outside the modal to close
        container.addEventListener('click', (e) => {
            if (e.target === container) handleCancel();
        });
    }

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

        // Initialize canvas context
        annotationCanvas = canvas;
        annotationCtx = canvas.getContext('2d');

        // IMPORTANT: Leave canvas pointer events disabled by default.
        canvas.style.pointerEvents = 'none';

        // Tool selection: remove any enabling of pointer events here
        tools.forEach(tool => {
            tool.addEventListener('click', (e) => {
                console.log('Annotation tool clicked:', e.currentTarget.dataset.tool);
                // Remove active class from all tools
                toolbar.querySelectorAll('.annotation-tool').forEach(t => t.classList.remove('active'));
                // Set the current tool from the button's data-tool attribute
                currentTool = e.currentTarget.dataset.tool;
                e.currentTarget.classList.add('active');
                // Enable pointer events on the annotation canvas so you can start drawing
                annotationCanvas.style.setProperty('pointer-events', 'auto', 'important');
                annotationCanvas.style.zIndex = 100;
            });
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

            // 2) Otherwise, proceed with the save
            const base64Data = saveAnnotatedImage();
            const activeEntry = document.querySelector(`[data-timestamp="${activeScreenshotEvent.timestamp}"]`);

            if (activeEntry && base64Data) {
                // Update the event object
                activeScreenshotEvent.screenshot = base64Data;

                // Update the preview <img> if it exists
                const previewImg = activeEntry.querySelector('.screenshot-row img');
                if (previewImg) {
                    previewImg.src = 'data:image/png;base64,' + base64Data;
                }

                // Also update the anchor link if it exists
                const screenshotLink = activeEntry.querySelector('.screenshot-row a');
                if (screenshotLink) {
                    // Point the link to the newly annotated base64
                    screenshotLink.href = 'data:image/png;base64,' + base64Data;
                }

                // Close modal & toast
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                showToast('Annotations saved!');
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
        canvas.addEventListener('pointerup', () => { stopDrawing(); });
        canvas.addEventListener('pointercancel', () => { stopDrawing(); });
    }

    if (document.readyState !== 'loading') {
        initializeAnnotation();
    } else {
        document.addEventListener('DOMContentLoaded', initializeAnnotation);
    }


    // ----- Drawing Functions -----

    function startDrawing(e) {
        if (!currentTool) {
            console.log('No tool selected, abort drawing');
            return;
        }
        if (!currentTool) return;
        isDrawing = true;
        console.log('Drawing started at', e.clientX, e.clientY);
        const rect = annotationCanvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        // Save current state for undo.
        undoStack.push(annotationCtx.getImageData(0, 0, annotationCanvas.width, annotationCanvas.height));
        redoStack = [];
        document.getElementById('annotation-undo').disabled = false;
        document.getElementById('annotation-redo').disabled = true;

        // Also store it in initialCanvasState for "live preview"
        initialCanvasState = annotationCtx.getImageData(0, 0, annotationCanvas.width, annotationCanvas.height);

        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
    }

    function draw(e) {
        if (!isDrawing || !currentTool) return;
        const rect = annotationCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Create a temporary canvas for preview.
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = annotationCanvas.width;
        tempCanvas.height = annotationCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Instead of copying the main canvas, revert to the original snapshot:
        tempCtx.putImageData(initialCanvasState, 0, 0);

        // Then draw the shape from (startX, startY) to (x, y)
        tempCtx.strokeStyle = annotationColor;
        tempCtx.lineWidth = 2;
        switch (currentTool) {
            case 'arrow':
                drawArrow(tempCtx, startX, startY, x, y);
                break;
            case 'rectangle':
                drawRectangle(tempCtx, startX, startY, x, y);
                break;
            case 'circle':
                drawCircle(tempCtx, startX, startY, x, y);
                break;
        }

        // Clear main canvas and copy the tempCanvas preview over
        annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        annotationCtx.drawImage(tempCanvas, 0, 0);
    }

    function stopDrawing() {
        isDrawing = false;
        // Disable pointer events on the canvas so that toolbar clicks work.
        annotationCanvas.style.pointerEvents = 'none';
    }

    // ----- Helper Drawing Functions -----

    function drawArrow(ctx, fromX, fromY, toX, toY) {
        const headLength = 15;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6),
            toY - headLength * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6),
            toY - headLength * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    }

    function drawRectangle(ctx, startX, startY, endX, endY) {
        const width = endX - startX;
        const height = endY - startY;
        ctx.beginPath();
        ctx.rect(startX, startY, width, height);
        ctx.stroke();
    }

    function drawCircle(ctx, startX, startY, endX, endY) {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        ctx.beginPath();
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
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
        </div>
        `;
        // Insert the viewport bar before the webview container
        container.insertBefore(viewportBar, webviewContainer);
        lucide.createIcons(viewportBar);

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
        <button id="save-custom" class="button">Save</button>
        <button id="cancel-custom" class="button-alt border border-neutral-400 text-neutral-800 bg-white hover:bg-gray-100">Cancel</button>
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

    // Toggle Sidebare keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 't') {
            e.preventDefault(); // Prevent browser's default new tab behavior
            const toggleSidebarButton = document.getElementById('toggle-sidebar');
            if (toggleSidebarButton) {
                toggleSidebarButton.click(); // Simulate click on the toggle button
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

    // Call it right after defining it
    setupViewportSwitcher();
    window.addEventListener('resize', updateViewportSize);
});

