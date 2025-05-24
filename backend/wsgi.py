import os
from .app import app, db

# Initialize the database
with app.app_context():
    db.create_all()

# This file is used as the entry point by gunicorn in production
# and by the development server in development
