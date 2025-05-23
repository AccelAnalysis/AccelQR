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

### Frontend (Vercel)

1. Push your code to GitHub
2. Import the repository in Vercel
3. Set the environment variable:
   - `VITE_API_URL`: Your backend API URL

### Backend (Render/Railway)

1. Push your code to GitHub
2. Create a new web service
3. Set the environment variables:
   - `FLASK_APP=app.py`
   - `FLASK_ENV=production`
   - `DATABASE_URL`: Your production database URL

## License

MIT
