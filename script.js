// --- Centralized Logger ---
const logger = {
    info: (message, context = '', details = null) => {
        const logDetails = details !== null ? JSON.stringify(details) : '';
        console.log(`[INFO] ${new Date().toISOString()} ${context ? `[${context}]` : ''} ${message}`, logDetails);
    },
    warn: (message, context = '', details = null) => {
        const logDetails = details !== null ? JSON.stringify(details) : '';
        console.warn(`[WARN] ${new Date().toISOString()} ${context ? `[${context}]` : ''} ${message}`, logDetails);
    },
    error: (message, context = '', error = null, additionalDetails = null) => {
        let logMessage = `[ERROR] ${new Date().toISOString()} ${context ? `[${context}]` : ''} ${message}`;
        if (error) {
            logMessage += `\nError: ${error.message}`;
            if (error.stack) {
                logMessage += `\nStack: ${error.stack}`;
            }
        }
        const logDetails = additionalDetails !== null ? JSON.stringify(additionalDetails) : '';
        console.error(logMessage, logDetails);
    }
};

// IMPORTANT: Paste your Google Apps Script Web App URL here
const SCRIPT_URL = "https://script.google.com/macros/library/d/1W5btokMU8IC_wo3-bddUuzOAFCTyi0MkxrMkvUVYVu3oY2cBlfj3xNhs/1";

// --- DOM Elements ---
const startHomeBtn = document.getElementById('startHomeBtn');
const startOfficeBtn = document.getElementById('startOfficeBtn');
const stopWorkBtn = document.getElementById('stopWorkBtn');
const currentStatus = document.getElementById('currentStatus');

const workDateInput = document.getElementById('workDate');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const locationInput = document.getElementById('location');
const notesInput = document.getElementById('notes');
const addEntryBtn = document.getElementById('addEntryBtn');

const refreshLogBtn = document.getElementById('refreshLogBtn');
const logTableBody = document.querySelector('#logTable tbody');

// --- State for Quick Start/Stop ---
let currentWorkSession = null; // { startTime: "HH:MM", date: "YYYY-MM-DD", location: "Home/Office" }

// --- DOM Element Sanity Checks ---
function checkElements() {
    const CONTEXT = 'checkElements';
    const elements = {
        startHomeBtn, startOfficeBtn, stopWorkBtn, currentStatus,
        workDateInput, startTimeInput, endTimeInput, locationInput, notesInput, addEntryBtn,
        refreshLogBtn, logTableBody
    };
    let allFound = true;
    for (const key in elements) {
        if (!elements[key]) {
            logger.error(`DOM element not found: ID/Selector = '${key}'`, CONTEXT);
            allFound = false;
        }
    }
    if (!allFound) {
        alert("Critical UI elements are missing. The app might not work correctly. Check the console for details.");
    } else {
        logger.info('All essential DOM elements found.', CONTEXT);
    }
    return allFound;
}


function updateCurrentStatusDisplay() {
    const CONTEXT = 'updateCurrentStatusDisplay';
    if (currentWorkSession) {
        const statusText = `Status: Working at ${currentWorkSession.location} since ${currentWorkSession.startTime} on ${currentWorkSession.date}.`;
        currentStatus.textContent = statusText;
        startHomeBtn.disabled = true;
        startOfficeBtn.disabled = true;
        stopWorkBtn.disabled = false;
        logger.info('Status updated to "Working".', CONTEXT, { session: currentWorkSession, statusText });
    } else {
        currentStatus.textContent = "Status: Not working.";
        startHomeBtn.disabled = false;
        startOfficeBtn.disabled = false;
        stopWorkBtn.disabled = true;
        logger.info('Status updated to "Not working".', CONTEXT);
    }
}

