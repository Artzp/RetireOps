#!/bin/bash
# RetireOps PostgreSQL Backup Script
# @see docs/source-of-truth/01-overview.md
#
# Usage: ./backup.sh [backup_name]
# Example: ./backup.sh my_backup
#
# Backups are stored in ./backups directory with timestamp

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-retireops}"
DB_USER="${POSTGRES_USER:-retireops}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Generate backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="${1:-backup}_${TIMESTAMP}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql.gz"

echo -e "${GREEN}RetireOps Database Backup${NC}"
echo "================================"
echo "Database: ${DB_NAME}"
echo "Host: ${DB_HOST}:${DB_PORT}"
echo "Backup file: ${BACKUP_FILE}"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}Error: pg_dump command not found${NC}"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Perform backup
echo -e "${YELLOW}Starting backup...${NC}"

if PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    | gzip > "${BACKUP_FILE}"; then

    # Get backup size
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

    echo -e "${GREEN}Backup completed successfully!${NC}"
    echo "File: ${BACKUP_FILE}"
    echo "Size: ${BACKUP_SIZE}"

    # Create a symlink to the latest backup
    ln -sf "${BACKUP_NAME}.sql.gz" "${BACKUP_DIR}/latest.sql.gz"
    echo "Latest symlink updated"
else
    echo -e "${RED}Backup failed!${NC}"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# Cleanup old backups
echo ""
echo -e "${YELLOW}Cleaning up old backups (older than ${RETENTION_DAYS} days)...${NC}"
find "${BACKUP_DIR}" -name "*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
REMAINING=$(ls -1 "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | wc -l)
echo "Remaining backups: ${REMAINING}"

echo ""
echo -e "${GREEN}Backup process completed!${NC}"
