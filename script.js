// IMPORTANT: Paste your Google Apps Script Web App URL here
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxAbYk6vTXm_c4JEzIK95SnWOcVZtumfpTz1KhnTXoIQXnM2aybvHB1_Peg6iyc_C8B/exec";

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

function updateCurrentStatusDisplay() {
    if (currentWorkSession) {
        currentStatus.textContent = `Status: Working at ${currentWorkSession.location} since ${currentWorkSession.startTime} on ${currentWorkSession.date}.`;
        startHomeBtn.disabled = true;
        startOfficeBtn.disabled = true;
        stopWorkBtn.disabled = false;
    } else {
        currentStatus.textContent = "Status: Not working.";
        startHomeBtn.disabled = false;
        startOfficeBtn.disabled = false;
        stopWorkBtn.disabled = true;
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
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            // mode: 'cors', // Removed
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            // redirect: 'follow' // Apps Script web apps can issue redirects. Handle them if necessary.
        });
        const result = await response.json();
        if (result.success) {
            alert(result.message || "Data saved successfully!");
            loadLogEntries(); // Refresh the log
            return true;
        } else {
            alert("Error saving data: " + (result.error || "Unknown error"));
            console.error("Error from Apps Script:", result);
            return false;
        }
    } catch (error) {
        alert("Network or script error: " + error.message);
        console.error("Fetch error:", error);
        return false;
    }
}

startHomeBtn.addEventListener('click', () => {
    if (currentWorkSession) {
        alert("You are already working!");
        return;
    }
    currentWorkSession = {
        startTime: getCurrentTime(),
        date: getCurrentDate(),
        location: "Home"
    };
    localStorage.setItem('currentWorkSession', JSON.stringify(currentWorkSession));
    updateCurrentStatusDisplay();
    alert(`Work started at Home at ${currentWorkSession.startTime}`);
});

startOfficeBtn.addEventListener('click', () => {
    if (currentWorkSession) {
        alert("You are already working!");
        return;
    }
    currentWorkSession = {
        startTime: getCurrentTime(),
        date: getCurrentDate(),
        location: "Office"
    };
    localStorage.setItem('currentWorkSession', JSON.stringify(currentWorkSession));
    updateCurrentStatusDisplay();
    alert(`Work started at Office at ${currentWorkSession.startTime}`);
});

stopWorkBtn.addEventListener('click', async () => {
    if (!currentWorkSession) {
        alert("You are not currently working!");
        return;
    }
    const endTime = getCurrentTime();
    const dataToSave = {
        ...currentWorkSession,
        endTime: endTime,
        notes: `Quick stop for session started at ${currentWorkSession.startTime}`
    };

    const success = await saveData(dataToSave);
    if (success) {
        alert(`Work stopped at ${endTime}. Entry logged.`);
        currentWorkSession = null;
        localStorage.removeItem('currentWorkSession');
        updateCurrentStatusDisplay();
    }
});

addEntryBtn.addEventListener('click', async () => {
    const date = workDateInput.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    const location = locationInput.value;
    const notes = notesInput.value;

    if (!date || !startTime || !location) {
        alert("Please fill in Date, Start Time, and Location for manual entry.");
        return;
    }

    const dataToSave = { date, startTime, endTime, location, notes };
    const success = await saveData(dataToSave);
    if (success) {
        // Clear form
        workDateInput.value = '';
        startTimeInput.value = '';
        endTimeInput.value = '';
        // locationInput.value = 'Home'; // Reset or keep last
        notesInput.value = '';
    }
});

async function loadLogEntries() {
    logTableBody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
    try {
        // Append a dummy query param to try and bypass caching if needed
        const response = await fetch(`${SCRIPT_URL}?cacheBust=${new Date().getTime()}`, {
             method: 'GET',
             // mode: 'cors' // Removed
        });
        const result = await response.json();

        if (result.success && result.data) {
            logTableBody.innerHTML = ''; // Clear loading/previous entries
            // The first row in Sheets might be headers, Apps Script already removed it.
            // Data is an array of objects
            result.data.forEach(entry => {
                // Ensure keys match your Google Sheet headers for entry object
                const row = logTableBody.insertRow();
                row.insertCell().textContent = entry.Date ? new Date(entry.Date).toLocaleDateString() : 'N/A';
                row.insertCell().textContent = entry.StartTime || 'N/A';
                row.insertCell().textContent = entry.EndTime || 'N/A';
                row.insertCell().textContent = entry.Location || 'N/A';
                row.insertCell().textContent = entry.Duration || 'N/A';
                row.insertCell().textContent = entry.Notes || '';
            });
        } else {
            logTableBody.innerHTML = `<tr><td colspan="6">Error loading data: ${result.error || 'Unknown error'}</td></tr>`;
            console.error("Error from Apps Script (GET):", result);
        }
    } catch (error) {
        logTableBody.innerHTML = `<tr><td colspan="6">Failed to fetch log: ${error.message}</td></tr>`;
        console.error("Fetch error (GET):", error);
    }
}

refreshLogBtn.addEventListener('click', loadLogEntries);

// --- On Page Load ---
function initializeApp() {
    // Set default date for manual entry
    workDateInput.value = getCurrentDate();

    // Load current session from localStorage (if browser was closed)
    const storedSession = localStorage.getItem('currentWorkSession');
    if (storedSession) {
        currentWorkSession = JSON.parse(storedSession);
    }
    updateCurrentStatusDisplay();
    loadLogEntries();
}

initializeApp();
