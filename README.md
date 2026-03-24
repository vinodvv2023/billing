# Multi-Provider OAuth Authentication System

This project is a complete, production-ready authentication system featuring a **FastAPI** backend and a premium **Next.js** frontend. It seamlessly handles both local Email/Password authentication and 13+ third-party OAuth 2.0 / OIDC providers (Google, GitHub, Microsoft, Twitter, Apple, etc.).

## 🚀 Quick Start / Running the App
The easiest way to start both the backend and frontend simultaneously is to simply double-click the `run.bat` file in the root directory. 

This will automatically open two terminal windows:
- **Backend**: Runs on `http://127.0.0.1:8000`
- **Frontend**: Runs on `http://localhost:3000`

---

## 🛠️ Installation (Manual)

If you prefer to start the services manually, follow these steps:

### 1. Backend (Python/FastAPI)
The backend manages your PostgreSQL/Neon database and handles all authentication logic, tokens, and OAuth linking via `Authlib`.

```bash
# 1. Activate your virtual environment (Windows)
.\.venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start the server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
You can view the interactive API documentation at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 2. Frontend (Next.js)
The frontend is a beautifully styled, glassmorphic React application using App Router and TailwindCSS.

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install Node dependencies
npm install

# 3. Start the development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the login screen.

---

## ⚙️ Configuration & `.env` Setup

For the application to connect to your database and external OAuth providers, you must define environment variables. Create or edit the `.env` file at the root of the project.

### Database Connection
Your backend uses SQLAlchemy to automatically create tables in your Neon PostgreSQL database.
```env
# Example Neon Database String
DATABASE_URL=postgresql://user:password@endpoint.aws.neon.tech/neondb?sslmode=require
```

### OAuth Provider Secrets
To enable third-party logins (like GitHub, Google, or Twitter), you must register an OAuth Application in their respective developer portals. Once created, paste the generated **Client ID** and **Client Secret** into your `.env` file!

```env
# Google
GOOGLE_CLIENT_ID=your_google_id
GOOGLE_CLIENT_SECRET=your_google_secret

# GitHub
GITHUB_CLIENT_ID=your_github_id
GITHUB_CLIENT_SECRET=your_github_secret

# Microsoft
MICROSOFT_CLIENT_ID=your_microsoft_id
MICROSOFT_CLIENT_SECRET=your_microsoft_secret

# Twitter / X
TWITTER_CLIENT_ID=your_twitter_id
TWITTER_CLIENT_SECRET=your_twitter_secret

# Note: The system supports up to 13 providers! Just use standard UPPERCASE syntax.
```

When setting up your OAuth Application in the developer portals, you will be asked for an **Authorized Redirect URI / Callback URL**. 
You must set it to point to your backend:
`http://localhost:8000/auth/{provider}/callback` 
*(Example for GitHub: `http://localhost:8000/auth/github/callback`)*

---

## ⚠️ Important Notes on Testing OAuth

1. **Never test OAuth via AJAX / Fetch:** 
   OAuth providers (like Google and Microsoft) actively block Cross-Origin Resource Sharing (CORS) on their login pages for security. You cannot initiate a login via an asynchronous `fetch()` call. 
   
2. **Standard Browser Navigation:** 
   Your Next.js frontend is built correctly using `window.location.href = "http://localhost:8000/auth/.../login"`. The user *must* be physically navigated away from your app to the provider, which then redirects them back to our backend, which ultimately bounces them back to `/oauth/callback` on your frontend with the final token.

3. **Testing via Swagger UI (`/docs`):** 
   If you try to click the "Execute" button on `/auth/{provider}/login` inside the Swagger docs, it will fail with a CORS error because Swagger uses `fetch()`. Instead, you can expand that endpoint in Swagger and pass `true` to the `json` parameter. The endpoint will then safely return the raw authorization URL: `{"authorization_url": "..."}`. You can copy/paste that URL into your browser to test the full flow manually without frontend code!
