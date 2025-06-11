from werkzeug.security import generate_password_hash
import sqlite3

def update_password():
    # Connect to the SQLite database
    conn = sqlite3.connect('instance/qrcodes.db')
    cursor = conn.cursor()
    
    # Get the current password hash for the admin user
    cursor.execute("SELECT id, email, password_hash FROM users WHERE email = ?", ('admin@example.com',))
    user = cursor.fetchone()
    
    if user:
        user_id, email, current_hash = user
        print(f"Current user: {email} (ID: {user_id})")
        print(f"Current password hash: {current_hash}")
        
        # Generate a new password hash
        new_hash = generate_password_hash('admin')
        print(f"New password hash: {new_hash}")
        
        # Update the password hash in the database
        cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
        conn.commit()
        print("Password hash updated successfully")
    else:
        print("User not found")
    
    conn.close()

if __name__ == '__main__':
    update_password()
