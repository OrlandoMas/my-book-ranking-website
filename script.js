let allBooks = [];
let bookScores = {};

document.addEventListener('DOMContentLoaded', () => {
    const book1Element = document.getElementById('book-1');
    const book2Element = document.getElementById('book-2');
    const rankedList = document.getElementById('ranked-book-list');
    const loadingIndicator = document.getElementById('loading-indicator');

    // 1. Load Data
    async function loadData() {
        try {
            const response = await fetch('librarything_Orlando_Mas.json');
            const data = await response.json();
            
            // Map LibraryThing dictionary structure to Array
            allBooks = Object.values(data).map(b => {
                let isbn = "";
                if (b.isbn && typeof b.isbn === 'object') {
                    // Grab the longest ISBN available
                    isbn = Object.values(b.isbn).reduce((a, b) => a.length > b.length ? a : b, "");
                }
                return {
                    id: b.books_id || b.title,
                    title: b.title || "Unknown Title",
                    author: b.primaryauthor || "Unknown Author",
                    isbn: isbn
                };
            });

            // Load scores from LocalStorage
            const saved = JSON.parse(localStorage.getItem('bookScores')) || {};
            allBooks.forEach(b => {
                if (!saved[b.id]) {
                    saved[b.id] = { ...b, elo: 1500 };
                }
            });
            bookScores = saved;

            if (loadingIndicator) loadingIndicator.style.display = 'none';
            refreshPair();
            renderList();
        } catch (e) {
            console.error("Failed to load JSON library:", e);
        }
    }

    // 2. Pair Logic
    function refreshPair() {
        if (allBooks.length < 2) return;

        const i1 = Math.floor(Math.random() * allBooks.length);
        let i2;
        do {
            i2 = Math.floor(Math.random() * allBooks.length);
        } while (i1 === i2);

        updateCard(book1Element, allBooks[i1]);
        updateCard(book2Element, allBooks[i2]);
    }

    // 3. UI Update (Scoped to each container)
    function updateCard(container, book) {
        container.dataset.bookId = book.id;
        
        const titleEl = container.querySelector('.book-title');
        const authorEl = container.querySelector('.book-author');
        const imgEl = container.querySelector('.book-cover');

        titleEl.textContent = book.title;
        authorEl.textContent = book.author;

        // Cover logic via Open Library API
        if (book.isbn && book.isbn.length > 5) {
            imgEl.src = `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`;
        } else {
            imgEl.src = `https://dummyimage.com/150x225/cccccc/000000&text=${encodeURIComponent(book.title)}`;
        }

        // Fallback for missing covers
        imgEl.onerror = function() {
            this.src = `https://dummyimage.com/150x225/cccccc/000000&text=${encodeURIComponent(book.title)}`;
            this.onerror = null;
        };
    }

    // 4. Ranking Logic
    document.querySelectorAll('.prefer-button').forEach(btn => {
        btn.onclick = (e) => {
            const winId = e.target.closest('.book-card').dataset.bookId;
            const b1Id = book1Element.dataset.bookId;
            const b2Id = book2Element.dataset.bookId;
            const loseId = (winId === b1Id) ? b2Id : b1Id;

            const K = 32;
            const ratingW = bookScores[winId].elo;
            const ratingL = bookScores[loseId].elo;
            const expectedW = 1 / (1 + Math.pow(10, (ratingL - ratingW) / 400));

            bookScores[winId].elo += K * (1 - expectedW);
            bookScores[loseId].elo -= K * (1 - expectedW);

            localStorage.setItem('bookScores', JSON.stringify(bookScores));
            refreshPair();
            renderList();
        };
    });

    // 5. Update List
    function renderList() {
        const sorted = Object.values(bookScores)
            .filter(b => b.elo !== 1500) // Optional: only show books with rankings
            .sort((a, b) => b.elo - a.elo);

        if (sorted.length === 0) {
            rankedList.innerHTML = "<li>No books ranked yet. Select your favorites above!</li>";
            return;
        }

        rankedList.innerHTML = sorted.slice(0, 10).map((b, i) =>
            `<li><strong>#${i+1}</strong> ${b.title} <span style="float:right; color:#888;">${Math.round(b.elo)} pts</span></li>`
        ).join('');
    }

    // 6. Reset
    document.getElementById('reset-rankings-button').onclick = () => {
        if (confirm("This will delete all your ranking history. Are you sure?")) {
            localStorage.removeItem('bookScores');
            location.reload();
        }
    };

    loadData();
});