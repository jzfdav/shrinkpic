// worker.js
self.onmessage = async (e) => {
    const { file, targetBytes, format, mode } = e.data;

    try {
        const result = await compressToSize(file, targetBytes, format, mode);
        self.postMessage({ success: true, ...result });
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};

async function compressToSize(file, targetBytes, format, mode) {
    // In a worker, we use createImageBitmap
    const imgBitmap = await createImageBitmap(file);

    let width = imgBitmap.width;
    const origWidth = width;
    let height = imgBitmap.height;
    const origHeight = height;

    // Create OffscreenCanvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');

    let blob = null;

    // Helper to draw and get blob
    const getBlob = async (w, h, q) => {
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(imgBitmap, 0, 0, w, h);
        return await canvas.convertToBlob({ type: format, quality: q });
    };

    const isPng = format === 'image/png';

    if (isPng) {
        // PNG Strategy: Iterative Resize
        let scale = 1.0;
        blob = await getBlob(width, height, 1.0);

        let iterations = 0;
        // Optimization: Check initial size first
        if (blob.size > targetBytes) {
            while (blob.size > targetBytes && iterations < 20) {
                scale *= 0.9;
                width = Math.floor(origWidth * scale);
                height = Math.floor(origHeight * scale);
                blob = await getBlob(width, height, 1.0);
                iterations++;
            }
        }
    } else {
        // JPEG/AVIF Strategy: Binary Search on Quality
        // 1. First check at max quality
        blob = await getBlob(width, height, 1.0);

        // If already smaller, we're done
        if (blob.size > targetBytes) {

            // If file is WAY too big (>3x target) or Resolution Mode
            if (blob.size > targetBytes * 3 || mode === 'resolution') {
                let scale = 1.0;
                let limit = mode === 'resolution' ? 0.95 : 2.0;

                while (blob.size > targetBytes * limit && scale > 0.1) {
                    scale *= 0.75;
                    width = Math.floor(origWidth * scale);
                    height = Math.floor(origHeight * scale);
                    blob = await getBlob(width, height, 0.9);
                }
            }

            // Binary Search Quality
            let minQ = 0.0;
            let maxQ = 1.0;
            let bestBlob = blob;

            let iterations = 0;
            while (maxQ - minQ > 0.02 && iterations < 10) {
                let midQ = (minQ + maxQ) / 2;
                blob = await getBlob(width, height, midQ);

                if (blob.size === targetBytes) {
                    bestBlob = blob;
                    break;
                } else if (blob.size > targetBytes) {
                    maxQ = midQ;
                } else {
                    minQ = midQ;
                    bestBlob = blob;
                }
                iterations++;
            }
            blob = bestBlob;
        }
    }

    // Clean up
    imgBitmap.close();

    return { blob, width, height, origWidth, origHeight };
}
