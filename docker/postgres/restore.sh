#!/bin/bash
# RetireOps PostgreSQL Restore Script
# @see docs/source-of-truth/01-overview.md
#
# Usage: ./restore.sh <backup_file>
# Example: ./restore.sh ./backups/backup_20240101_120000.sql.gz
#
# WARNING: This will DROP and recreate the database!

set -e

# Configuration
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-retireops}"
DB_USER="${POSTGRES_USER:-retireops}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}RetireOps Database Restore${NC}"
echo "================================"

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: No backup file specified${NC}"
    echo ""
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -la ./backups/*.sql.gz 2>/dev/null || echo "  No backups found in ./backups/"
    exit 1
fi

BACKUP_FILE="$1"

# Handle 'latest' shortcut
if [ "$BACKUP_FILE" = "latest" ]; then
    BACKUP_FILE="./backups/latest.sql.gz"
fi

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

echo "Database: ${DB_NAME}"
echo "Host: ${DB_HOST}:${DB_PORT}"
echo "Backup file: ${BACKUP_FILE}"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql command not found${NC}"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Confirmation prompt
echo -e "${RED}WARNING: This will DROP all existing data in database '${DB_NAME}'!${NC}"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Disconnect all users from the database
echo ""
echo -e "${YELLOW}Disconnecting active connections...${NC}"
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
    > /dev/null 2>&1 || true

# Perform restore
echo -e "${YELLOW}Starting restore...${NC}"
echo "This may take a few minutes depending on the backup size..."

if gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --quiet \
    --set ON_ERROR_STOP=1; then

    echo ""
    echo -e "${GREEN}Restore completed successfully!${NC}"

    # Show table counts
    echo ""
    echo "Table row counts:"
    PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -c "SELECT schemaname, relname as table_name, n_live_tup as row_count
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
            LIMIT 10;"
else
    echo ""
    echo -e "${RED}Restore failed!${NC}"
    echo "Please check the backup file and try again."
    exit 1
fi

echo ""
echo -e "${GREEN}Restore process completed!${NC}"
