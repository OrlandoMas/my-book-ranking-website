# My Personal Book Ranking Website

A simple web application to rank personal book collections using a pairwise comparison method, built with HTML, CSS, and JavaScript. This project allows users to load their LibraryThing inventory, compare books, and build a ranked list, with progress saved directly in the browser.

## Project Goal

The primary goal of this project is to create a personal tool for ranking books from a user's collection. It leverages a pairwise comparison system where the user chooses their preferred book between two randomly presented options, gradually building a comprehensive ranked list.

## Initial Setup & Data

This project begins by utilizing an exported book inventory from LibraryThing.

* **Step 1: Export LibraryThing Inventory as JSON**
    The project uses a JSON file exported from LibraryThing (e.g., `librarything_Orlando_Mas.json`) as its data source. This file contains details about the books in the user's collection.
* **Step 2: Store JSON File Locally**
    The `librarything_Orlando_Mas.json` file is placed directly in the project's root directory, making it accessible to the web application.

## Project Structure

The core files for the website are structured as follows:

```

my-book-ranking-website/
├── index.html        \# Main structure of the website
├── style.css         \# Styling for the website
├── script.js         \# Core JavaScript logic for ranking and data handling
└── librarything\_Orlando\_Mas.json \# Your exported book data

```

## Features in Initial Commit (Initial Development Phase)

This first major commit establishes the foundational elements of the personal book ranking website.

* **Step 3: Site Interface (HTML & CSS)**
    * A basic `index.html` file provides the main layout for the ranking interface and the ranked list display area.
    * `style.css` provides fundamental styling for a clean and readable user interface.
* **Step 4: Load and Display Book List (JavaScript)**
    * The `script.js` file successfully loads book data from `librarything_Orlando_Mas.json`.
    * It dynamically displays two random books for comparison.
* **Step 5: Ranking Interface**
    * Users are presented with two randomly selected books side-by-side.
    * "I prefer this" buttons allow the user to select their preferred book in a comparison.
* **Step 8: Save Progress (Local Storage)**
    * Although conceptually an advanced step, the initial `script.js` includes functionality to save book scores and comparison history directly to the browser's `localStorage`. This ensures that ranking progress persists even after closing and reopening the browser tab. Error handling, user feedback, and a reset option have also been integrated for robustness.
* **Step 10: GitHub Hosting (GitHub Pages)**
    * The entire project is hosted on GitHub, enabling version control and easy sharing.
    * The site is made live using GitHub Pages, making it accessible via a public URL.

## How to Run Locally

While the site is hosted on GitHub Pages, you can also run it locally for development:

1.  **Clone the repository:** (If you used the web upload, download the `.zip` from GitHub and extract it, or use Git if you set up Linux Beta).
2.  **Navigate to the project folder:** Ensure `index.html`, `style.css`, `script.js`, and `librarything_Orlando_Mas.json` are in the same directory.
3.  **Open `index.html` in your web browser:** Simply double-click the `index.html` file.
    * *Note:* Due to browser security restrictions (CORS), the JSON data might not load if opened directly (`file:///` protocol). For local development, it is recommended to use a simple local web server (e.g., Python's `http.server` or "Web Server for Chrome" extension).

## Live Site

Access the live personal book ranking website here:
[https://orlandomas.github.io/my-book-ranking-website/](https://orlandomas.github.io/my-book-ranking-website/)

---
```
