let allBooks = [];
let bookScores = {};

document.addEventListener('DOMContentLoaded', () => {
    const book1Element = document.getElementById('book-1');
    const book2Element = document.getElementById('book-2');
    const rankedBookList = document.getElementById('ranked-book-list');
    const loadingIndicator = document.getElementById('loading-indicator');

    // 1. Start the loading process
    loadBooks();

    async function loadBooks() {
        if (loadingIndicator) loadingIndicator.style.display = 'block';

        try {
            const response = await fetch('librarything_Orlando_Mas.json');
            if (!response.ok) throw new Error(`Could not find JSON file (Status: ${response.status})`);
            
            const rawData = await response.json();
            
            // FIX: Convert LibraryThing's dictionary structure into a flat array
            allBooks = Object.values(rawData).map(book => ({
                id: book.books_id || book.title,
                title: book.title || "Unknown Title",
                author: book.primaryauthor || "Unknown Author",
                // LibraryThing JSON often uses 'cover' or an empty string if none exists
                cover: book.cover || 'https://via.placeholder.com/150x200?text=No+Cover'
            }));

            // 2. Initialize Elo scores
            const savedScores = JSON.parse(localStorage.getItem('bookScores')) || {};
            
            allBooks.forEach(book => {
                if (!savedScores[book.id]) {
                    savedScores[book.id] = { ...book, elo: 1500 };
                }
            });

            bookScores = savedScores;
            localStorage.setItem('bookScores', JSON.stringify(bookScores));

            if (loadingIndicator) loadingIndicator.style.display = 'none';
            displayBooksForComparison();
            updateRankedList();

        } catch (err) {
            console.error("Initialization Error:", err);
            if (loadingIndicator) loadingIndicator.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
        }
    }

    function displayBooksForComparison() {
        if (allBooks.length < 2) return;

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
        element.querySelector('.book-cover').src = book.cover;
    }

    function updateRankedList() {
        const sorted = Object.values(bookScores).sort((a, b) => b.elo - a.elo);
        
        rankedBookList.innerHTML = sorted.map((book, index) => `
            <li class="ranked-book-item">
                <span>${index + 1}. <strong>${book.title}</strong> - ${book.author} (${Math.round(book.elo)})</span>
            </li>
        `).join('');
    }

    // Set up click handlers once
    document.querySelectorAll('.prefer-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const winnerId = e.target.closest('.book-panel').dataset.bookId;
            const loserId = (winnerId === book1Element.dataset.bookId)
                            ? book2Element.dataset.bookId
                            : book1Element.dataset.bookId;
            
            handlePreference(winnerId, loserId);
        });
    });

    function handlePreference(winnerId, loserId) {
        const K = 32;
        const ratingA = bookScores[winnerId].elo;
        const ratingB = bookScores[loserId].elo;

        const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
        const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

        bookScores[winnerId].elo += K * (1 - expectedA);
        bookScores[loserId].elo += K * (0 - expectedB);

        localStorage.setItem('bookScores', JSON.stringify(bookScores));
        displayBooksForComparison();
        updateRankedList();
    }
});