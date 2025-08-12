#!/usr/bin/env bash
# create-archive.sh - Create a tarball respecting .gitignore

set -euo pipefail

# Get repo name and timestamp
REPO_NAME=$(basename "$(pwd)")
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
ARCHIVE_NAME="${REPO_NAME}-${TIMESTAMP}.tar.gz"

# Ensure we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Get git info
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)

echo "Creating archive..."
echo "Repository: $REPO_NAME"
echo "Branch: $BRANCH"
echo "Commit: $COMMIT"
echo "Archive: $ARCHIVE_NAME"

# Create archive using git archive (respects .gitignore)
git archive \
    --format=tar.gz \
    --prefix="${REPO_NAME}/" \
    --output="${ARCHIVE_NAME}" \
    HEAD

# Verify and show info
if [ -f "$ARCHIVE_NAME" ]; then
    SIZE=$(ls -lh "$ARCHIVE_NAME" | awk '{print $5}')
    echo "✓ Archive created: $ARCHIVE_NAME ($SIZE)"
    echo "Total files: $(tar -tzf "$ARCHIVE_NAME" | wc -l)"
else
    echo "Error: Failed to create archive"
    exit 1
fi