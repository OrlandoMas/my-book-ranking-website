let allBooks = []; // Stores all books from JSON
let comparisonHistory = []; // To store pairs of books compared and the winner
let bookScores = {}; // To store the ranking score for each book
let bookApiDetailsCache = {}; // Cache for storing fetched Google Books API details

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
const INITIAL_ELO = 1500; // Starting Elo rating for all books
const SUMMARY_MAX_LENGTH = 300; // Adjust this number to your preference
const K_FACTOR = 32;       // How much ratings change per game
const book1Cover = book1Element.querySelector('.book-cover'); // ADD THIS LINE
const book2Cover = book2Element.querySelector('.book-cover'); // ADD THIS LINE


let currentBooksToCompare = []; // Stores the two books currently being displayed

// --- Step 4: Load and display your book list ---
async function loadBooks() {
    try {
        const response = await fetch('librarything_Orlando_Mas.json');
        const jsonData = await response.json();
        allBooks = Object.values(jsonData); // Correctly convert object to array


        // Load scores from localStorage or initialize
        const storedScores = localStorage.getItem('bookRankingScores');
        if (storedScores) {
            bookScores = JSON.parse(storedScores);
        } else {
            bookScores = {}; // Initialize as empty if nothing stored
        }

        // Load API details cache from localStorage
        const storedApiDetails = localStorage.getItem('bookApiDetailsCache');
        if (storedApiDetails) {
            bookApiDetailsCache = JSON.parse(storedApiDetails);
        } else {
            bookApiDetailsCache = {};
        }

        // Ensure every book has an initial ELO score
        allBooks.forEach(book => {
            if (bookScores[book.books_id] === undefined) {
                bookScores[book.books_id] = INITIAL_ELO;
            }
        });

        // --- NEW: Fetch and cache rich book data from Google Books API ---
        const fetchDetailsPromises = allBooks.map(async book => {
            // Use originalisbn for consistency, or the first available ISBN
            const isbnToUse = book.originalisbn || (Array.isArray(book.isbn) ? book.isbn[0] : (book.isbn && book.isbn[0]));

            if (!isbnToUse) {
                // console.warn(`No suitable ISBN found for book: ${book.title}`);
                // Ensure book has default googleBooksData even if no ISBN
                book.googleBooksData = { thumbnailUrl: null, description: book.summary };
                return; // Skip books without a usable ISBN
            }

            // Check cache first
            if (bookApiDetailsCache[isbnToUse]) {
                book.googleBooksData = bookApiDetailsCache[isbnToUse]; // Augment book object
                return;
            }

            // Fetch from API if not in cache
            const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbnToUse}`;
            try {
                const apiResponse = await fetch(apiUrl);
                if (!apiResponse.ok) {
                    console.error(`Google Books API HTTP error for ISBN ${isbnToUse}: ${apiResponse.status}`);
                    // Store 'error' state to avoid re-fetching on next load if permanent API issue
                    bookApiDetailsCache[isbnToUse] = { thumbnailUrl: null, description: book.summary, apiFetchError: true };
                    book.googleBooksData = { thumbnailUrl: null, description: book.summary }; // Augment with empty data
                    return;
                }
                const apiData = await apiResponse.json();

                if (apiData.items && apiData.items.length > 0) {
                    const volumeInfo = apiData.items[0].volumeInfo;
                    const details = {
                        thumbnailUrl: volumeInfo.imageLinks ? (volumeInfo.imageLinks.smallThumbnail || volumeInfo.imageLinks.thumbnail) : null,
                        // Prefer API description, fallback to local summary, then empty string
                        description: volumeInfo.description || book.summary || '',
                        pageCount: volumeInfo.pageCount || null,
                        publishedDate: volumeInfo.publishedDate || null
                    };
                    bookApiDetailsCache[isbnToUse] = details; // Store in cache
                    book.googleBooksData = details; // Augment book object
                } else {
                    // Cache "no result" to avoid re-fetching for the same ISBN
                    bookApiDetailsCache[isbnToUse] = { thumbnailUrl: null, description: book.summary || '', noApiResult: true };
                    book.googleBooksData = { thumbnailUrl: null, description: book.summary || '' }; // Augment with empty data
                }
            } catch (apiError) {
                console.error(`Error fetching Google Books data for ISBN ${isbnToUse}:`, apiError);
                // Cache "error" state
                bookApiDetailsCache[isbnToUse] = { thumbnailUrl: null, description: book.summary || '', apiFetchError: true };
                book.googleBooksData = { thumbnailUrl: null, description: book.summary || '' }; // Augment with empty data
            }
        });

        // Wait for all API calls (or cache reads) to complete
        await Promise.all(fetchDetailsPromises);
        localStorage.setItem('bookApiDetailsCache', JSON.stringify(bookApiDetailsCache)); // Save cache to localStorage

        // Load comparison history
        const storedHistory = localStorage.getItem('bookComparisonHistory');
        if (storedHistory) {
            comparisonHistory = JSON.parse(storedHistory);
        } else {
            comparisonHistory = [];
        }

        // Now that all data (local and API) is loaded and processed, display elements
        displayNextComparison();
        displayRankedList();
    } catch (error) {
        console.error('Error loading books:', error);
        displayMessage('Error loading book data. Please try refreshing.', 'error');
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

    // Set book 1 details
    book1Title.textContent = bookA.title || 'Unknown Title';
    book1Author.textContent = bookA.primaryauthor || 'Unknown Author';
    book1Button.dataset.bookId = bookA.books_id;
    // Set book 1 cover (using googleBooksData)
    book1Cover.src = bookA.googleBooksData && bookA.googleBooksData.thumbnailUrl ? bookA.googleBooksData.thumbnailUrl : 'images/default-cover.png';
    book1Cover.alt = `Cover for ${bookA.title}`;
    
    // Set book 2 details
    book2Title.textContent = bookB.title || 'Unknown Title';
    book2Author.textContent = bookB.primaryauthor || 'Unknown Author';
    book2Button.dataset.bookId = bookB.books_id;
    // Set book 2 cover (using googleBooksData)
    book2Cover.src = bookB.googleBooksData && bookB.googleBooksData.thumbnailUrl ? bookB.googleBooksData.thumbnailUrl : 'images/default-cover.png';
    book2Cover.alt = `Cover for ${bookB.title}`;
}

// Helper function to calculate expected score between two players (books)
function calculateExpectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// --- Step 6: Implement pairwise ranking ---
function recordPreference(preferredBookId, otherBookId) {
    const book1 = allBooks.find(b => b.books_id === preferredBookId);
    const book2 = allBooks.find(b => b.books_id === otherBookId);

    if (!book1 || !book2) {
        console.error("Error: One of the books not found for recording preference.");
        displayMessage("Error recording preference.", "error");
        return;
    }

    // Get current Elo ratings
    let ratingA = bookScores[preferredBookId];
    let ratingB = bookScores[otherBookId];

    // Calculate expected scores
    const expectedScoreA = calculateExpectedScore(ratingA, ratingB);
    const expectedScoreB = calculateExpectedScore(ratingB, ratingA); // Or 1 - expectedScoreA

    // Determine actual scores
    const actualScoreA = 1; // Preferred book wins
    const actualScoreB = 0; // Other book loses

    // Update ratings using the Elo formula
    ratingA = ratingA + K_FACTOR * (actualScoreA - expectedScoreA);
    ratingB = ratingB + K_FACTOR * (actualScoreB - expectedScoreB);

    // Store updated ratings (round to avoid long decimals)
    bookScores[preferredBookId] = Math.round(ratingA);
    bookScores[otherBookId] = Math.round(ratingB);

    // Store comparison history
    comparisonHistory.push({
        winnerId: preferredBookId,
        loserId: otherBookId,
        timestamp: new Date().toISOString()
    });

    // Save to localStorage
    localStorage.setItem('bookRankingScores', JSON.stringify(bookScores));
    localStorage.setItem('bookComparisonHistory', JSON.stringify(comparisonHistory));

    displayNextComparison();
    displayRankedList(); // Refresh the ranked list with new Elo scores
}

book1Button.addEventListener('click', (event) => {
    // When book1 is preferred, book2 is the other book
    recordPreference(currentBooksToCompare[0].books_id, currentBooksToCompare[1].books_id);
});

book2Button.addEventListener('click', (event) => {
    // When book2 is preferred, book1 is the other book
    recordPreference(currentBooksToCompare[1].books_id, currentBooksToCompare[0].books_id);
});


// --- Step 7: Display the ranked list ---
function displayRankedList() {
    // Sort books by Elo score in descending order
    const sortedBooks = Object.keys(bookScores)
        .filter(id => allBooks.hasOwnProperty(id)) // Ensure book still exists in allBooks
        .map(id => ({
            ...allBooks[id],
            score: bookScores[id]
        }))
        .sort((a, b) => b.score - a.score);

    rankedBookList.innerHTML = ''; // Clear previous list

    if (sortedBooks.length === 0) {
        rankedBookList.innerHTML = '<li>No books ranked yet.</li>';
        return;
    }

    sortedBooks.forEach((book, index) => {
        const listItem = document.createElement('li');
        listItem.classList.add('ranked-book-item');

        // Prepare the summary content: Use Google Books description if available, otherwise fallback to original summary.
        // Strip HTML and truncate if needed.
        const rawSummaryToUse = book.googleBooksData && book.googleBooksData.description ? book.googleBooksData.description : book.summary || '';
        const cleanedSummary = stripHtmlTags(rawSummaryToUse);
        let summaryContentHtml = '';

        if (cleanedSummary.length > SUMMARY_MAX_LENGTH) {
            const truncatedText = cleanedSummary.substring(0, SUMMARY_MAX_LENGTH).trim();
            summaryContentHtml = `
                <span class="truncated-text">${truncatedText}...</span>
                <span class="full-text" style="display: none;">${cleanedSummary}</span>
                <a href="#" class="read-more-link" data-action="expand">Read more</a>
            `;
        } else {
            summaryContentHtml = cleanedSummary;
        }

        listItem.innerHTML = `
          <div class="rank">${index + 1}.</div>
            <div class="book-details">
              <img class="ranked-book-cover" src="${book.googleBooksData && book.googleBooksData.thumbnailUrl ? book.googleBooksData.thumbnailUrl : 'image/default-cover.png'}" alt="Cover for ${book.title || 'Unknown Book'}">
              <div class="title-author-elo">
                <span class="title">${book.title}</span> by <span class="author">${book.primaryauthor}</span>
              </div>
              <div class="summary-toggle">
                <button class="toggle-summary-button">Show Summary</button>
              </div>
              <div class="ranked-summary" style="display: none;">${summaryContentHtml}</div>
            </div>
        `;
        rankedBookList.appendChild(listItem);
    });
}

// --- Step 8: Save progress ---
function saveRankingToLocalStorage() {
    try {
        localStorage.setItem('bookRankingScores', JSON.stringify(bookScores));
        localStorage.setItem('bookComparisonHistory', JSON.stringify(comparisonHistory));
        displayMessage('Your progress has been saved!', 'success'); // User feedback
    } catch (e) {
        console.error("Error saving to local storage:", e);
        // More specific error messages based on common LocalStorage errors
        if (e.name === 'QuotaExceededError') {
            displayMessage('Storage limit reached! Could not save all data. Please clear some browser data or contact support.', 'error');
        } else {
            displayMessage('Failed to save progress. Local storage might be full or disabled. Error: ' + e.message, 'error');
        }
    }
}

function loadRankingFromLocalStorage() {
    try {
        const savedScores = localStorage.getItem('bookRankingScores');
        const savedHistory = localStorage.getItem('bookComparisonHistory');

        if (savedScores) {
            bookScores = JSON.parse(savedScores);
            // console.log("Loaded scores:", bookScores); // Keep for debugging, remove for production
        }
        if (savedHistory) {
            comparisonHistory = JSON.parse(savedHistory);
            // console.log("Loaded history:", comparisonHistory); // Keep for debugging, remove for production
        }
        displayMessage('Your previous rankings have been loaded!', 'info'); // User feedback

    } catch (e) {
        console.error("Error loading from local storage:", e);
        // Clear potentially corrupt data if parsing fails
        localStorage.removeItem('bookRankingScores');
        localStorage.removeItem('bookComparisonHistory');
        bookScores = {}; // Reset scores
        comparisonHistory = []; // Reset history
        displayMessage('Corrupt data found in local storage. Your ranking has been reset.', 'error');
    }
}

// Function to export rankings to a downloadable JSON file
function exportRankingsToFile() {
    try {
        const scores = localStorage.getItem('bookRankingScores');
        const history = localStorage.getItem('bookComparisonHistory');

        if (!scores && !history) {
            displayMessage('No ranking data to export!', 'info');
            return;
        }

        const exportData = {
            bookRankingScores: scores ? JSON.parse(scores) : {},
            bookComparisonHistory: history ? JSON.parse(history) : []
        };

        // Convert the data to a JSON string
        const dataStr = JSON.stringify(exportData, null, 2); // null, 2 for pretty printing

        // Create a Blob from the JSON string
        const blob = new Blob([dataStr], { type: 'application/json' });

        // Create a temporary URL for the Blob
        const url = URL.createObjectURL(blob);

        // Create a temporary link element
        const a = document.createElement('a');
        a.href = url;
        a.download = `book_rankings_backup_${new Date().toISOString().split('T')[0]}.json`; // Filename with date

        // Append link to body, click it, and remove it
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Revoke the object URL to free up memory
        URL.revokeObjectURL(url);

        displayMessage('Your rankings have been exported successfully!', 'success');

    } catch (e) {
        console.error("Error exporting data:", e);
        displayMessage('Failed to export rankings. Error: ' + e.message, 'error');
    }
}

// Function to handle importing rankings from a file
function importRankingsFromFile(event) {
    const file = event.target.files[0]; // Get the selected file

    if (!file) {
        displayMessage('No file selected for import.', 'info');
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (importedData.bookRankingScores && importedData.bookComparisonHistory) {
                // Confirm with the user before overwriting
                if (!confirm('Importing will overwrite your current rankings. Are you sure you want to proceed?')) {
                    displayMessage('Import cancelled.', 'info');
                    return; // Exit if user cancels
                }

                // Update in-memory data directly with imported data
                bookScores = importedData.bookRankingScores;
                comparisonHistory = importedData.bookComparisonHistory;

                // Also update localStorage
                localStorage.setItem('bookRankingScores', JSON.stringify(bookScores));
                localStorage.setItem('bookComparisonHistory', JSON.stringify(comparisonHistory));

                // Re-initialize scores for all books if needed (important for newly imported books)
                // This ensures allBooks has a score, even if 0, for the display
                allBooks.forEach(book => {
                    if (bookScores[book.books_id] === undefined) {
                        bookScores[book.books_id] = 0;
                    }
                });


                // Refresh the UI to reflect the imported data
                displayRankedList(); // Regenerate and display the ranked list
                displayNextComparison(); // Update the comparison section
                displayMessage('Rankings imported successfully!', 'success');
                displayCacheReminder();

            } else {
                displayMessage('Invalid import file format. Missing ranking data.', 'error');
            }
        } catch (error) {
            console.error("Error parsing or importing data:", error);
            displayMessage('Failed to import rankings. Please ensure it\'s a valid JSON backup file. Error: ' + error.message, 'error');
        }
    };

    reader.onerror = function() {
        displayMessage('Failed to read file. Please try again.', 'error');
    };

    reader.readAsText(file); // Read the file as text
}
// Helper function to display messages to the user
function displayMessage(message, type = 'info', duration = 3000) {
    messageArea.textContent = message;
    messageArea.className = ''; // Clear previous classes
    messageArea.classList.add(type);
    messageArea.style.display = 'block';

    // Hide message after a duration
    setTimeout(() => {
        messageArea.style.display = 'none';
    }, duration);
}

function resetAllRankings() {
    if (confirm('Are you sure you want to reset all rankings? This cannot be undone!')) {
        localStorage.removeItem('bookRankingScores');
        localStorage.removeItem('bookComparisonHistory');
        bookScores = {}; // Reset in-memory scores

        // Re-initialize all books to their initial Elo rating
        allBooks.forEach(book => {
            bookScores[book.books_id] = INITIAL_ELO; // <-- CHANGE THIS LINE
        });

        comparisonHistory = []; // Reset in-memory history

        displayRankedList(); // Update the displayed list to be empty/reset
        displayNextComparison(); // Show a new comparison
        displayMessage('All rankings have been reset successfully!', 'info');
    }
}

// Function to display the cache reminder message  Step 9 improvement but implented by changes in step 8
function displayCacheReminder() {
    const dismissed = localStorage.getItem('cacheReminderDismissed');
        cacheReminderMessage.style.display = 'block';
}

// Temporary function to test Google Books API
async function testGoogleBooksAPI() {
    const testISBN = '031209423X'; // Use an ISBN from your librarything_Orlando_Mas.json
    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${testISBN}`;

    console.log(`Attempting to fetch data for ISBN: ${testISBN}`);
    console.log(`API URL: ${apiUrl}`);

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Google Books API Response:", data);

        // Check if data.items exists and has content
        if (data.items && data.items.length > 0) {
            const bookInfo = data.items[0].volumeInfo;
            console.log("Found Book Title:", bookInfo.title);
            console.log("Found Book Authors:", bookInfo.authors);
            console.log("Found Book Description (Summary):", bookInfo.description);
            if (bookInfo.imageLinks) {
                console.log("Found Small Thumbnail Cover:", bookInfo.imageLinks.smallThumbnail);
                console.log("Found Thumbnail Cover:", bookInfo.imageLinks.thumbnail);
            }
        } else {
            console.log("No results found for this ISBN.");
        }

    } catch (error) {
        console.error("Error fetching from Google Books API:", error);
    }
}

// Helper function to strip HTML tags from a string
function stripHtmlTags(str) {
    if ((str === null) || (str === '')) {
        return false;
    } else {
        str = str.toString();
        // Use a regular expression to remove HTML tags
        return str.replace(/<[^>]*>/g, '');
    }
}

// Call the test function once the DOM is loaded to see results in console
document.addEventListener('DOMContentLoaded', () => {
    loadBooks();
    // testGoogleBooksAPI(); // <--- ADD THIS LINE TEMPORARILY FOR TESTING
});

// Initial load of books and display
document.addEventListener('DOMContentLoaded', () => {
    loadBooks();
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
    localStorage.setItem('cacheReminderDismissed', 'true'); // Set flag in local storage
    cacheReminderMessage.style.display = 'none'; // Hide the message
    displayMessage('Reminder dismissed. You can clear your browser\'s local storage to show it again.', 'info', 5000);
});

// Event listener for toggling summary visibility AND "Read more/Show less" within summary
rankedBookList.addEventListener('click', (event) => {
    // Handle "Show Summary" / "Hide Summary" button
    if (event.target.classList.contains('toggle-summary-button')) {
        const summaryElement = event.target.closest('.ranked-book-item').querySelector('.ranked-summary');
        if (summaryElement) { // Check if summaryElement exists
            if (summaryElement.style.display === 'none') {
                summaryElement.style.display = 'block';
                event.target.textContent = 'Hide Summary';
            } else {
                summaryElement.style.display = 'none';
                event.target.textContent = 'Show Summary';
            }
        }
    }

    // Handle "Read more" / "Show less" links within the summary itself
    if (event.target.classList.contains('read-more-link')) {
        event.preventDefault(); // Prevent default link behavior (jumping to top)
        const rankedSummaryDiv = event.target.closest('.ranked-summary');
        if (rankedSummaryDiv) { // Ensure the parent summary div exists
            const truncatedTextSpan = rankedSummaryDiv.querySelector('.truncated-text');
            const fullTextSpan = rankedSummaryDiv.querySelector('.full-text');

            if (event.target.dataset.action === 'expand') {
                truncatedTextSpan.style.display = 'none';
                fullTextSpan.style.display = 'inline'; // Use inline to flow with text
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
