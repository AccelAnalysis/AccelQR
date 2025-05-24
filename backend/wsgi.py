import os
from app import app, db, QRCode, Scan  # Import models to ensure they're registered with SQLAlchemy
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_database():
    with app.app_context():
        try:
            # Check if the database exists and is accessible
            logger.info("Initializing database...")
            
            # Create all database tables
            logger.info("Creating database tables...")
            db.create_all()
            logger.info("Database tables created successfully")
            
            # Verify tables were created
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            logger.info(f"Available tables: {tables}")
            
            if not tables:
                logger.warning("No tables were created!")
            
        except Exception as e:
            logger.error(f"Error initializing database: {str(e)}", exc_info=True)
            raise

# Initialize the database when this module is imported
init_database()

# This file is used as the entry point by gunicorn in production
# and by the development server in development

if __name__ == '__main__':
    # For local development
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
