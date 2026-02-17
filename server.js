const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Data Storage
const DATA_FILE = path.join(__dirname, 'data', 'library.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure upload and data directories exist
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const DATA_DIR = path.dirname(DATA_FILE);
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /pdf|epub/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype) || file.mimetype === 'application/epub+zip';

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF and EPUB files are allowed!'));
        }
    }
});

// Helper Functions
const getLibrary = () => {
    if (!fs.existsSync(DATA_FILE)) return [];
    const data = fs.readFileSync(DATA_FILE);
    return JSON.parse(data);
};

const saveLibrary = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// Routes

// Dashboard - List all books
app.get('/', (req, res) => {
    const books = getLibrary();
    res.render('index', { books });
});

// Upload Book
app.post('/upload', upload.single('bookFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const { title } = req.body;
    const books = getLibrary();

    const ext = path.extname(req.file.originalname).toLowerCase();
    const format = ext === '.pdf' ? 'pdf' : 'epub';

    const newBook = {
        id: uuidv4(),
        title: title || req.file.originalname,
        filename: req.file.filename,
        originalName: req.file.originalname,
        format: format,
        uploadedAt: new Date().toISOString(),
        highlights: []
    };

    books.push(newBook);
    saveLibrary(books);

    res.redirect('/');
});

// Reader View
app.get('/book/:id', (req, res) => {
    const books = getLibrary();
    const book = books.find(b => b.id === req.params.id);

    if (!book) {
        return res.status(404).send('Book not found');
    }

    res.render('reader', { book });
});

// API: Delete Book
app.delete('/api/book/:id', (req, res) => {
    let books = getLibrary();
    const book = books.find(b => b.id === req.params.id);

    if (!book) {
        return res.status(404).json({ error: 'Book not found' });
    }

    // Remove file
    const filePath = path.join(UPLOAD_DIR, book.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    books = books.filter(b => b.id !== req.params.id);
    saveLibrary(books);

    res.json({ success: true });
});

// API: Save Highlight/Progress
app.post('/api/book/:id/highlight', (req, res) => {
    const books = getLibrary();
    const bookIndex = books.findIndex(b => b.id === req.params.id);

    if (bookIndex === -1) {
        return res.status(404).json({ error: 'Book not found' });
    }

    const { highlight } = req.body; // Expecting { page/cfi, color, text? }

    // Simple implementation: Append to highlights. 
    // In a real app, you might want to update or remove existing ones.
    if (highlight) {
        books[bookIndex].highlights.push({
            ...highlight,
            createdAt: new Date().toISOString()
        });
        saveLibrary(books);
    }

    res.json({ success: true, highlights: books[bookIndex].highlights });
});

// API: Save Reading Progress
app.post('/api/book/:id/progress', (req, res) => {
    const books = getLibrary();
    const bookIndex = books.findIndex(b => b.id === req.params.id);

    if (bookIndex === -1) {
        return res.status(404).json({ error: 'Book not found' });
    }

    const { position } = req.body; // Can be page number (PDF) or CFI (EPUB)

    if (position) {
        books[bookIndex].lastRead = {
            position: position,
            timestamp: new Date().toISOString()
        };
        saveLibrary(books);
    }

    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
