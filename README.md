# QR Code Tracker

A full-stack application for generating and managing QR codes with analytics.

## Features

- **User Authentication**: Secure login and registration system
- **Role-based Access**: Admin and regular user roles
- **QR Code Management**: Generate and manage QR codes
- **Organization**: Organize QR codes in folders
- **Analytics**: Track scans and view detailed analytics
- **Responsive Web Interface**: Works on all devices

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Chakra UI, React Router
- **Backend**: Python, Flask, Flask-JWT-Extended, SQLAlchemy
- **Authentication**: JWT (JSON Web Tokens)
- **Database**: SQLite (development), PostgreSQL (production ready)

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- Python 3.9+
- npm or yarn
- PostgreSQL (for production)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/qr-tracker.git
   cd qr-tracker
   ```

2. **Run the setup script**
   ```bash
   ./setup.sh
   ```
   This will guide you through setting up both the backend and frontend.

### Manual Installation

If you prefer to set up manually, follow these steps:

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/qr-tracker.git
   cd qr-tracker
   ```

2. **Set up the backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   
   # Set up environment variables
   cp .env.example .env
   # Edit .env with your configuration
   
   # Initialize the database and create admin user
   python create_admin.py
   ```

3. **Set up the frontend**
   ```bash
   cd ../frontend
   cp .env.example .env
   # Edit .env to point to your backend API
   npm install
   ```

### Authentication Setup

For detailed authentication setup instructions, see [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md).

### Running Locally

1. **Start the backend** (from `/backend` directory)
   ```bash
   flask run -p 5001
   ```

2. **Start the frontend** (from `/frontend` directory)
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`

## Deployment

### Render

This project is configured for deployment on [Render](https://render.com/). Follow these steps to deploy:

1. **Create a new Web Service** on Render and connect your GitHub/GitLab repository

2. **Configure the backend service**:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Environment Variables**:
     - `PYTHON_VERSION`: 3.9.0
     - `FLASK_APP`: app.py
     - `FLASK_ENV`: production
     - `DATABASE_URL`: Your PostgreSQL connection string
     - `SECRET_KEY`: Your secret key

3. **Configure the frontend service**:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Environment Variables**:
     - `VITE_API_URL`: Your backend service URL (e.g., `https://your-backend-service.onrender.com`)

4. **Set up a PostgreSQL database** on Render and connect it to your backend service

### Environment Variables

For local development, create a `.env` file in the backend directory with the following variables:

```
FLASK_APP=app.py
FLASK_ENV=development
DATABASE_URL=sqlite:///site.db
SECRET_KEY=your-secret-key
```

## License

MIT
