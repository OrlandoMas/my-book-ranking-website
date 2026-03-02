let allBooks = [];
let comparisonHistory = [];
let bookScores = {};
let currentBooksToCompare = [];

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const book1Element = document.getElementById('book-1');
    const book2Element = document.getElementById('book-2');
    const rankedBookList = document.getElementById('ranked-book-list');
    const filterInput = document.getElementById('filter-input');
    const sortSelect = document.getElementById('sort-select');

    // Load everything
    loadBooks();

    // Event Listeners for Preference
    book1Element.querySelector('.prefer-button').addEventListener('click', () => {
        handlePreference(book1Element.dataset.bookId, book2Element.dataset.bookId);
    });

    book2Element.querySelector('.prefer-button').addEventListener('click', () => {
        handlePreference(book2Element.dataset.bookId, book1Element.dataset.bookId);
    });

    // Reset Logic
    document.getElementById('reset-rankings-button').addEventListener('click', () => {
        if(confirm("Reset all rankings?")) {
            localStorage.clear();
            location.reload();
        }
    });

    // Filter/Sort Listeners
    filterInput.addEventListener('input', applyFiltersAndSorting);
    sortSelect.addEventListener('change', applyFiltersAndSorting);

    async function loadBooks() {
        try {
            const response = await fetch('librarything_Orlando_Mas.json');
            allBooks = await response.json();
            
            // Initialize scores for new books
            const savedScores = JSON.parse(localStorage.getItem('bookScores')) || {};
            allBooks.forEach(book => {
                if (!savedScores[book.id]) {
                    savedScores[book.id] = { ...book, elo: 1500 };
                }
            });
            bookScores = savedScores;
            
            displayBooksForComparison();
            applyFiltersAndSorting();
        } catch (err) {
            console.error("Failed to load JSON. Check if file exists.", err);
        }
    }

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
        applyFiltersAndSorting();
    }

    function displayBooksForComparison() {
        if (allBooks.length < 2) return;
        const b1 = allBooks[Math.floor(Math.random() * allBooks.length)];
        let b2;
        do { b2 = allBooks[Math.floor(Math.random() * allBooks.length)]; } while (b1.id === b2.id);

        book1Element.dataset.bookId = b1.id;
        book1Element.querySelector('.book-title').textContent = b1.title;
        book1Element.querySelector('.book-cover').src = b1.cover || '';

        book2Element.dataset.bookId = b2.id;
        book2Element.querySelector('.book-title').textContent = b2.title;
        book2Element.querySelector('.book-cover').src = b2.cover || '';
    }

    function applyFiltersAndSorting() {
        const text = filterInput.value.toLowerCase();
        let list = Object.values(bookScores).filter(b =>
            b.title.toLowerCase().includes(text) || b.author.toLowerCase().includes(text)
        );

        list.sort((a, b) => b.elo - a.elo); // Simplified sort for now
        
        rankedBookList.innerHTML = list.map((b, i) => `
            <li>${i+1}. <strong>${b.title}</strong> - Elo: ${Math.round(b.elo)}</li>
        `).join('');
    }
});