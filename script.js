// Variable declarations - Ensure these are at the very top of your script.js
let allBooks = []; // Stores all books from JSON
let comparisonHistory = []; // To store pairs of books compared and the winner
let bookScores = {}; // To store the ranking score for each book
let bookApiDetailsCache = {}; // Cache for storing fetched Google Books API details
let currentBooksToCompare = []; // Stores the two books currently being displayed

document.addEventListener('DOMContentLoaded', () => {

// DOM Element References
const rankingInterface = document.getElementById('ranking-interface');
const book1Element = document.getElementById('book-1');
const book2Element = document.getElementById('book-2');
const book1Title = book1Element.querySelector('.book-title');
const book1Author = book1Element.querySelector('.book-author');
const book2Title = book2Element.querySelector('.book-title');
const book2Author = book2Element.querySelector('.book-author');
const book1Button = book1Element.querySelector('.prefer-button');
const book2Button = book2Element.querySelector('.prefer-button');
const rankedBookList = document.getElementById('ranked-book-list');
const noMoreBooksMessage = document.getElementById('no-more-books');
const messageArea = document.getElementById('message-area');
const resetRankingsButton = document.getElementById('reset-rankings-button');
const exportRankingsButton = document.getElementById('export-rankings-button');
const importFileInput = document.getElementById('import-file-input');
const importRankingsButton = document.getElementById('import-rankings-button');
const cacheReminderMessage = document.getElementById('cache-reminder-message');
const dismissCacheReminderButton = document.getElementById('dismiss-cache-reminder');

// Modal Elements - Ensure these are correctly referenced if they exist in HTML
const bookDetailModal = document.getElementById('book-detail-modal');
const closeModalButton = bookDetailModal ? bookDetailModal.querySelector('.close-button') : null;
const modalBookTitle = document.getElementById('modal-book-title');
const modalBookAuthor = document.getElementById('modal-book-author');
const modalBookScore = document.getElementById('modal-book-score');
const modalBookDescription = document.getElementById('modal-book-description');
const modalBookCover = document.getElementById('modal-book-cover');
const modalBookLink = document.getElementById('modal-book-link');

// Filter and Sort Elements - **THESE ARE CRUCIAL FOR YOUR ERROR**
const filterInput = document.getElementById('filter-input');
const sortSelect = document.getElementById('sort-select');

// Only add the event listener if closeModalButton is not null
    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
            if (bookDetailModal) {
                bookDetailModal.style.display = 'none';
            }
        });
    }


// --- Utility Functions (assuming these are already defined in your script.js) ---
function displayMessage(message, type = 'info', duration = 3000) {
    const msgElement = document.createElement('div');
    msgElement.className = `message ${type}`;
    msgElement.textContent = message;
    messageArea.appendChild(msgElement);

    setTimeout(() => {
        msgElement.remove();
    }, duration);
}

function calculateElo(ratingA, ratingB, winner) {
    const K = 32;
    const expectedScoreA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const expectedScoreB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

    let newRatingA, newRatingB;

    if (winner === 'A') {
        newRatingA = ratingA + K * (1 - expectedScoreA);
        newRatingB = ratingB + K * (0 - expectedScoreB);
    } else {
        newRatingA = ratingA + K * (0 - expectedScoreA);
        newRatingB = ratingB + K * (1 - expectedScoreB);
    }
    return { newRatingA, newRatingB };
}

function saveRankings() {
    localStorage.setItem('bookScores', JSON.stringify(bookScores));
    localStorage.setItem('comparisonHistory', JSON.stringify(comparisonHistory));
    displayMessage('Rankings saved automatically!', 'success');
}

function loadRankings() {
    const savedScores = localStorage.getItem('bookScores');
    const savedHistory = localStorage.getItem('comparisonHistory');
    if (savedScores) {
        bookScores = JSON.parse(savedScores);
    }
    if (savedHistory) {
        comparisonHistory = JSON.parse(savedHistory);
    }
    displayMessage('Rankings loaded!', 'info');
}

