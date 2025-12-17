// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
}

// --- DOM Elements ---
const els = {
    fileInput: document.getElementById('fileInput'),
    selectBtn: document.getElementById('selectBtn'),
    previewArea: document.getElementById('previewArea'),
    imagePreview: document.getElementById('imagePreview'),
    placeholder: document.querySelector('.placeholder-content'),
    loader: document.getElementById('loader'),
    sizeSlider: document.getElementById('sizeLimit'),
    sizeValue: document.getElementById('sizeValue'),
    statsBar: document.getElementById('statsBar'),
    origSize: document.getElementById('origSize'),
    origDim: document.getElementById('origDim'),
    newSize: document.getElementById('newSize'),
    newDim: document.getElementById('newDim'),
    resultButtons: document.getElementById('resultButtons'),
    downloadBtn: document.getElementById('downloadBtn'),
    shareBtn: document.getElementById('shareBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    modeRadios: document.getElementsByName('compMode'),
    formatRadios: document.getElementsByName('format'),
    versionDisplay: document.getElementById('versionDisplay')
};

// --- State ---
let currentFile = null;
let currentBlob = null;

// --- Initialization ---
// Check Web Share API support
if (navigator.share) {
    els.shareBtn.classList.remove('hidden');
}

// Set Version
if (typeof VERSION !== 'undefined' && els.versionDisplay) {
    els.versionDisplay.textContent = VERSION;
}

// --- Event Listeners ---

// 1. File Selection
els.selectBtn.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

// 2. Drag & Drop
els.previewArea.addEventListener('dragover', (e) => { e.preventDefault(); els.previewArea.style.opacity = '0.7'; });
els.previewArea.addEventListener('dragleave', () => { els.previewArea.style.opacity = '1'; });
els.previewArea.addEventListener('drop', (e) => {
    e.preventDefault();
    els.previewArea.style.opacity = '1';
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

// 3. Paste Support
document.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            handleFile(items[i].getAsFile());
            break;
        }
    }
});

// 4. Slider Change
els.sizeSlider.addEventListener('input', (e) => {
    els.sizeValue.textContent = `${e.target.value} KB`;
});
els.sizeSlider.addEventListener('change', () => {
    if (currentFile) processImage(currentFile);
});

// 5. Settings & Dark Mode
els.settingsBtn.addEventListener('click', () => els.settingsModal.classList.remove('hidden'));
els.closeSettings.addEventListener('click', () => els.settingsModal.classList.add('hidden'));

els.darkModeToggle.addEventListener('change', (e) => {
    document.body.classList.toggle('light-mode', !e.target.checked);
});

els.modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        if (currentFile) processImage(currentFile);
    });
});

els.formatRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        if (currentFile) processImage(currentFile);
    });
});

// 6. Share
els.shareBtn.addEventListener('click', async () => {
    if (currentBlob && navigator.share) {
        try {
            const format = document.querySelector('input[name="format"]:checked').value;
            let ext = 'jpg';
            if (format === 'image/png') ext = 'png';
            if (format === 'image/avif') ext = 'avif';
            const file = new File([currentBlob], `compressed.${ext}`, { type: format });
            await navigator.share({
                files: [file],
                title: 'Compressed Image',
                text: `Here is the compressed ${ext.toUpperCase()} image from JzfShrinkPic.`
            });
        } catch (err) {
            console.log('Share failed:', err);
        }
    }
});

// --- Core Logic ---

function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    currentFile = file;
    
    // UI Reset
    els.placeholder.classList.add('hidden');
    els.imagePreview.classList.add('hidden');
    els.loader.classList.remove('hidden');
    els.statsBar.classList.add('hidden');
    els.resultButtons.classList.add('hidden');
    els.selectBtn.classList.add('hidden'); // Hide select button during processing

    processImage(file);
}

async function processImage(file) {
    const targetSizeKB = parseInt(els.sizeSlider.value);
    const targetSizeBytes = targetSizeKB * 1024;

    try {
        const result = await compressToSize(file, targetSizeBytes);
        currentBlob = result.blob;

        // Update UI
        els.loader.classList.add('hidden');
        els.imagePreview.src = URL.createObjectURL(currentBlob);
        els.imagePreview.classList.remove('hidden');
        
        els.origSize.textContent = formatSize(file.size);
        els.newSize.textContent = formatSize(currentBlob.size);
        els.origDim.textContent = `${result.origWidth}×${result.origHeight}`;
        els.newDim.textContent = `${result.width}×${result.height}`;
        els.statsBar.classList.remove('hidden');

        // Setup Download
        const format = document.querySelector('input[name="format"]:checked').value;
        let ext = 'jpg';
        if (format === 'image/png') ext = 'png';
        if (format === 'image/avif') ext = 'avif';
        els.downloadBtn.download = `jzfshrinkpic-image.${ext}`;
        els.downloadBtn.href = els.imagePreview.src;
        
        // Show Buttons
        els.selectBtn.textContent = "Select Another";
        els.selectBtn.classList.remove('hidden');
        els.selectBtn.classList.remove('btn-primary'); // Demote main button
        els.selectBtn.classList.add('btn-secondary');
        
        els.resultButtons.classList.remove('hidden');

    } catch (error) {
        alert("Error: " + error.message);
        els.loader.classList.add('hidden');
        els.placeholder.classList.remove('hidden');
    }
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// --- Compression Engine ---
function compressToSize(file, targetBytes) {
    return new Promise((resolve, reject) => {
        const format = document.querySelector('input[name="format"]:checked').value;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                const origWidth = width;
                let height = img.height;
                const origHeight = height;
                let quality = 0.9;
                let blob = null;

                // Helper to get blob
                const getBlob = (w, h, q) => {
                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h); // This strips metadata
                    return new Promise(r => canvas.toBlob(r, format, q));
                };

                // 1. Initial Attempt
                blob = await getBlob(width, height, quality);

                // 2. Iterative Reduction
                let iterations = 0;

                while (blob.size > targetBytes && iterations < 20) {
                    const mode = document.querySelector('input[name="compMode"]:checked').value;
                    const isPng = format === 'image/png';

                    if (isPng) {
                        // PNG is lossless, quality param is ignored. Must resize.
                        width *= 0.9; height *= 0.9;
                    } else if (mode === 'quality') {
                        // Quality Mode: Resize early to preserve quality > 0.7
                        if (blob.size > targetBytes * 3) {
                            width *= 0.75; height *= 0.75;
                        } else if (quality > 0.7) {
                            quality -= 0.05;
                        } else {
                            width *= 0.9; height *= 0.9;
                        }
                    } else {
                        // Resolution Mode: Drop quality to 0.1 before resizing
                        if (quality > 0.1) {
                            quality -= 0.05;
                        } else {
                            width *= 0.9; height *= 0.9;
                        }
                    }
                    blob = await getBlob(width, height, quality);
                    iterations++;
                }

                resolve({ blob, width, height, origWidth, origHeight });
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}
