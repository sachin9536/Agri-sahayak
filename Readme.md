
## PDF Q&A Application

This PDF Q&A application allows users to upload PDF files, ask questions related to the content of each document, and receive answers based on natural language processing. It also saves conversation history for each document, allowing users to revisit past interactions and continue their interaction *_*.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

---

## Project Overview

This application is designed to handle questions and answers based on PDF document content, with saved history for user interactions. It uses:
- **FastAPI** for backend API and request handling
- **SQLite** for storing metadata and conversation history
- **Google Generative AI (Embeddings)** for document embeddings
- **FAISS** for vector storage and retrieval
- **React.js** for a beautifull, interactive and a very responsive frontend

---

## Features

- **PDF Upload**: Allows users to upload PDF documents.
- **Question-Answer Interaction**: Users can ask questions about the PDF content and receive relevant answers.
- **Conversation History**: Each document’s conversation history is stored, allowing users to resume from their last interaction.
- **Embeddings and Vector Search**: Uses embeddings for efficient information retrieval.
- **User-Friendly Interface**: Built with React for a very interactive and fast frontend.

---

## Architecture Overview

### System Components

1. **React Frontend**: 
   - Provides a user interface for uploading PDFs, asking questions, and viewing answers and also to continue the past conversations.
   
2. **FastAPI Backend**:
   - Handles RESTful API requests, document storage, and NLP processing.
   
3. **Google Generative AI**:
   - Generates embeddings for document content and questions.
   
4. **FAISS Index**:
   - Stores embeddings for fast, semantic search and matching.
   
5. **SQLite Database**:
   - Stores document metadata and conversation history.
---

## Setup Instructions
### Prerequisites

- **Node.js** (for the frontend)
- **Python 3.9+** (for the backend)
- **FAISS** (for embedding search)
- **Google Generative AI API Key**

### Installation

1. **Clone the Repository**
    ```bash
    git clone <repository-url>
    cd pdf_qa_app
    ```

2. **Environment Setup**
   - Create a virtual environment for the backend:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   - Install required Python packages:
     ```bash
     pip install -r requirements.txt
     ```

3. **Set Up Environment Variables**
   - Create a `.env` file in the `backend/` directory and add your Google Generative AI API key:
     ```plaintext
     GOOGLE_API_KEY=your_google_api_key_here/gemini api key here
     ```

4. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install

### API Documentation

## Base URL
http://127.0.0.1:8000

## Endpoints

1. # Upload PDF
    Endpoint: /upload_pdf
    Method: POST
    Description: Upload a PDF file and store its metadata and embeddings.
    Request:
    Form data with file: PDF file.
    Response:
    200 OK: { "id": "document_id" }
2. # Get Uploaded PDFs
    Endpoint: /get_uploaded_pdfs
    Method: GET
    Description: Retrieve a list of all uploaded PDFs and their metadata.
    Response:
    200 OK: List of document metadata.
3. # Ask Question
    Endpoint: /ask_question
    Method: POST
    Description: Ask a question about a specific document.
    Request:
    JSON { "pdf_id": "document_id", "question": "your question" }
    Response:
    200 OK: { "answer": "answer to your question" }
4. # Get Conversation History
    Endpoint: /get_conversation/{pdf_id}
    Method: GET
    Description: Retrieve conversation history for a specific document.
    Response:
    200 OK: List of question-answer pairs.

## Frontend Instructions
# 1.Start the Frontend
    ```cd frontend
    npm start
    ```
# 2.Access the Frontend: 
 Open a browser and go to http://localhost:3000.

# Frontend Components
    DocumentUpload Component: For uploading PDFs.
    QuestionInput Component: For submitting questions.
    ConversationHistory Component: Displays previous Q&A pairs.

##  Backend Instructions
1.**Start the Backend** 
   ``` uvicorn backend.main:app --reload```
2.**Access the API Documentation** : Go to http://127.0.0.1:8000/docs for the interactive API documentation.

## Backend Modules
**Routes**: Defines endpoints for PDF uploads, Q&A, and conversation retrieval.
**Database**: Manages SQLite database operations for storing metadata and conversations.
**FAISS Indexing**: Provides embedding-based search capabilities.

### Database Schema
 ## Documents Table
Field	        Type	Description
id	            UUID	Unique document ID
filename	    TEXT	Name of the uploaded PDF
upload_date     DATE	Date of upload

## Conversations Table
Field	        Type	        Description
id	            INTEGER	        Unique conversation ID
pdf_id	        UUID	        ID of associated PDF
question	    TEXT	        User question
answer	        TEXT	        AI-generated answer
timestamp	    TIMESTAMP	    Time of question

### Project Structure
pdf_qa_app/
├── backend/
│   ├── main.py           # FastAPI main app
│   ├── routes.py         # API route handlers
│   ├── database.py       # SQLite database setup
│   └── requirements.txt  # Backend dependencies
├── frontend/
│   ├── src/
│   │   ├── App.js        # Main React app
│   │   ├── components/   # React components (Upload, Q&A)
│   └── package.json      # Frontend dependencies
└── README.md             # Project documentation