async function fetchBooks() {
    try {
        // Ensure this path is correct!
        const response = await fetch('librarything_Orlando_Mas.json');
        console.log('Raw fetch response:', response); // Check response status, etc.

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Parsed JSON data:', data); // Check the structure of 'data'

        if (!Array.isArray(data)) {
            console.error("Fetched data is not an array:", data);
            // Handle this case, perhaps by setting allBooks to an empty array
            // and displaying a message to the user.
            allBooks = [];
            return;
        }
        allBooks = data;
        // ... rest of your fetchBooks function
    } catch (error) {
        console.error("Error loading books:", error);
        messageArea.textContent = `Failed to load books: ${error.message}. Please check your JSON file.`;
        loadingIndicator.style.display = 'none';
    }
}

async function loadBooks() {
    document.getElementById('loading-indicator').style.display = 'block'; // Show loading
    await fetchBooks();
    loadRankings(); // Load saved scores after fetching fresh book list
    displayBooksForComparison();
    // updateRankedListDisplay(); // This call is now handled by applyFiltersAndSorting within DOMContentLoaded
    document.getElementById('loading-indicator').style.display = 'none'; // Hide loading
}

function getNextComparison() {
    const unrankedBooks = allBooks.filter(book => !bookScores[book.id] || bookScores[book.id].elo === 1500);

    if (unrankedBooks.length >= 2) {
        // Prioritize unranked books for initial comparisons
        const bookA = unrankedBooks[Math.floor(Math.random() * unrankedBooks.length)];
        let bookB;
        do {
            bookB = unrankedBooks[Math.floor(Math.random() * unrankedBooks.length)];
        } while (bookA.id === bookB.id);
        return [bookA, bookB];
    } else if (allBooks.length >= 2) {
        // If few unranked books left, pick two random books ensuring they are different
        let bookA, bookB;
        do {
            bookA = allBooks[Math.floor(Math.random() * allBooks.length)];
            bookB = allBooks[Math.floor(Math.random() * allBooks.length)];
        } while (bookA.id === bookB.id);
        return [bookA, bookB];
    } else {
        return null; // Not enough books to compare
    }
}


function displayBooksForComparison() {
    currentBooksToCompare = getNextComparison();

    if (currentBooksToCompare) {
        rankingInterface.style.display = 'block';
        noMoreBooksMessage.style.display = 'none';

        const [bookA, bookB] = currentBooksToCompare;

        book1Element.dataset.bookId = bookA.id;
        book1Title.textContent = bookA.title;
        book1Author.textContent = bookA.author;
        book1Element.querySelector('.book-cover').src = bookA.cover || 'images/default-cover.png'; // Use default if no cover

        book2Element.dataset.bookId = bookB.id;
        book2Title.textContent = bookB.title;
        book2Author.textContent = bookB.author;
        book2Element.querySelector('.book-cover').src = bookB.cover || 'images/default-cover.png'; // Use default if no cover
    } else {
        rankingInterface.style.display = 'none';
        noMoreBooksMessage.style.display = 'block';
        displayMessage('All books have been compared, or there are not enough books to compare.', 'info');
    }
}


function handlePreference(winnerId, loserId) {
    const winnerBook = bookScores[winnerId];
    const loserBook = bookScores[loserId];

    if (!winnerBook || !loserBook) {
        displayMessage('Error: Selected book not found in scores.', 'error');
        return;
    }

    const { newRatingA, newRatingB } = calculateElo(winnerBook.elo, loserBook.elo, 'A'); // 'A' is the winner

    winnerBook.elo = newRatingA;
    loserBook.elo = newRatingB;

    comparisonHistory.push({ winner: winnerId, loser: loserId, timestamp: new Date().toISOString() });
    saveRankings();
    updateRankedListDisplay();
    displayBooksForComparison();
}

