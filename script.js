let allBooks = []; // Stores all books from JSON
let comparisonHistory = []; // To store pairs of books compared and the winner
let bookScores = {}; // To store the ranking score for each book
let bookApiDetailsCache = {}; // Cache for storing fetched Google Books API details
let currentBooksToCompare = []; // Stores the two books currently being displayed

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
const loadingIndicator = document.getElementById('loading-indicator');

const INITIAL_ELO = 1500; // Starting Elo rating for all books
const SUMMARY_MAX_LENGTH = 300; // Adjust this number to your preference
const K_FACTOR = 32;       // How much ratings change per game
const book1Cover = book1Element.querySelector('.book-cover'); // ADD THIS LINE
const book2Cover = book2Element.querySelector('.book-cover'); // ADD THIS LINE

// Helper function to introduce a delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGoogleBooksData(query, retries = 3, currentDelay = 1000) {
    // Construct the URL for the Google Books API. Ensure you have an API key if necessary.
    // For simplicity, assuming no API key is strictly required for basic searches or it's handled elsewhere.
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url);

            if (response.status === 429) {
                console.warn(`Attempt ${attempt + 1}: Too Many Requests (429). Retrying in ${currentDelay / 1000} seconds...`);
                await delay(currentDelay);
                currentDelay *= 2; // Double the delay for the next attempt
                continue; // Go to the next iteration of the loop to retry
            }

            if (!response.ok) {
                // For other non-OK responses (e.g., 404, 500), throw an error
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.items && data.items.length > 0) {
                const item = data.items[0].volumeInfo;
                return {
                    title: item.title,
                    authors: item.authors ? item.authors.join(', ') : 'Unknown Author',
                    description: item.description || 'No description available.',
                    thumbnailUrl: item.imageLinks ? item.imageLinks.thumbnail : 'images/default-cover.png',
                    infoLink: item.infoLink // Link to Google Books page
                };
            } else {
                return null; // No items found for the query
            }
        } catch (error) {
            console.error(`Attempt ${attempt + 1}: Error fetching Google Books data for "${query}":`, error);
            if (attempt < retries - 1) { // If not the last attempt, wait and retry
                await delay(currentDelay);
                currentDelay *= 2; // Double the delay for the next attempt
            }
        }
    }
    console.error(`Failed to fetch Google Books data for "${query}" after ${retries} attempts.`);
    return null; // Return null if all retries fail
}

