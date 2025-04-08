// js/endGamePopup/PopupManager.js

// --- Module-level variables to hold references ---
let popupOverlay = null;
let popupContent = null;
let popupTitle = null;
let popupMessage = null;
let popupButtonContainer = null;
let currentButtonCallback = null;
let restartButton = null; // Reference specifically to the button element when created

let isInitialized = false;
let initializePromise = null;

// --- Asynchronous Initialization ---
async function initializePopup() {
    if (isInitialized) return; // Already done
    if (initializePromise) return initializePromise; // Initialization in progress

    console.log("Initializing Popup Manager...");

    initializePromise = new Promise(async (resolve, reject) => {
        try {
            // Fetch the HTML template content
            const response = await fetch('js/endGamePopup/popup.html');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} loading popup.html`);
            }
            const htmlText = await response.text();

            // Insert the HTML structure into the document body
            // Using a temporary div to parse avoids potential issues with direct body injection
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlText.trim();
            const fetchedOverlay = tempDiv.querySelector('#game-popup-overlay');

            if (!fetchedOverlay) {
                 throw new Error("Could not find #game-popup-overlay in fetched HTML.");
            }

            // Append the parsed overlay to the body
            document.body.appendChild(fetchedOverlay);

            // Now get references to the elements within the appended structure
            popupOverlay = document.getElementById('game-popup-overlay'); // Should exist now
            popupContent = document.getElementById('game-popup-content');
            popupTitle = document.getElementById('popup-title');
            popupMessage = document.getElementById('popup-message');
            popupButtonContainer = document.getElementById('popup-button-container');

            if (!popupOverlay || !popupContent || !popupTitle || !popupMessage || !popupButtonContainer) {
                 console.error("Failed to find all required popup elements after appending.");
                 // Attempt cleanup?
                 if (popupOverlay) document.body.removeChild(popupOverlay);
                 popupOverlay = null; // Reset references
                 reject(new Error("Popup initialization failed: Missing elements in DOM."));
                 return;
            }

             // Apply essential JS styles (display: none initially)
             popupOverlay.style.display = 'none';

            isInitialized = true;
            console.log("Popup Manager Initialized Successfully.");
            resolve(); // Signal completion

        } catch (error) {
            console.error("Error initializing popup:", error);
            isInitialized = false; // Ensure flag is false on error
            reject(error); // Propagate error
        } finally {
             initializePromise = null; // Clear the promise lock
        }
     });
     return initializePromise;
}

// --- Public Functions ---

/**
 * Shows the popup with specific content and an optional button.
 * Ensures initialization is complete before showing.
 * @param {string} message The main message.
 * @param {object} [options] Configuration object.
 * @param {string} [options.title] Optional title.
 * @param {string} [options.buttonText] Text for the button.
 * @param {function} [options.onButtonClick] Function to call when the button is clicked.
 */
export async function showPopup(message, options = {}) {
    try {
        await initializePopup(); // Wait for initialization if needed
    } catch (error) {
        console.error("Cannot show popup due to initialization failure.", error);
        // Optionally show a basic alert as fallback
        alert(`GAME OVER\n${message}\n(Popup failed to load)`);
        return;
    }


    // --- Populate Content ---
    // Title
    if (options.title && popupTitle) {
        popupTitle.textContent = options.title;
        popupTitle.style.display = 'block'; // Show title element
    } else if (popupTitle) {
        popupTitle.style.display = 'none'; // Hide title element if no title provided
    }

    // Message
    if (popupMessage) {
        popupMessage.textContent = message;
    }

    // --- Button Handling ---
    // Clear previous button and listener
    removeButtonListener();
    if (popupButtonContainer) {
        popupButtonContainer.innerHTML = ''; // Clear previous button
    }


    // Add new button if needed
    if (options.buttonText && typeof options.onButtonClick === 'function' && popupButtonContainer) {
        restartButton = document.createElement('button');
        restartButton.id = 'popup-restart-button'; // Use the ID from CSS (or #popup-restart-button)
        restartButton.className = 'popup-action-button'; // Add class for potential styling/selection
        restartButton.textContent = options.buttonText;

        // Store callback and add listener
        currentButtonCallback = options.onButtonClick;
        restartButton.addEventListener('click', handleButtonClick);

        popupButtonContainer.appendChild(restartButton); // Add button to its container
    }

    // Show the main overlay
    if (popupOverlay) {
        popupOverlay.style.display = 'flex'; // Use flex from CSS
        console.log("Showing popup:", message);
    } else {
         console.error("Cannot show popup, overlay element not found.");
    }
}

// Internal handler for the button click
function handleButtonClick() {
    console.log("Popup button clicked.");
    if (typeof currentButtonCallback === 'function') {
        currentButtonCallback();
    }
}

// Internal function to remove the listener
function removeButtonListener() {
     if (restartButton && typeof handleButtonClick === 'function') {
        restartButton.removeEventListener('click', handleButtonClick);
        console.log("Removed button listener.");
     }
     restartButton = null; // Clear button reference
     currentButtonCallback = null; // Clear callback reference
}

/**
 * Hides the popup.
 */
export function hidePopup() {
    if (popupOverlay) {
        popupOverlay.style.display = 'none';
        // Optional: Clear dynamic content if desired, but showPopup overwrites anyway
        // if(popupTitle) popupTitle.textContent = '';
        // if(popupMessage) popupMessage.textContent = '';
        // if(popupButtonContainer) popupButtonContainer.innerHTML = '';

        // IMPORTANT: Always remove listener when hiding
        removeButtonListener();
        console.log("Hiding popup");
    }
}

// Optional remove function (less critical now)
export function removePopup() {
     if (popupOverlay) {
         removeButtonListener();
         document.body.removeChild(popupOverlay);
         popupOverlay = null; /* Reset all references */
         popupContent = null;
         popupTitle = null;
         popupMessage = null;
         popupButtonContainer = null;
         isInitialized = false; /* Reset init flag */
         console.log("Removed popup from DOM");
     }
}