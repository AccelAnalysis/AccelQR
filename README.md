# QR Code Tracker

A full-stack application for generating and managing QR codes with analytics.

## Features

- Generate QR codes with custom data
- Organize QR codes in folders
- Track scans and view analytics
- Responsive web interface

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Chakra UI
- **Backend**: Python, Flask, SQLAlchemy
- **Database**: SQLite (development)

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- Python 3.9+
- npm or yarn

### Installation

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
   flask db upgrade
   ```

3. **Set up the frontend**
   ```bash
   cd ../frontend
   npm install
   ```

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
