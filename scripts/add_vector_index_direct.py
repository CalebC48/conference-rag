"""
Add Vector Index Directly to Database
======================================
Connects directly to the database to create the vector index,
bypassing the SQL Editor timeout.

Usage:
    python scripts/add_vector_index_direct.py
"""

import json
import sys
import os

# Try to import psycopg2
try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("Error: psycopg2 is required. Install it with:")
    print("  pip install psycopg2-binary")
    sys.exit(1)


def load_config():
    with open('config.public.json', 'r') as f:
        public_config = json.load(f)
    with open('config.secret.json', 'r') as f:
        secrets = json.load(f)
    return public_config, secrets


def get_connection_string(public_config, secrets):
    """Build PostgreSQL connection string from config"""
    supabase_url = public_config['SUPABASE_URL']
    # Extract project ref from URL (e.g., https://orxluewmoltsbkjgzflh.supabase.co)
    # The hostname is: orxluewmoltsbkjgzflh.supabase.co
    from urllib.parse import urlparse
    parsed = urlparse(supabase_url)
    hostname = parsed.hostname

    # Database connection details
    # Supabase uses connection pooling on port 6543 (not direct 5432)
    # For direct connections, we need to use the pooler port
    db_password = input("Enter your database password (from Supabase Dashboard -> Settings -> Database): ")

    # Use connection pooler port (6543) - this is the Transaction mode pooler
    # For Session mode, use port 5432, but Transaction mode (6543) is more common
    port = 6543

    # Use the pooler connection string format
    # Format: postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true
    conn_string = f"host={hostname} port={port} dbname=postgres user=postgres password={db_password} sslmode=require"

    print(f"\n   Using connection pooler on port {port}")
    print(f"   Host: {hostname}")

    return conn_string


def main():
    print("=" * 60)
    print("Adding Vector Index to Database")
    print("=" * 60)
    print()
    print("This script connects directly to your database to create")
    print("the vector index, bypassing the SQL Editor timeout.")
    print()

    public_config, secrets = load_config()

    # Get connection string
    try:
        conn_string = get_connection_string(public_config, secrets)
    except Exception as e:
        print(f"Error building connection string: {e}")
        sys.exit(1)

    # Connect to database
    print("Connecting to database...")
    try:
        conn = psycopg2.connect(conn_string)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        print("✅ Connected!")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print("\nMake sure:")
        print("  1. You have the correct database password")
        print("  2. Your IP is allowed (check Network Restrictions in Supabase)")
        print("  3. SSL is properly configured")
        sys.exit(1)

    # Check row count first
    print("\nChecking data...")
    try:
        cur.execute("SELECT COUNT(*) FROM sentence_embeddings WHERE embedding IS NOT NULL;")
        row_count = cur.fetchone()[0]
        print(f"   Found {row_count:,} rows with embeddings")

        if row_count == 0:
            print("   ⚠️  No rows with embeddings found. Make sure you've run:")
            print("      python scripts/05_update_embeddings.py")
            conn.close()
            sys.exit(1)
    except Exception as e:
        print(f"   ⚠️  Could not check row count: {e}")

    # Note: Connection poolers (pgBouncer) don't support some DDL operations
    # We need to check if we're using a pooler and warn the user
    print("\n⚠️  Note: Connection poolers may not support index creation.")
    print("   If this fails, you'll need to use a direct connection.")
    print("   Trying anyway...")

    # Create index
    print("\nCreating vector index...")
    print("   (This may take several minutes depending on data size)")
    print("   Using IVFFlat for faster index creation...")

    # Use IVFFlat which builds faster than HNSW
    # Calculate appropriate lists value (should be rows/1000, but at least 10)
    lists_value = max(10, min(100, row_count // 1000)) if row_count > 0 else 10

    index_sql = f"""
    CREATE INDEX IF NOT EXISTS sentence_embeddings_embedding_idx
    ON sentence_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = {lists_value});
    """

    try:
        cur.execute(index_sql)
        print("   ✅ Index creation started!")
        print("   (The index is being built in the background)")
        print("\n   You can check progress in Supabase Dashboard -> Database -> Indexes")
        print("   Once the index is built, semantic search should work without timeouts.")
    except Exception as e:
        error_msg = str(e)
        if "prepared statement" in error_msg.lower() or "transaction" in error_msg.lower():
            print(f"   ❌ Index creation failed: {e}")
            print("\n   This is likely because connection poolers don't support DDL operations.")
            print("   You need to use a DIRECT connection (not pooled).")
            print("\n   Try this instead:")
            print("   1. Go to Supabase Dashboard -> Settings -> Database")
            print("   2. Click 'Connect' button in the top bar")
            print("   3. Select 'Connection string' -> 'Direct connection'")
            print("   4. Use that connection string with psql or a database client")
            print("   5. Run the SQL from scripts/add_vector_index.sql")
        else:
            print(f"   ❌ Index creation failed: {e}")
        conn.close()
        sys.exit(1)

    conn.close()
    print("\n✅ Done! The index is being created.")
    print("   Try semantic search again in a few minutes.")


if __name__ == '__main__':
    main()
