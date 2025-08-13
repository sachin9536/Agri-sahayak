import sqlite3
from datetime import datetime
from typing import Optional, List, Dict, Any
import uuid
import bcrypt
from pathlib import Path


def get_db_connection():
    # Anchor the DB file to the backend directory to avoid path confusion
    db_path = Path(__file__).resolve().parent / "documents.db"
    connection = sqlite3.connect(str(db_path))
    connection.row_factory = sqlite3.Row
    # Ensure foreign key constraints are enforced for every connection
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


# Initialize the database tables if they don't exist
with get_db_connection() as conn:
    cursor = conn.cursor()

    # Create users table (new)
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            district TEXT,
            crop TEXT,
            state TEXT,
            email TEXT UNIQUE,
            password_hash TEXT
        )
        """
    )

    # Ensure 'state' column exists for legacy DBs
    cursor.execute("PRAGMA table_info(users)")
    user_cols = [row[1] for row in cursor.fetchall()]
    if "state" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN state TEXT")
    if "email" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN email TEXT")
    if "password_hash" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")

    # Ensure unique index on email (if provided)
    cursor.execute("PRAGMA index_list(users)")
    existing_indexes = [row[1] for row in cursor.fetchall()]  # row[1] is index name
    if "idx_users_email_unique" not in existing_indexes:
        # Partial unique index so multiple NULL emails are allowed
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL"
        )

    # Ensure conversations table matches the new schema (with user_id)
    cursor.execute("PRAGMA table_info(conversations)")
    existing_columns = [row[1] for row in cursor.fetchall()]

    needs_recreate = (
        ("user_id" not in existing_columns) or
        ("pdf_id" in existing_columns)
    )

    if needs_recreate:
        # Rename old table if it exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'")
        if cursor.fetchone():
            cursor.execute("ALTER TABLE conversations RENAME TO conversations_legacy")

        # Create new conversations table with user_id and FK
        cursor.execute(
            """
            CREATE TABLE conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

        # Drop legacy table if present (no automatic data migration possible)
        cursor.execute("DROP TABLE IF EXISTS conversations_legacy")

    # Ensure conversation_id column exists
    cursor.execute("PRAGMA table_info(conversations)")
    conv_cols = [row[1] for row in cursor.fetchall()]
    if "conversation_id" not in conv_cols:
        cursor.execute("ALTER TABLE conversations ADD COLUMN conversation_id TEXT")

    conn.commit()


def insert_conversation(user_id: str, question: str, answer: Optional[str], conversation_id: Optional[str] = None):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO conversations (user_id, question, answer, timestamp, conversation_id) VALUES (?, ?, ?, ?, ?)",
            (user_id, question, answer, datetime.now(), conversation_id),
        )
        conn.commit()


def fetch_conversations(user_id: str) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT question, answer, timestamp FROM conversations WHERE user_id = ? ORDER BY timestamp",
            (user_id,),
        )
        return [dict(row) for row in cursor.fetchall()]


def fetch_user_conversation_summaries(user_id: str) -> List[Dict[str, Any]]:
    """Return list of {conversation_id, title (first question), first_timestamp} for a user."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT c.conversation_id, c.question AS title, c.timestamp AS first_timestamp
            FROM conversations c
            JOIN (
                SELECT conversation_id, MIN(timestamp) AS first_ts
                FROM conversations
                WHERE user_id = ? AND conversation_id IS NOT NULL
                GROUP BY conversation_id
            ) t
            ON c.conversation_id = t.conversation_id AND c.timestamp = t.first_ts
            ORDER BY first_timestamp DESC
            """,
            (user_id,),
        )
        return [dict(row) for row in cursor.fetchall()]


def fetch_conversation_by_id(conversation_id: str) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT user_id, question, answer, timestamp FROM conversations WHERE conversation_id = ? ORDER BY timestamp",
            (conversation_id,),
        )
        return [dict(row) for row in cursor.fetchall()]

def insert_user(
    name: str,
    district: Optional[str] = None,
    crop: Optional[str] = None,
    state: Optional[str] = None,
    email: Optional[str] = None,
    password_hash: Optional[str] = None,
    user_id: Optional[str] = None,
) -> str:
    """Create a new user row. If user_id is not provided, generate a UUID."""
    new_user_id = user_id or str(uuid.uuid4())
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (id, name, district, crop, state, email, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (new_user_id, name, district, crop, state, email, password_hash),
        )
        conn.commit()
    return new_user_id


def fetch_users() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, district, crop, state, email FROM users ORDER BY name")
        return [dict(row) for row in cursor.fetchall()]


def fetch_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, district, crop, state, email FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def fetch_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, district, crop, state, email, password_hash FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        return dict(row) if row else None


def hash_password(plain_password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False
