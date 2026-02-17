const url = BOOK_URL;

const book = ePub(url);

const rendition = book.renderTo("epub-viewer", {
    width: "100%",
    height: "100%",
    flow: "scrolled-doc" // Continuous scroll mainly, but pagination works too
});

// Register Themes
rendition.themes.register("dark", {
    body: { color: "#ddd", background: "#333" },
    p: { color: "#ddd" },
    h1: { color: "#fff" },
    h2: { color: "#fff" },
    h3: { color: "#fff" },
    a: { color: "#6366f1" } // Indigo-500
});

// Display - Auto Resume
const displayed = rendition.display(BOOK_LAST_READ || undefined);

// Apply initial request
if (localStorage.theme === 'dark') {
    rendition.themes.select("dark");
}

// Listen for global theme changes
window.addEventListener('theme-change', (e) => {
    if (e.detail === 'dark') {
        rendition.themes.select("dark");
    } else {
        rendition.themes.select("default");
    }
});

// UI Elements
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomLevelSpan = document.getElementById('zoomLevel');
const pageNumSpan = document.getElementById('pageInput');
const pageCountSpan = document.getElementById('totalPages'); // EPUBs don't always have page counts

let currentFontSize = 100;

// Navigation
prevBtn.addEventListener('click', () => rendition.prev());
nextBtn.addEventListener('click', () => rendition.next());

// Zoom (Font Size)
zoomInBtn.addEventListener('click', () => {
    currentFontSize += 10;
    rendition.themes.fontSize(currentFontSize + "%");
    zoomLevelSpan.textContent = currentFontSize + '%';
});

zoomOutBtn.addEventListener('click', () => {
    if (currentFontSize <= 50) return;
    currentFontSize -= 10;
    rendition.themes.fontSize(currentFontSize + "%");
    zoomLevelSpan.textContent = currentFontSize + '%';
});

// Key listeners
document.addEventListener("keyup", function (e) {
    if ((e.keyCode || e.which) == 37) { // Left Arrow
        rendition.prev();
    }
    if ((e.keyCode || e.which) == 39) { // Right Arrow
        rendition.next();
    }
});

// Update "Page" info on relocation
rendition.on("relocated", function (location) {
    // Save progress
    if (location.start.cfi) {
        saveProgress(location.start.cfi);
    }
});

function saveProgress(cfi) {
    if (!BOOK_ID) return;
    fetch(`/api/book/${BOOK_ID}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: cfi })
    }).catch(err => console.error('Error saving progress:', err));
}

// Highlighting
rendition.on("selected", function (cfiRange, contents) {
    // When text is selected
    rendition.annotations.add("highlight", cfiRange, {}, (e) => {
        console.log("highlight clicked", e.target);
    });

    contents.window.getSelection().removeAllRanges();

    // Save to backend
    saveHighlight(cfiRange, 'yellow');
});

async function saveHighlight(cfiRange, color) {
    try {
        await fetch(`/api/book/${BOOK_ID}/highlight`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                highlight: {
                    cfiRange: cfiRange,
                    color: color,
                    type: 'highlight'
                }
            })
        });
    } catch (e) {
        console.error('Error saving highlight', e);
    }
}

// Load existing highlights (Mock - real app would fetch these on load)
// In a real implementation, we would inject these from the server-side 'book' object or a separate API call.
// For now, let's keep it clean.
