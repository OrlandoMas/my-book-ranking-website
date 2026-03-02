/**
 * MY BOOK RANKING WEBSITE - CORE LOGIC
 * Features: Elo Ranking, LibraryThing JSON Integration, Open Library Cover Fetching
 */

let allBooks = [];
let bookScores = {};

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const book1Element = document.getElementById('book-1');
    const book2Element = document.getElementById('book-2');
    const rankedBookList = document.getElementById('ranked-book-list');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resetBtn = document.getElementById('reset-rankings-button');
    const filterInput = document.getElementById('filter-input');
    const sortSelect = document.getElementById('sort-select');

    // --- 1. Load Data ---
    loadBooks();

    async function loadBooks() {
        if (loadingIndicator) loadingIndicator.style.display = 'block';

        try {
            const response = await fetch('librarything_Orlando_Mas.json');
            if (!response.ok) throw new Error(`Could not load JSON. Status: ${response.status}`);
            
            const rawData = await response.json();
            
            // LibraryThing JSON is an object/dictionary. We convert it to an array.
            allBooks = Object.values(rawData).map(book => {
                // Extract the first ISBN available in the isbn object
                let firstIsbn = "";
                if (book.isbn && typeof book.isbn === 'object') {
                    const isbnValues = Object.values(book.isbn);
                    if (isbnValues.length > 0) firstIsbn = isbnValues[0];
                }

                return {
                    id: book.books_id || book.title,
                    title: book.title || "Unknown Title",
                    author: book.primaryauthor || "Unknown Author",
                    isbn: firstIsbn
                };
            });

            console.log(`Successfully loaded ${allBooks.length} books.`);

            // --- 2. Initialize or Load Elo Scores ---
            const savedScores = JSON.parse(localStorage.getItem('bookScores')) || {};
            
            allBooks.forEach(book => {
                if (!savedScores[book.id]) {
                    // New book found: set starting Elo to 1500
                    savedScores[book.id] = { ...book, elo: 1500 };
                } else {
                    // Update existing book info (title/author) while keeping the score
                    savedScores[book.id] = { ...savedScores[book.id], ...book };
                }
            });

            bookScores = savedScores;
            saveToLocalStorage();

            if (loadingIndicator) loadingIndicator.style.display = 'none';
            
            // --- 3. Kick off the UI ---
            displayBooksForComparison();
            updateRankedList();

        } catch (err) {
            console.error("Initialization Error:", err);
            if (loadingIndicator) {
                loadingIndicator.innerHTML = `<p style="color:red">Error: ${err.message}. Make sure your JSON file is in the same folder.</p>`;
            }
        }
    }

    // --- 4. Comparison Logic ---
    function displayBooksForComparison() {
        if (allBooks.length < 2) return;

        // Pick two unique random books
        const b1 = allBooks[Math.floor(Math.random() * allBooks.length)];
        let b2;
        do {
            b2 = allBooks[Math.floor(Math.random() * allBooks.length)];
        } while (b1.id === b2.id);

        updatePanel(book1Element, b1);
        updatePanel(book2Element, b2);
    }

    function updatePanel(element, book) {
        element.dataset.bookId = book.id;
        element.querySelector('.book-title').textContent = book.title;
        element.querySelector('.book-author').textContent = book.author;
        
        const coverImg = element.querySelector('.book-cover');
        
        // Use Open Library API for covers using ISBN
        if (book.isbn) {
            coverImg.src = `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`;
        } else {
            coverImg.src = 'https://via.placeholder.com/150x225?text=No+ISBN';
        }

        // Fallback if the specific ISBN doesn't have an image on Open Library
        coverImg.onerror = function() {
            this.src = 'https://via.placeholder.com/150x225?text=No+Cover+Found';
        };
    }

    // --- 5. Ranking Logic (Elo) ---
    function handlePreference(winnerId, loserId) {
        const K = 32;
        const ratingA = bookScores[winnerId].elo;
        const ratingB = bookScores[loserId].elo;

        // Calculate expected win probability
        const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
        const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

        // Update scores
        bookScores[winnerId].elo += K * (1 - expectedA);
        bookScores[loserId].elo += K * (0 - expectedB);

        saveToLocalStorage();
        displayBooksForComparison();
        updateRankedList();
    }

    //