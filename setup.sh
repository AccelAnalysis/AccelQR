#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up QR Code Tracker...${NC}\n"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Python 3 is required but not installed. Please install Python 3.9 or later.${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is required but not installed. Please install Node.js 16 or later.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}npm is required but not installed. Please install npm.${NC}"
    exit 1
fi

# Set up backend
echo -e "${GREEN}Setting up backend...${NC}"
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}Please edit the .env file with your configuration.${NC}"
    read -p "Press Enter to continue..."
fi

# Initialize database and create admin user
python create_admin.py

# Set up frontend
echo -e "\n${GREEN}Setting up frontend...${NC}"
cd ../frontend

# Install Node.js dependencies
npm install

# Set up frontend environment variables
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}Please edit the .env file to point to your backend API.${NC}"
    read -p "Press Enter to continue..."
fi

echo -e "\n${GREEN}Setup complete!${NC}"
echo -e "To start the application, run the following commands:"
echo -e "1. Backend: ${YELLOW}cd backend && source venv/bin/activate && flask run -p 5001${NC}"
echo -e "2. Frontend: ${YELLOW}cd frontend && npm run dev${NC}"
echo -e "\nOpen your browser to ${YELLOW}http://localhost:5173${NC} to access the application."

# Make the script executable
chmod +x setup.sh