function updateRankedListDisplay(filteredAndSortedBooks = null) {
    if (!rankedBookList) {
        console.error("Error: rankedBookList element not found.");
        return;
    }
    rankedBookList.innerHTML = ''; // Clear existing list

    const booksToDisplay = filteredAndSortedBooks || Object.values(bookScores);

    if (booksToDisplay.length === 0) {
        rankedBookList.innerHTML = '<li>No books ranked yet or no books match your filter.</li>';
        return;
    }

    booksToDisplay.forEach((book, index) => {
        const listItem = document.createElement('li');
        listItem.classList.add('ranked-book-item');
        listItem.dataset.bookId = book.id; // Store book ID for modal

        // Ensure book.description exists before truncating or creating elements
        const summaryText = book.description ? truncateSummary(book.description, 150) : 'No summary available.';
        const fullSummaryText = book.description || 'No summary available.';

        listItem.innerHTML = `
            <span class="rank-number">${index + 1}.</span>
            <span class="ranked-title">${book.title}</span> by <span class="ranked-author">${book.author}</span>
            <span class="elo-score">Elo: ${Math.round(book.elo)}</span>
            <div class="ranked-summary" style="display: none;">
                <p class="truncated-text">${summaryText}</p>
                <p class="full-text" style="display: none;">${fullSummaryText}</p>
                ${book.description && book.description.length > 150 ? `<a href="#" class="read-more-link" data-action="expand">Read more</a>` : ''}
            </div>
            <button class="toggle-summary-button">Show Summary</button>
        `;
        rankedBookList.appendChild(listItem);
    });
}


function truncateSummary(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    // Find the last space within the maxLength
    const truncated = text.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
}

async function showBookDetailModal(bookId) {
    if (!bookDetailModal || !modalBookTitle || !modalBookAuthor || !modalBookScore || !modalBookDescription || !modalBookCover || !modalBookLink) {
        console.error("One or more modal elements not found.");
        return;
    }

    const book = bookScores[bookId];
    if (!book) {
        console.error("Book not found for modal:", bookId);
        displayMessage('Book details not found.', 'error');
        return;
    }

    modalBookTitle.textContent = book.title;
    modalBookAuthor.textContent = book.author;
    modalBookScore.textContent = `Elo Score: ${Math.round(book.elo)}`;
    modalBookCover.src = book.cover || 'images/default-cover.png';
    modalBookLink.href = book.googleBooksLink || '#';
    modalBookLink.style.display = book.googleBooksLink ? 'inline-block' : 'none'; // Hide if no link

    // Display summary or fetch if not available
    if (book.description) {
        modalBookDescription.textContent = book.description;
    } else {
        modalBookDescription.textContent = 'Loading description...';
        try {
            if (!bookApiDetailsCache[book.id]) {
                const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${book.isbn || book.id}`); // Try ISBN first, then ID
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    const volumeInfo = data.items[0].volumeInfo;
                    bookApiDetailsCache[book.id] = volumeInfo.description || 'No detailed description available.';
                } else {
                    bookApiDetailsCache[book.id] = 'No detailed description available.';
                }
            }
            modalBookDescription.textContent = bookApiDetailsCache[book.id];
        } catch (error) {
            console.error('Error fetching book details from Google Books API:', error);
            modalBookDescription.textContent = 'Failed to load description.';
        }
    }

    bookDetailModal.classList.add('show'); // Use class for showing/hiding
}

function resetAllRankings() {
    if (confirm('Are you sure you want to reset all rankings? This cannot be undone!')) {
        bookScores = {};
        comparisonHistory = [];
        saveRankings();
        displayMessage('All rankings have been reset!', 'success');
        loadBooks(); // Reload books and start fresh comparison
    }
}

function exportRankingsToFile() {
    const data = {
        bookScores: bookScores,
        comparisonHistory: comparisonHistory,
        // You might want to include allBooks if it contains additional necessary data
        allBooks: allBooks // Including allBooks to ensure book details are preserved
    };
    const filename = `book_rankings_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    displayMessage('Rankings exported successfully!', 'success');
}

function importRankingsFromFile(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData.bookScores && importedData.comparisonHistory && importedData.allBooks) {
                    bookScores = importedData.bookScores;
                    comparisonHistory = importedData.comparisonHistory;
                    allBooks = importedData.allBooks; // Important to restore allBooks for consistency
                    saveRankings(); // Save imported data to local storage
                    displayMessage('Rankings imported successfully!', 'success');
                    loadBooks(); // Reload the display based on imported data
                } else {
                    displayMessage('Invalid backup file format.', 'error');
                }
            } catch (error) {
                console.error('Error importing file:', error);
                displayMessage('Error reading backup file. Make sure it is a valid JSON.', 'error');
            }
        };
        reader.readAsText(file);
    }
}

