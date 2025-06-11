# Authentication Setup Guide

This guide will walk you through setting up the authentication system for the QR Code Tracker application.

## Backend Setup

1. **Install Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Set Up Environment Variables**
   Copy the example environment file and update it with your configuration:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Edit the `.env` file and set your database URL and JWT secret key.

3. **Initialize the Database**
   ```bash
   python create_admin.py
   ```
   This will create the necessary tables and prompt you to create an admin user.

4. **Run the Backend Server**
   ```bash
   cd backend
   flask run --port 5002
   ```

## Frontend Setup

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure API URL**
   Make sure the `VITE_API_URL` in `frontend/.env` points to your backend server.

3. **Run the Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

## Using the Authentication System

1. **Registration**
   - Navigate to `/register`
   - Enter your email and password
   - The first user will be granted admin privileges

2. **Login**
   - Navigate to `/login`
   - Enter your credentials
   - You'll be redirected to the dashboard on successful login

3. **Protected Routes**
   - `/` - Dashboard (requires login)
   - `/new` - Create new QR code (requires admin)
   - `/qrcodes/:id` - View QR code details (requires login)

## API Endpoints

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get access token
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info

## Security Notes

- Always use HTTPS in production
- Keep your JWT secret key secure and never commit it to version control
- The first registered user automatically becomes an admin
- Implement proper password policies in production
- Consider adding rate limiting to prevent brute force attacks
