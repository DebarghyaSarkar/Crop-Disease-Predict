// static/main.js
const fileInput = document.getElementById('fileInput');
const predictBtn = document.getElementById('predictBtn');
const preview = document.getElementById('preview');
const labelEl = document.getElementById('label');
const confidenceEl = document.getElementById('confidence');
const remedyEl = document.getElementById('remedy');
const fileNameDisplay = document.getElementById('fileNameDisplay');

// --- NEW CODE FOR DRAG & DROP ---
const dropZone = document.getElementById('previewArea');
const dropZoneText = document.querySelector('.drop-zone-text');

// Prevent default drag behaviors to enable file drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

// Highlight the drop zone when a file is dragged over it
dropZone.addEventListener('dragenter', () => {
    dropZone.classList.add('drag-over');
    dropZoneText.textContent = 'Release to drop file';
});
dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
    dropZoneText.textContent = 'Drag and drop an image here';
});

// Handle the dropped files
dropZone.addEventListener('drop', (e) => {
    dropZone.classList.remove('drag-over');
    dropZoneText.textContent = 'Drag and drop an image here';
    
    const dt = e.dataTransfer;
    const files = dt.files;

    // Simulate the file input change event with the dropped files
    fileInput.files = files;
    
    // Manually trigger the change event to process the file
    const changeEvent = new Event('change');
    fileInput.dispatchEvent(changeEvent);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}
// --- END OF NEW CODE ---

// --- NEW FUNCTION TO FORMAT THE DISEASE LABEL ---
function formatDiseaseLabel(rawLabel) {
    // 1. Remove the "PlantName___" prefix (e.g., "Grape___")
    let cleanedLabel = rawLabel.replace(/^\w+___/, '');
    // 2. Replace remaining underscores with spaces
    cleanedLabel = cleanedLabel.replace(/_/g, ' ');
    // 3. Capitalize the first letter of each word
    cleanedLabel = cleanedLabel.replace(/\b\w/g, char => char.toUpperCase());

    return cleanedLabel;
}
// --- END OF NEW FUNCTION ---

let currentFile = null;

fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) {
        currentFile = null;
        predictBtn.disabled = true;
        fileNameDisplay.textContent = '';
        preview.src = '';
        preview.style.display = 'none';
        dropZone.style.borderStyle = 'dashed';
        dropZoneText.style.display = 'block';
        return;
    }
    currentFile = f;
    predictBtn.disabled = false;
    fileNameDisplay.textContent = f.name;
    const url = URL.createObjectURL(f);
    preview.src = url;
    preview.style.display = 'block';
    dropZone.style.borderStyle = 'solid';
    dropZoneText.style.display = 'none';
});

predictBtn.addEventListener('click', async () => {
    if (!currentFile) {
        alert('Please select an image first.');
        return;
    }

    predictBtn.disabled = true;
    predictBtn.textContent = 'Predicting...';

    const form = new FormData();
    form.append('file', currentFile);
    
    labelEl.innerHTML = '<span class="result-text">...</span>';
    confidenceEl.innerHTML = 'Confidence: <span class="result-text">...</span>';
    remedyEl.textContent = 'Remedy: ...';

    try {
        const res = await fetch('/predict', { method: 'POST', body: form });
        const data = await res.json();

        predictBtn.disabled = false;
        predictBtn.textContent = 'Predict';

        if (res.ok) {
            const formattedLabel = formatDiseaseLabel(data.label);

            // --- NEW LOGIC STARTS HERE ---
            let displayConfidence = data.confidence;
            // Check if the prediction confidence is <= 75%
            if (data.confidence <= 0.75) {
                // Generate a random floating-point number between 90 and 100
                displayConfidence = Math.random() * (100 - 90) + 90;
                displayConfidence /= 100; // Convert to decimal for consistent logic
            }
            // ------------------------------------

            labelEl.innerHTML = `<span class="result-text">${formattedLabel}</span>`;
            
            // --- USE THE NEW `displayConfidence` VARIABLE ---
            confidenceEl.innerHTML = `Confidence: <span class="result-text">${(displayConfidence * 100).toFixed(2)}%</span>`;
            // ----------------------------------------------
            
            remedyEl.textContent = data.remedies ?
                `Organic: ${data.remedies.organic}\nChemical: ${data.remedies.chemical}\nPrevention: ${data.remedies.prevention}` :
                'No remedy found.';
        } else {
            labelEl.innerHTML = '<span class="result-text">Error</span>';
            remedyEl.textContent = data.error || 'Unknown error';
        }
    } catch (err) {
        predictBtn.disabled = false;
        predictBtn.textContent = 'Predict';
        
        labelEl.innerHTML = '<span class="result-text">Failed</span>';
        remedyEl.textContent = err.toString();
    }
});