// --- Step 4: Load and display your book list ---
async function loadBooks() {
    // Show the loading indicator at the very beginning
    if (loadingIndicator) { // Check if the element exists
        loadingIndicator.style.display = 'block';
    }

    try {
        loadBookApiDetailsCache();

        const response = await fetch('librarything_Orlando_Mas.json');
        const data = await response.json();

        allBooks = data;
        console.log('loadBooks: allBooks after loading JSON:', allBooks); // Debug log

        const savedScores = localStorage.getItem('bookScores');
        if (savedScores) {
            bookScores = JSON.parse(savedScores);
            console.log('loadBooks: bookScores after initialization/load:', bookScores); // Debug log
        } else {
            Object.keys(allBooks).forEach(id => {
                bookScores[id] = INITIAL_ELO;
            });
            console.log('loadBooks: bookScores after initialization/load:', bookScores); // Debug log
        }

        // Fetch Google Books API details for each book
        for (const bookId in allBooks) {
            const book = allBooks[bookId];
            if (!bookApiDetailsCache[bookId]) {
                const query = book.isbn ? `isbn:${book.isbn[0]}` : `${book.title} ${book.primaryauthor}`;
                const googleBooksData = await fetchGoogleBooksData(query);
                if (googleBooksData) {
                    book.googleBooksData = googleBooksData;
                    bookApiDetailsCache[bookId] = googleBooksData;
                }
            } else {
                book.googleBooksData = bookApiDetailsCache[bookId];
            }
        }
        saveBookApiDetailsCache();

        displayNextComparison();
        displayRankedList();

    } catch (error) {
        console.error('Error loading books:', error);
        displayMessage('Error loading books: ' + error.message, 'error');
    } finally {
        // Hide the loading indicator when loading is complete (or an error occurs)
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// --- Step 5: Ranking interface ---
// Function to get two random unique books that haven't been compared
function getRandomUniqueBooks() {
    const availableBookIds = Object.keys(allBooks).filter(id => {
        // Ensure book has not been compared with the other in the last N rounds
        // Implement comparison history logic here if desired, e.g.:
        // return !comparisonHistory.some(c =>
        //     (c.book1 === id && c.book2 === someOtherId) ||
        //     (c.book2 === id && c.book1 === someOtherId)
        // );
        return true; // For now, assuming allBooks are initially available
    });

    if (availableBookIds.length < 2) {
        noMoreBooksMessage.style.display = 'block';
        rankingInterface.style.display = 'none';
        return null; // Not enough books to compare
    }

    // Filter out books that have already been chosen for comparison in this session
    const currentlyComparingIds = [book1Element.dataset.bookId, book2Element.dataset.bookId];
    // Ensure currentlyComparingIds are actual IDs and are in availableBookIds
    const eligibleBookIds = availableBookIds.filter(id => !currentlyComparingIds.includes(id));

    // Fallback if not enough eligible books after filtering:
    // If we can't find 2 unique books that haven't been compared in this session,
    // we can reset the session's comparison or just pick from all available.
    let finalEligibleIds = eligibleBookIds;
    if (eligibleBookIds.length < 2) {
        finalEligibleIds = availableBookIds; // Fallback to all available books
        // If still not enough, then there's a problem, or we truly ran out of unique pairs.
        if (finalEligibleIds.length < 2) {
            noMoreBooksMessage.style.display = 'block';
            rankingInterface.style.display = 'none';
            return null;
        }
    }

    let book1Id, book2Id;
    do {
        book1Id = finalEligibleIds[Math.floor(Math.random() * finalEligibleIds.length)];
        book2Id = finalEligibleIds[Math.floor(Math.random() * Math.min(finalEligibleIds.length, 100))]; // Cap random to prevent infinite loops on small sets
    } while (book1Id === book2Id || !allBooks.hasOwnProperty(book1Id) || !allBooks.hasOwnProperty(book2Id)); // Ensure IDs exist in allBooks

    // Corrected line: Return the IDs directly
    return { book1: book1Id, book2: book2Id };
}


function displayNextComparison() {
    const bookIdsToCompare = getRandomUniqueBooks(); // Get the object containing book IDs

    if (!bookIdsToCompare) { // If getRandomUniqueBooks returns null (no more books to compare)
        rankingInterface.style.display = 'none';
        noMoreBooksMessage.style.display = 'block';
        return;
    }

    // Correctly extract book IDs from the returned object
    const book1Id = bookIdsToCompare.book1;
    const book2Id = bookIdsToCompare.book2;

    // Retrieve the full book objects from your allBooks data structure
    const bookA = allBooks[book1Id];
    const bookB = allBooks[book2Id];

    // Assign the actual book objects (as an array) to currentBooksToCompare for later use
    // (e.g., by the recordPreference function)
    currentBooksToCompare = [bookA, bookB];

    // ... The rest of your displayNextComparison function follows from here ...
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
    // Corrected: Access books directly from the allBooks object using their IDs
    const book1 = allBooks[preferredBookId];
    const book2 = allBooks[otherBookId];
    
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
              <img class="ranked-book-cover" src="${book.googleBooksData && book.googleBooksData.thumbnailUrl ? book.googleBooksData.thumbnailUrl : 'images/default-cover.png'}" alt="Cover for ${book.title || 'Unknown Book'}">
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

// Function to save the book API details cache to local storage
function saveBookApiDetailsCache() {
    try {
        localStorage.setItem('bookApiDetailsCache', JSON.stringify(bookApiDetailsCache));
        // console.log("Book API details cache saved."); // Optional: uncomment for debugging
    } catch (e) {
        console.error("Error saving book API details cache to local storage:", e);
    }
}

// Function to load the book API details cache from local storage
function loadBookApiDetailsCache() {
    try {
        const savedCache = localStorage.getItem('bookApiDetailsCache');
        if (savedCache) {
            bookApiDetailsCache = JSON.parse(savedCache);
            // console.log("Book API details cache loaded."); // Optional: uncomment for debugging
        }
    } catch (e) {
        console.error("Error loading book API details cache from local storage:", e);
        // Clear corrupt cache if parsing fails
        localStorage.removeItem('bookApiDetailsCache');
        bookApiDetailsCache = {};
    }
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

                // Corrected: Initialize scores for books present in allBooks but not in importedScores
                Object.keys(allBooks).forEach(bookId => {
                    // If a book from allBooks doesn't have a score after import, initialize it
                    if (bookScores[bookId] === undefined) {
                        bookScores[bookId] = INITIAL_ELO; // Initialize it with the default Elo
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

        // Corrected: Iterate over the keys (IDs) of allBooks and initialize their scores
        Object.keys(allBooks).forEach(id => {
            bookScores[id] = INITIAL_ELO;
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