function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function saveData(data) {
    const CONTEXT = 'saveData';
    logger.info('Attempting to save data.', CONTEXT, { data });
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        logger.info(`Received response with status: ${response.status}`, CONTEXT, { url: SCRIPT_URL, ok: response.ok, statusText: response.statusText });

        if (!response.ok) {
            let errorBodyText = `HTTP error! Status: ${response.status} ${response.statusText}`;
            try {
                const body = await response.text();
                logger.warn('Non-OK response body (text):', CONTEXT, { body });
                errorBodyText += ` - Body: ${body.substring(0, 500)}${body.length > 500 ? '...' : ''}`; // Log a snippet
            } catch (e) {
                logger.warn('Could not read non-OK response body.', CONTEXT, e);
            }
            alert("Error saving data: " + errorBodyText);
            logger.error('Server returned non-OK response.', CONTEXT, new Error(errorBodyText), { responseStatus: response.status, responseStatusText: response.statusText });
            return false;
        }

        const result = await response.json();
        logger.info('Parsed response from Apps Script.', CONTEXT, { result });

        if (result.success) {
            alert(result.message || "Data saved successfully!");
            logger.info('Data saved successfully via Apps Script.', CONTEXT, { message: result.message });
            loadLogEntries(); // Refresh the log
            return true;
        } else {
            const errorMessage = result.error || "Unknown error from Apps Script";
            alert("Error saving data: " + errorMessage);
            logger.error('Apps Script reported an error during save.', CONTEXT, new Error(errorMessage), { scriptResponse: result });
            return false;
        }
    } catch (error) {
        const errorMessage = "Network or script error during save: " + error.message;
        alert(errorMessage);
        logger.error('Fetch exception during saveData.', CONTEXT, error, { dataSent: data, url: SCRIPT_URL });
        return false;
    }
}

startHomeBtn.addEventListener('click', () => {
    const CONTEXT = 'startHomeBtnClick';
    logger.info('Button clicked.', CONTEXT);
    if (currentWorkSession) {
        const message = "You are already working!";
        logger.warn(message, CONTEXT, { currentWorkSession });
        alert(message);
        return;
    }
    currentWorkSession = {
        startTime: getCurrentTime(),
        date: getCurrentDate(),
        location: "Home"
    };
    logger.info('New work session started.', CONTEXT, { session: currentWorkSession });
    try {
        localStorage.setItem('currentWorkSession', JSON.stringify(currentWorkSession));
        logger.info('Work session saved to localStorage.', CONTEXT);
    } catch (e) {
        logger.error('Error saving session to localStorage.', CONTEXT, e, { session: currentWorkSession });
        alert('Error saving session locally. Please check console for details.');
    }
    updateCurrentStatusDisplay();
    alert(`Work started at Home at ${currentWorkSession.startTime}`);
});

startOfficeBtn.addEventListener('click', () => {
    const CONTEXT = 'startOfficeBtnClick';
    logger.info('Button clicked.', CONTEXT);
    if (currentWorkSession) {
        const message = "You are already working!";
        logger.warn(message, CONTEXT, { currentWorkSession });
        alert(message);
        return;
    }
    currentWorkSession = {
        startTime: getCurrentTime(),
        date: getCurrentDate(),
        location: "Office"
    };
    logger.info('New work session started.', CONTEXT, { session: currentWorkSession });
    try {
        localStorage.setItem('currentWorkSession', JSON.stringify(currentWorkSession));
        logger.info('Work session saved to localStorage.', CONTEXT);
    } catch (e) {
        logger.error('Error saving session to localStorage.', CONTEXT, e, { session: currentWorkSession });
        alert('Error saving session locally. Please check console for details.');
    }
    updateCurrentStatusDisplay();
    alert(`Work started at Office at ${currentWorkSession.startTime}`);
});

stopWorkBtn.addEventListener('click', async () => {
    const CONTEXT = 'stopWorkBtnClick';
    logger.info('Button clicked.', CONTEXT);
    if (!currentWorkSession) {
        const message = "You are not currently working!";
        logger.warn(message, CONTEXT);
        alert(message);
        return;
    }
    const endTime = getCurrentTime();
    const dataToSave = {
        ...currentWorkSession,
        endTime: endTime,
        notes: `Quick stop for session started at ${currentWorkSession.startTime}`
    };
    logger.info('Attempting to save work session stop.', CONTEXT, { dataToSave });

    const success = await saveData(dataToSave);
    if (success) {
        logger.info('Work session successfully stopped and logged.', CONTEXT, { endTime });
        alert(`Work stopped at ${endTime}. Entry logged.`);
        currentWorkSession = null;
        try {
            localStorage.removeItem('currentWorkSession');
            logger.info('currentWorkSession removed from localStorage.', CONTEXT);
        } catch (e) {
            logger.error('Error removing session from localStorage.', CONTEXT, e);
        }
        updateCurrentStatusDisplay();
    } else {
        logger.warn('Failed to save work session stop (saveData returned false).', CONTEXT, { dataToSave });
        // Alert is handled by saveData if there was an error there
    }
});

