// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
}

class App {
    constructor() {
        // --- DOM Elements ---
        this.els = {
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
            installBtn: document.getElementById('installBtn'),
            settingsModal: document.getElementById('settingsModal'),
            closeSettings: document.getElementById('closeSettings'),
            darkModeToggle: document.getElementById('darkModeToggle'),
            modeRadios: document.getElementsByName('compMode'),
            formatRadios: document.getElementsByName('format'),
            versionDisplay: document.getElementById('versionDisplay'),
            iosGuide: document.getElementById('iosGuide')
        };

        // --- State ---
        this.state = {
            currentFile: null,
            currentBlob: null,
            deferredPrompt: null
        };

        // --- Worker ---
        this.worker = new Worker('worker.js');
        this.setupWorker();

        // --- Init ---
        this.init();
        this.bindEvents();
    }

    init() {
        // Check Web Share API support
        if (navigator.share) {
            this.els.shareBtn.classList.remove('hidden');
        }

        // Set Version
        if (typeof VERSION !== 'undefined' && this.els.versionDisplay) {
            this.els.versionDisplay.textContent = VERSION;
        }

        // Detect iOS for Install Guide
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isIos && this.els.iosGuide) {
            this.els.iosGuide.classList.remove('hidden');
        }
    }

    bindEvents() {
        // --- PWA Install Logic ---
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.state.deferredPrompt = e;
            this.els.installBtn.classList.remove('hidden');
        });

        this.els.installBtn.addEventListener('click', async () => {
            if (!this.state.deferredPrompt) return;
            this.state.deferredPrompt.prompt();
            const { outcome } = await this.state.deferredPrompt.userChoice;
            this.state.deferredPrompt = null;
            this.els.installBtn.classList.add('hidden');
        });

        window.addEventListener('appinstalled', () => {
            this.els.installBtn.classList.add('hidden');
            this.state.deferredPrompt = null;
        });

        // 1. File Selection
        this.els.selectBtn.addEventListener('click', () => this.els.fileInput.click());
        this.els.fileInput.addEventListener('change', (e) => this.handleFile(e.target.files[0]));

        // 2. Drag & Drop
        this.els.previewArea.addEventListener('dragover', (e) => { e.preventDefault(); this.els.previewArea.style.opacity = '0.7'; });
        this.els.previewArea.addEventListener('dragleave', () => { this.els.previewArea.style.opacity = '1'; });
        this.els.previewArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.els.previewArea.style.opacity = '1';
            if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]);
        });

        // 3. Paste Support
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    this.handleFile(items[i].getAsFile());
                    break;
                }
            }
        });

        // 4. Slider Change
        this.els.sizeSlider.addEventListener('input', (e) => {
            this.els.sizeValue.textContent = `${e.target.value} KB`;
        });
        this.els.sizeSlider.addEventListener('change', () => {
            if (this.state.currentFile) this.processImage(this.state.currentFile);
        });

        // 5. Settings & Dark Mode
        this.els.settingsBtn.addEventListener('click', () => this.els.settingsModal.classList.remove('hidden'));
        this.els.closeSettings.addEventListener('click', () => this.els.settingsModal.classList.add('hidden'));

        this.els.darkModeToggle.addEventListener('change', (e) => {
            document.body.classList.toggle('light-mode', !e.target.checked);
        });

        Array.from(this.els.modeRadios).forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.state.currentFile) this.processImage(this.state.currentFile);
            });
        });

        Array.from(this.els.formatRadios).forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.state.currentFile) this.processImage(this.state.currentFile);
            });
        });

        // 6. Share
        this.els.shareBtn.addEventListener('click', async () => {
            if (this.state.currentBlob && navigator.share) {
                try {
                    const format = document.querySelector('input[name="format"]:checked').value;
                    let ext = 'jpg';
                    if (format === 'image/png') ext = 'png';
                    if (format === 'image/avif') ext = 'avif';
                    const file = new File([this.state.currentBlob], `compressed.${ext}`, { type: format });
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
    }

    setupWorker() {
        this.worker.onerror = (e) => {
            console.error("Worker Error: " + e.message);
            alert("Worker Error: " + e.message);
            this.els.loader.classList.add('hidden');
            this.els.placeholder.classList.remove('hidden');
        };
    }

    handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        this.state.currentFile = file;

        // UI Reset
        this.els.placeholder.classList.add('hidden');
        this.els.imagePreview.classList.add('hidden');
        this.els.loader.classList.remove('hidden');
        this.els.statsBar.classList.add('hidden');
        this.els.resultButtons.classList.add('hidden');
        this.els.selectBtn.classList.add('hidden');

        this.processImage(file);
    }

    async processImage(file) {
        const targetSizeKB = parseInt(this.els.sizeSlider.value);
        const targetSizeBytes = targetSizeKB * 1024;

        try {
            const result = await this.compressToSize(file, targetSizeBytes);
            this.state.currentBlob = result.blob;

            // Update UI
            this.els.loader.classList.add('hidden');
            this.els.imagePreview.src = URL.createObjectURL(this.state.currentBlob);
            this.els.imagePreview.classList.remove('hidden');

            this.els.origSize.textContent = this.formatSize(file.size);
            this.els.newSize.textContent = this.formatSize(this.state.currentBlob.size);
            this.els.origDim.textContent = `${result.origWidth}×${result.origHeight}`;
            this.els.newDim.textContent = `${result.width}×${result.height}`;
            this.els.statsBar.classList.remove('hidden');

            // Setup Download
            const format = document.querySelector('input[name="format"]:checked').value;
            let ext = 'jpg';
            if (format === 'image/png') ext = 'png';
            if (format === 'image/avif') ext = 'avif';
            this.els.downloadBtn.download = `jzfshrinkpic-image.${ext}`;
            this.els.downloadBtn.href = this.els.imagePreview.src;

            // Show Buttons
            this.els.selectBtn.textContent = "Select Another";
            this.els.selectBtn.classList.remove('hidden');
            this.els.selectBtn.classList.remove('btn-primary');
            this.els.selectBtn.classList.add('btn-secondary');

            this.els.resultButtons.classList.remove('hidden');

        } catch (error) {
            alert("Error: " + error.message);
            this.els.loader.classList.add('hidden');
            this.els.placeholder.classList.remove('hidden');
        }
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    compressToSize(file, targetBytes) {
        return new Promise((resolve, reject) => {
            const format = document.querySelector('input[name="format"]:checked').value;
            const mode = document.querySelector('input[name="compMode"]:checked').value;

            this.worker.onmessage = (e) => {
                const { success, error, blob, width, height, origWidth, origHeight } = e.data;
                if (success) {
                    resolve({ blob, width, height, origWidth, origHeight });
                } else {
                    reject(new Error(error));
                }
            };

            this.worker.postMessage({ file, targetBytes, format, mode });
        });
    }
}

// Instantiate App
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
