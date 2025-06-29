let allBooks = []; // Stores all books from JSON
let comparisonHistory = []; // To store pairs of books compared and the winner
let bookScores = {}; // To store the ranking score for each book

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

let currentBooksToCompare = []; // Stores the two books currently being displayed

// --- Step 4: Load and display your book list ---
async function loadBooks() {
    try {
        const response = await fetch('librarything_Orlando_Mas.json');
        const data = await response.json();

        // Convert the object of books into an array for easier processing
        allBooks = Object.values(data);

        // Initialize scores for all books if not already loaded from local storage
        allBooks.forEach(book => {
            if (bookScores[book.books_id] === undefined) {
                bookScores[book.books_id] = 0; // Initialize with 0 points
            }
        });

        // Load existing scores from local storage
        loadRankingFromLocalStorage();

        displayNextComparison();
        displayRankedList();

    } catch (error) {
        console.error('Error loading book data:', error);
        book1Title.textContent = 'Error loading books.';
        book2Title.textContent = 'Error loading books.';
    }
}

// --- Step 5: Ranking interface ---
function getRandomUniqueBooks() {
    if (allBooks.length < 2) {
        return null; // Not enough books to compare
    }

    // Filter out books that have already been compared against all others,
    // or simply if we've exhausted most comparison opportunities.
    // For simplicity, let's just ensure we haven't compared THIS specific pair recently.
    // A more robust system would track all pairwise comparisons.
    
    // Simple approach: pick two random books and ensure they are different
    let book1, book2;
    do {
        book1 = allBooks[Math.floor(Math.random() * allBooks.length)];
        book2 = allBooks[Math.floor(Math.random() * allBooks.length)];
    } while (book1.books_id === book2.books_id); // Ensure they are different books

    return [book1, book2];
}

function displayNextComparison() {
    currentBooksToCompare = getRandomUniqueBooks();

    if (!currentBooksToCompare) {
        rankingInterface.style.display = 'none';
        noMoreBooksMessage.style.display = 'block';
        return;
    }

    const [bookA, bookB] = currentBooksToCompare;

    book1Title.textContent = bookA.title || 'Unknown Title';
    book1Author.textContent = bookA.primaryauthor || 'Unknown Author';
    book1Button.dataset.bookId = bookA.books_id;

    book2Title.textContent = bookB.title || 'Unknown Title';
    book2Author.textContent = bookB.primaryauthor || 'Unknown Author';
    book2Button.dataset.bookId = bookB.books_id;
}

// --- Step 6: Implement pairwise ranking ---
function recordPreference(preferredBookId) {
    const [bookA, bookB] = currentBooksToCompare;
    const losingBookId = (bookA.books_id === preferredBookId) ? bookB.books_id : bookA.books_id;

    // Record the outcome (for potential future use, e.g., undo or more complex algo)
    comparisonHistory.push({
        winner: preferredBookId,
        loser: losingBookId,
        comparisonDate: new Date().toISOString()
    });

    // Simple Point System: Winner gets 1 point
    bookScores[preferredBookId] = (bookScores[preferredBookId] || 0) + 1;
    // You could also decrement the loser's score if you want a more competitive spread:
    // bookScores[losingBookId] = (bookScores[losingBookId] || 0) - 0.5; // Example: loser loses half a point

    saveRankingToLocalStorage(); // Save after each choice
    displayRankedList(); // Update the ranked list immediately
    displayNextComparison(); // Show new books for comparison
}

book1Button.addEventListener('click', (event) => {
    recordPreference(event.target.dataset.bookId);
});

book2Button.addEventListener('click', (event) => {
    recordPreference(event.target.dataset.bookId);
});

// --- Step 7: Display the ranked list ---
function displayRankedList() {
    // Convert bookScores object into an array of {id, score} for sorting
    const rankedBooksArray = Object.keys(bookScores).map(id => {
        const book = allBooks.find(b => b.books_id === id);
        return {
            id: id,
            title: book ? book.title : 'Unknown Book',
            author: book ? book.primaryauthor : 'Unknown Author',
            score: bookScores[id]
        };
    });

    // Sort by score in descending order
    rankedBooksArray.sort((a, b) => b.score - a.score);

    // Clear previous list
    rankedBookList.innerHTML = '';

    if (rankedBooksArray.length === 0) {
        rankedBookList.innerHTML = '<li>No books ranked yet.</li>';
        return;
    }

    // Display the sorted list
    rankedBooksArray.forEach((bookData, index) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<span class="rank-number">${index + 1}.</span> <strong>${bookData.title}</strong> by ${bookData.author} (Score: ${bookData.score})`;
        rankedBookList.appendChild(listItem);
    });
}

// --- Step 8: Save progress ---
function saveRankingToLocalStorage() {
    try {
        localStorage.setItem('bookRankingScores', JSON.stringify(bookScores));
        localStorage.setItem('bookComparisonHistory', JSON.stringify(comparisonHistory));
    } catch (e) {
        console.error("Error saving to local storage:", e);
        alert("Failed to save progress. Local storage might be full or disabled.");
    }
}

function loadRankingFromLocalStorage() {
    try {
        const savedScores = localStorage.getItem('bookRankingScores');
        const savedHistory = localStorage.getItem('bookComparisonHistory');

        if (savedScores) {
            bookScores = JSON.parse(savedScores);
            console.log("Loaded scores:", bookScores);
        }
        if (savedHistory) {
            comparisonHistory = JSON.parse(savedHistory);
            console.log("Loaded history:", comparisonHistory);
        }
    } catch (e) {
        console.error("Error loading from local storage:", e);
        // Clear corrupt data if parsing fails
        localStorage.removeItem('bookRankingScores');
        localStorage.removeItem('bookComparisonHistory');
        bookScores = {};
        comparisonHistory = [];
        alert("Corrupt data found in local storage. Ranking reset.");
    }
}

// Initial load of books and display
document.addEventListener('DOMContentLoaded', loadBooks);