// --- NEW: Function to apply filters and sorting ---
function applyFiltersAndSorting() {
    // Ensure filterInput and sortSelect are not null before accessing their values
    if (!filterInput || !sortSelect) {
        console.error("Filter or sort elements not found during applyFiltersAndSorting. This might happen if script runs before DOM is fully loaded for these elements, or IDs are mismatched.");
        return;
    }

    const filterText = filterInput.value.toLowerCase();
    const sortBy = sortSelect.value;

    let filteredBooks = Object.values(bookScores).filter(book => {
        const titleMatch = book.title && book.title.toLowerCase().includes(filterText);
        const authorMatch = book.author && book.author.toLowerCase().includes(filterText);
        return titleMatch || authorMatch;
    });

    switch (sortBy) {
        case 'elo-desc':
            filteredBooks.sort((a, b) => b.elo - a.elo);
            break;
        case 'elo-asc':
            filteredBooks.sort((a, b) => a.elo - b.elo);
            break;
        case 'title-asc':
            filteredBooks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            break;
        case 'title-desc':
            filteredBooks.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
            break;
        case 'author-asc':
            filteredBooks.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
            break;
        case 'author-desc':
            filteredBooks.sort((a, b) => (b.author || '').localeCompare(a.author || ''));
            break;
        default:
            filteredBooks.sort((a, b) => b.elo - a.elo); // Default sort
            break;
    }

    updateRankedListDisplay(filteredBooks);
}

// --- Event Listeners (updated to include filter and sort) ---
document.addEventListener('DOMContentLoaded', () => {
    loadBooks();
    if (localStorage.getItem('cacheReminderDismissed') === 'true') {
        cacheReminderMessage.style.display = 'none';
    } else {
        cacheReminderMessage.style.display = 'block';
    }
    // Initial display of ranked list, will now correctly apply filters and sorts
    applyFiltersAndSorting(); // Call this initially to populate the list and apply default sort
});

// Added to Improve Step 8
resetRankingsButton.addEventListener('click', resetAllRankings);
exportRankingsButton.addEventListener('click', exportRankingsToFile);

// When the import button is clicked, trigger the hidden file input
importRankingsButton.addEventListener('click', () => {
    importFileInput.click();
});

// When a file is selected in the hidden input, process it
importFileInput.addEventListener('change', importRankingsFromFile);

dismissCacheReminderButton.addEventListener('click', () => {
    localStorage.setItem('cacheReminderDismissed', 'true');
    cacheReminderMessage.style.display = 'none';
    displayMessage('Reminder dismissed. You can clear your browser\'s local storage to show it again.', 'info', 5000);
});