addEntryBtn.addEventListener('click', async () => {
    const CONTEXT = 'addEntryBtnClick';
    logger.info('Button clicked.', CONTEXT);

    const date = workDateInput.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    const location = locationInput.value;
    const notes = notesInput.value;

    logger.info('Manual entry form values.', CONTEXT, { date, startTime, endTime, location, notes });

    if (!date || !startTime || !location) {
        const message = "Please fill in Date, Start Time, and Location for manual entry.";
        logger.warn(message, CONTEXT, { date, startTime, location });
        alert(message);
        return;
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime)) {
        const message = "Invalid Start Time format. Please use HH:MM.";
        logger.warn(message, CONTEXT, { startTime });
        alert(message);
        startTimeInput.focus();
        return;
    }
    if (endTime && !timeRegex.test(endTime)) { // only validate if not empty
        const message = "Invalid End Time format. Please use HH:MM or leave blank.";
        logger.warn(message, CONTEXT, { endTime });
        alert(message);
        endTimeInput.focus();
        return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        const message = "Invalid Date format. Please use YYYY-MM-DD.";
        logger.warn(message, CONTEXT, { date });
        alert(message);
        workDateInput.focus();
        return;
    }


    const dataToSave = { date, startTime, endTime, location, notes };
    logger.info('Attempting to save manual entry.', CONTEXT, { dataToSave });

    const success = await saveData(dataToSave);
    if (success) {
        logger.info('Manual entry successfully saved.', CONTEXT);
        // Clear form
        workDateInput.value = getCurrentDate(); // Reset to current date
        startTimeInput.value = '';
        endTimeInput.value = '';
        // locationInput.value = 'Home'; // Reset or keep last
        notesInput.value = '';
        logger.info('Manual entry form cleared.', CONTEXT);
    } else {
        logger.warn('Failed to save manual entry (saveData returned false).', CONTEXT, { dataToSave });
    }
});

async function loadLogEntries() {
    const CONTEXT = 'loadLogEntries';
    logger.info('Attempting to load log entries.', CONTEXT);
    if (!logTableBody) {
        logger.error('logTableBody element not found. Cannot display logs.', CONTEXT);
        return;
    }
    logTableBody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
    try {
        // Append a dummy query param to try and bypass caching if needed
        // Also good practice to add an 'action' parameter if your Apps Script doGet handles multiple operations
        const urlWithCacheBust = `${SCRIPT_URL}?action=getLog&cacheBust=${new Date().getTime()}`;
        logger.info('Fetching from URL:', CONTEXT, { url: urlWithCacheBust });

        const response = await fetch(urlWithCacheBust, {
             method: 'GET',
        });

        logger.info(`Received response with status: ${response.status}`, CONTEXT, { url: urlWithCacheBust, ok: response.ok, statusText: response.statusText });

        if (!response.ok) {
            let errorBodyText = `HTTP error! Status: ${response.status} ${response.statusText}`;
            try {
                const body = await response.text();
                logger.warn('Non-OK response body (text):', CONTEXT, { body });
                errorBodyText += ` - Body: ${body.substring(0, 500)}${body.length > 500 ? '...' : ''}`;
            } catch (e) {
                logger.warn('Could not read non-OK response body.', CONTEXT, e);
            }
            logTableBody.innerHTML = `<tr><td colspan="6">Error loading data: ${errorBodyText}</td></tr>`;
            logger.error('Server returned non-OK response while loading logs.', CONTEXT, new Error(errorBodyText), { responseStatus: response.status, responseStatusText: response.statusText });
            return;
        }

        const result = await response.json();
        logger.info('Parsed response from Apps Script (GET).', CONTEXT, { result });

        if (result.success && result.data) {
            logTableBody.innerHTML = ''; // Clear loading/previous entries
            if (result.data.length === 0) {
                logger.info('No log entries found.', CONTEXT);
                logTableBody.innerHTML = '<tr><td colspan="6">No entries found.</td></tr>';
            } else {
                logger.info(`Displaying ${result.data.length} log entries.`, CONTEXT);
                result.data.forEach((entry, index) => {
                    try {
                        // Log if essential fields might be missing (using typeof to check for undefined)
                        if (typeof entry.Date === 'undefined' || typeof entry.StartTime === 'undefined' || typeof entry.Location === 'undefined') {
                            logger.warn(`Log entry at index ${index} is missing one or more essential fields (Date, StartTime, Location).`, CONTEXT, { entryData: entry });
                        }

                        const row = logTableBody.insertRow();
                        row.insertCell().textContent = entry.Date ? new Date(entry.Date).toLocaleDateString() : 'N/A';
                        row.insertCell().textContent = entry.StartTime || 'N/A';
                        row.insertCell().textContent = entry.EndTime || 'N/A';
                        row.insertCell().textContent = entry.Location || 'N/A';
                        row.insertCell().textContent = entry.Duration || 'N/A'; // Ensure this is calculated/provided by Apps Script
                        row.insertCell().textContent = entry.Notes || '';
                    } catch (e) {
                        logger.error(`Error processing/displaying log entry at index ${index}`, CONTEXT, e, { entryData: entry });
                        const errorRow = logTableBody.insertRow(); // Add a row indicating an error for this specific entry
                        const cell = errorRow.insertCell();
                        cell.colSpan = 6;
                        cell.textContent = `Error displaying entry (index ${index}): ${e.message}. See console.`;
                        cell.style.color = 'red';
                    }
                });
            }
        } else {
            const errorMessage = result.error || 'Unknown error from Apps Script (GET) or data missing';
            logTableBody.innerHTML = `<tr><td colspan="6">Error loading data: ${errorMessage}</td></tr>`;
            logger.error('Apps Script reported an error or no data during log load.', CONTEXT, new Error(errorMessage), { scriptResponse: result });
        }
    } catch (error) {
        const errorMessage = `Failed to fetch log: ${error.message}`;
        logTableBody.innerHTML = `<tr><td colspan="6">${errorMessage}</td></tr>`;
        logger.error('Fetch exception during loadLogEntries.', CONTEXT, error, {url: SCRIPT_URL});
    }
}

