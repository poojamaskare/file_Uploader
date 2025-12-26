# File Uploader

This project contains:
- A frontend-only file uploader (no backend DB) that stores files in your browser using IndexedDB.
- An Express API (optional) designed for GridFS; you can ignore it if you only need the frontend.

## Requirements
- A web browser (for frontend-only)
- Optional: Node.js 18+ and MongoDB if you want to run the API

## Frontend (No DB)

Open the frontend directly in your browser:

```
file_Uploader/frontend/index.html
```

Or on Windows PowerShell:

```powershell
Start-Process "c:\Users\Pooja\Desktop\file_Uploader\frontend\index.html"
```

Features:
- Drag & drop or select file.
- Client-side validation: PNG, JPEG, PDF, TXT up to 10MB.
- Stores files locally using IndexedDB.
- List, download, and delete stored files.

## Optional: API (GridFS)

If you later want to use the API:
1. Install dependencies:
   ```powershell
   npm install
   ```
2. Configure environment:
   - Copy `.env.example` to `.env` and set `MONGODB_URI`.
3. Start the server:
   ```powershell
   npm start
   ```
   The server listens on `http://localhost:3000` by default.

Endpoints:
- `POST /files` – Upload (`file` field, `multipart/form-data`)
- `GET /files/:id` – Download by id
- `DELETE /files/:id` – Delete by id
- `GET /files` – List recent files

## Validation & Error Handling
- Frontend: client-side validation (MIME + size) with friendly messages.
- API: parameter validation for ObjectId and robust error responses (if used).

## Quick Try (Frontend)

1. Open `frontend/index.html`.
2. Drag a file into the dropzone or select via the button.
3. Click "Save to Browser".
4. Use the table to Download or Delete stored files.

## Configuration
- Frontend-only requires no configuration; data persists in your browser.
- API configuration (if used): see `.env.example`.

## Notes
- Ensure your MongoDB service is running locally or adjust `MONGODB_URI` to point to your instance.
- The upload field name must be exactly `file`.