// Event listener for toggling summary visibility AND "Read more/Show less" within summary
rankedBookList.addEventListener('click', (event) => {
    // Handle Show/Hide Summary button click
    if (event.target.classList.contains('toggle-summary-button')) {
        const rankedSummaryDiv = event.target.closest('.ranked-summary');
        if (rankedSummaryDiv) {
            const truncatedTextSpan = rankedSummaryDiv.querySelector('.truncated-text');
            const fullTextSpan = rankedSummaryDiv.querySelector('.full-text');
            const readMoreLink = rankedSummaryDiv.querySelector('.read-more-link');

            if (fullTextSpan.style.display === 'none') {
                // Currently showing truncated, switch to full
                truncatedTextSpan.style.display = 'none';
                fullTextSpan.style.display = 'inline';
                if (readMoreLink) readMoreLink.style.display = 'none';
                event.target.textContent = 'Hide Summary';
            } else {
                // Currently showing full, switch to truncated
                truncatedTextSpan.style.display = 'inline';
                fullTextSpan.style.display = 'none';
                if (readMoreLink) readMoreLink.style.display = 'inline';
                event.target.textContent = 'Show Summary';
            }
        }
    }

    // Handle "Read more" / "Show less" links within the summary itself
    if (event.target.classList.contains('read-more-link')) {
        event.preventDefault();
        const rankedSummaryDiv = event.target.closest('.ranked-summary');
        if (rankedSummaryDiv) { // Ensure the parent summary div exists
            const truncatedTextSpan = rankedSummaryDiv.querySelector('.truncated-text');
            const fullTextSpan = rankedSummaryDiv.querySelector('.full-text');

            if (event.target.dataset.action === 'expand') {
                truncatedTextSpan.style.display = 'none';
                fullTextSpan.style.display = 'inline';
                event.target.textContent = 'Show less';
                event.target.dataset.action = 'collapse';
            } else { // action === 'collapse'
                truncatedTextSpan.style.display = 'inline';
                fullTextSpan.style.display = 'none';
                event.target.textContent = 'Read more';
                event.target.dataset.action = 'expand';
            }
        }
    }
});

// NEW: Event listener to open book detail modal when a ranked book is clicked
rankedBookList.addEventListener('click', (event) => {
    // Ensure the click was on a ranked book item or an element within it that has a book-id
    const rankedBookItem = event.target.closest('.ranked-book-item');
    if (rankedBookItem) {
        // Prevent default behavior if clicking a link or button inside the item that shouldn't open modal
        if (event.target.classList.contains('toggle-summary-button') || event.target.classList.contains('read-more-link')) {
            return; // Already handled by existing listeners
        }

        const bookId = rankedBookItem.dataset.bookId;
        if (bookId) {
            showBookDetailModal(bookId);
        }
    }
});

// Using conditional checks for modal buttons since `closeModalButton` and `bookDetailModal` might be null if HTML is malformed
if (closeModalButton) {
    closeModalButton.addEventListener('click', () => {
        if (bookDetailModal) {
            bookDetailModal.classList.remove('show');
        }
    });
}

if (bookDetailModal) {
    bookDetailModal.addEventListener('click', (event) => {
        if (event.target === bookDetailModal) { // Only close if clicking the background, not content
            bookDetailModal.classList.remove('show');
        }
    });
}

document.addEventListener('keydown', (event) => {
    // Check if the modal is currently open by checking for the 'show' class
    if (event.key === 'Escape' && bookDetailModal && bookDetailModal.classList.contains('show')) {
        bookDetailModal.classList.remove('show');
    }
});

// NEW: Event listener to open book detail modal when Book 1 card is clicked
book1Element.addEventListener('click', (event) => {
    // If the click target is the 'prefer-button', let its own listener handle the click
    if (event.target.classList.contains('prefer-button')) {
        return;
    }
    // Otherwise, open the modal for the book associated with this card
    const bookId = book1Element.dataset.bookId;
    if (bookId) {
        showBookDetailModal(bookId);
    }
});

// NEW: Event listener to open book detail modal when Book 2 card is clicked
book2Element.addEventListener('click', (event) => {
    // If the click target is the 'prefer-button', let its own listener handle the click
    if (event.target.classList.contains('prefer-button')) {
        return;
    }
    // Otherwise, open the modal for the book associated with this card
    const bookId = book2Element.dataset.bookId;
    if (bookId) {
        showBookDetailModal(bookId);
    }
});

// **Crucial addition for your TypeError:**
// Event listeners for filter and sort functionality
if (filterInput) { // Good practice to check if element exists before adding listener
    filterInput.addEventListener('input', applyFiltersAndSorting);
} else {
    console.error("Error: Element with ID 'filter-input' not found. Please ensure it exists in index.html.");
}

if (sortSelect) { // Good practice to check if element exists before adding listener
    sortSelect.addEventListener('change', applyFiltersAndSorting);
} else {
    console.error("Error: Element with ID 'sort-select' not found. Please ensure it exists in index.html.");
}