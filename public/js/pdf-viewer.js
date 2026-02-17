const url = BOOK_URL;

let pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    scale = 1.0,
    canvas = document.createElement('canvas'),
    ctx = canvas.getContext('2d'),
    pdfContainer = document.getElementById('viewer-container');

// UI Elements
const pageNumSpan = document.getElementById('pageInput');
const pageCountSpan = document.getElementById('totalPages');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const zoomLevelSpan = document.getElementById('zoomLevel');

// Append canvas to container
pdfContainer.appendChild(canvas);
canvas.className = 'pdf-page-canvas';

/**
 * Get page info from document, resize canvas accordingly, and render page.
 * @param num Page number.
 */
function renderPage(num) {
    pageRendering = true;

    // Update current page input
    pageNumSpan.value = num;

    pdfDoc.getPage(num).then(function (page) {
        const viewport = page.getViewport({ scale: scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render PDF page into canvas context
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        const renderTask = page.render(renderContext);

        // Wait for render to finish
        renderTask.promise.then(function () {
            pageRendering = false;
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });

    // Update page counters
    pageNumSpan.value = num;
}

/**
 * If another page rendering in progress, waits until the rendering is
 * finised. Otherwise, executes rendering immediately.
 */
function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

/**
 * Displays previous page.
 */
function onPrevPage() {
    if (pageNum <= 1) {
        return;
    }
    pageNum--;
    queueRenderPage(pageNum);
}
prevBtn.addEventListener('click', onPrevPage);

/**
 * Displays next page.
 */
function onNextPage() {
    if (pageNum >= pdfDoc.numPages) {
        return;
    }
    pageNum++;
    queueRenderPage(pageNum);
}
nextBtn.addEventListener('click', onNextPage);

/**
 * Zoom In
 */
zoomInBtn.addEventListener('click', () => {
    scale += 0.1;
    zoomLevelSpan.textContent = Math.round(scale * 100) + '%';
    renderPage(pageNum);
});

/**
 * Zoom Out
 */
zoomOutBtn.addEventListener('click', () => {
    if (scale <= 0.5) return;
    scale -= 0.1;
    zoomLevelSpan.textContent = Math.round(scale * 100) + '%';
    renderPage(pageNum);
});

/**
 * Page Input Change
 */
pageNumSpan.addEventListener('change', (e) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && page <= pdfDoc.numPages) {
        pageNum = page;
        queueRenderPage(pageNum);
    } else {
        pageNumSpan.value = pageNum;
    }
});

/**
 * Highlight / Bookmark (Simulated for PDF Canvas)
 */
document.getElementById('highlightBtn').addEventListener('click', async () => {
    // For canvas PDF, we can't easily select text without text layer.
    // Saving the page as a 'bookmark' style highlight.
    try {
        const response = await fetch(`/api/book/${BOOK_ID}/highlight`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                highlight: {
                    page: pageNum,
                    type: 'bookmark',
                    color: 'yellow' // Default for now
                }
            })
        });
        const data = await response.json();
        if (data.success) {
            alert('Page ' + pageNum + ' bookmarked!');
        }
    } catch (e) {
        console.error('Error saving highlight', e);
    }
});

/**
 * Asynchronously downloads PDF.
 */
pdfjsLib.getDocument(url).promise.then(function (pdfDoc_) {
    pdfDoc = pdfDoc_;
    pageCountSpan.textContent = pdfDoc.numPages;

    // Auto-Resume
    if (BOOK_LAST_READ && typeof BOOK_LAST_READ === 'number') {
        pageNum = BOOK_LAST_READ;
    }

    renderPage(pageNum);
});

/**
 * Scroll Functionality (Mouse Wheel)
 */
window.addEventListener('wheel', (e) => {
    // Only if not zooming (ctrl key usually implied zoom)
    if (e.ctrlKey) return;

    if (e.deltaY > 0) {
        onNextPage();
    } else {
        onPrevPage();
    }
});

/**
 * Save Progress
 */
function saveProgress(page) {
    if (!BOOK_ID) return;
    fetch(`/api/book/${BOOK_ID}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: page })
    }).catch(err => console.error('Error saving progress:', err));
}

// Hook into renderPage to save progress (debounced slightly or just per page turn)
const originalRenderPage = renderPage;
renderPage = function (num) {
    originalRenderPage(num);
    saveProgress(num);
}
