let allBooks = [];
let bookScores = {};

document.addEventListener('DOMContentLoaded', () => {
    const book1Element = document.getElementById('book-1');
    const book2Element = document.getElementById('book-2');
    const rankedBookList = document.getElementById('ranked-book-list');
    const loadingIndicator = document.getElementById('loading-indicator');

    loadBooks();

    async function loadBooks() {
        try {
            const response = await fetch('librarything_Orlando_Mas.json');
            const rawData = await response.json();
            
            allBooks = Object.values(rawData).map(book => {
                // IMPROVED ISBN SEARCH:
                // Loops through the 'isbn' object and finds the longest string (usually the 13-digit ISBN)
                let bestIsbn = "";
                if (book.isbn && typeof book.isbn === 'object') {
                    const vals = Object.values(book.isbn);
                    bestIsbn = vals.reduce((a, b) => a.length > b.length ? a : b, "");
                }

                return {
                    id: book.books_id || book.title,
                    title: book.title || "Unknown Title",
                    author: book.primaryauthor || "Unknown Author",
                    isbn: bestIsbn
                };
            });

            const savedScores = JSON.parse(localStorage.getItem('bookScores')) || {};
            allBooks.forEach(book => {
                if (!savedScores[book.id]) {
                    savedScores[book.id] = { ...book, elo: 1500 };
                }
            });

            bookScores = savedScores;
            displayBooksForComparison();
            updateRankedList();
        } catch (err) {
            console.error("Error loading JSON:", err);
        }
    }

    function updatePanel(element, book) {
        element.dataset.bookId = book.id;
        element.querySelector('.book-title').textContent = book.title;
        element.querySelector('.book-author').textContent = book.author;
        
        const img = element.querySelector('.book-cover');
        
        // Show a loading placeholder first
        img.src = "https://via.placeholder.com/150x225?text=Loading...";

        if (book.isbn && book.isbn.length > 5) {
            // Open Library API
            img.src = `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg?default=false`;
        } else {
            img.src = `https://via.placeholder.com/150x225?text=No+ISBN+Data`;
        }

        // If the API returns a 404 or empty image, show a "Cover Not Found" image
        img.onerror = function() {
            this.src = `https://via.placeholder.com/150x225?text=${encodeURIComponent(book.title)}`;
            this.onerror = null;
        };
    }

    function displayBooksForComparison() {
        if (allBooks.length < 2) return;
        const b1 = allBooks[Math.floor(Math.random() * allBooks.length)];
        let b2;
        do { b2 = allBooks[Math.floor(Math.random() * allBooks.length)]; } while (b1.id === b2.id);

        updatePanel(book1Element, b1);
        updatePanel(book2Element, b2);
    }

    // --- Ranking & UI Helpers ---
    function updateRankedList() {
        const sorted = Object.values(bookScores).sort((a, b) => b.elo - a.elo);
        rankedBookList.innerHTML = sorted.slice(0, 10).map((b, i) =>
            `<li>${i+1}. <strong>${b.title}</strong> (${Math.round(b.elo)})</li>`
        ).join('');
    }

    document.querySelectorAll('.prefer-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const winId = e.target.closest('.book-panel').dataset.bookId;
            const loseId = (winId === book1Element.dataset.bookId) ? book2Element.dataset.bookId : book1Element.dataset.bookId;
            
            const K = 32;
            const ea = 1 / (1 + Math.pow(10, (bookScores[loseId].elo - bookScores[winId].elo) / 400));
            const eb = 1 / (1 + Math.pow(10, (bookScores[winId].elo - bookScores[loseId].elo) / 400));
            bookScores[winId].elo += K * (1 - ea);
            bookScores[loseId].elo += K * (0 - eb);

            localStorage.setItem('bookScores', JSON.stringify(bookScores));
            displayBooksForComparison();
            updateRankedList();
        });
    });
});