refreshLogBtn.addEventListener('click', () => {
    const CONTEXT = 'refreshLogBtnClick';
    logger.info('Button clicked, manually refreshing log entries.', CONTEXT);
    loadLogEntries();
});

// --- On Page Load ---
function initializeApp() {
    const CONTEXT = 'initializeApp';
    logger.info('Application initializing...', CONTEXT);

    if (!checkElements()) {
        logger.error("Initialization aborted due to missing DOM elements. App functionality will be impaired.", CONTEXT);
        // Depending on severity, you might want to `return` here or disable parts of the UI.
        // For now, it will continue but log the errors.
    }

    // Set default date for manual entry
    try {
        if(workDateInput) workDateInput.value = getCurrentDate();
        logger.info('Default date set for manual entry.', CONTEXT, { date: workDateInput ? workDateInput.value : 'N/A (element missing)' });
    } catch (e) {
        logger.error('Failed to set default date for manual entry.', CONTEXT, e);
    }

    // Load current session from localStorage (if browser was closed)
    try {
        const storedSessionString = localStorage.getItem('currentWorkSession');
        if (storedSessionString) {
            logger.info('Found stored work session in localStorage.', CONTEXT, { storedSessionString });
            currentWorkSession = JSON.parse(storedSessionString);
            logger.info('Parsed stored work session.', CONTEXT, { currentWorkSession });
        } else {
            logger.info('No work session found in localStorage.', CONTEXT);
        }
    } catch (e) {
        logger.error('Error loading or parsing session from localStorage. Clearing stored session.', CONTEXT, e, {rawStoredValue: localStorage.getItem('currentWorkSession')});
        localStorage.removeItem('currentWorkSession'); // Clear potentially corrupt data
        currentWorkSession = null; // Ensure a clean state
        alert('Could not restore previous session due to an error (it might have been corrupted). Starting fresh.');
    }

    if (currentStatus && startHomeBtn && startOfficeBtn && stopWorkBtn) { // Check if elements exist before updating
         updateCurrentStatusDisplay();
    } else {
        logger.warn('Cannot update current status display due to missing UI elements.', CONTEXT);
    }

    if (logTableBody && refreshLogBtn) { // Check if elements exist before loading
        loadLogEntries();
    } else {
         logger.warn('Cannot load log entries due to missing UI elements for log display.', CONTEXT);
    }

    logger.info('Application initialization complete.', CONTEXT);
}

// Ensure DOM is fully loaded before running initializeApp, especially if script is in <head>
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp(); // DOMContentLoaded has already fired
}
