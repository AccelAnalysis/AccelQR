import os
from app import app
from models import QRCode, Scan  # Import models to ensure they're registered with SQLAlchemy
from extensions import db
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# This file is used as the entry point by gunicorn in production
# and by the development server in development

if __name__ == '__main__':
    # For local development
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
