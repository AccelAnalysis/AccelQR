#!/bin/bash

# Get the full path to the Python interpreter and script
PYTHON_PATH=$(which python3)
SCRIPT_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/update_geolite.py"
LOG_PATH="$SCRIPT_PATH/../logs/geolite_update.log"

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$LOG_PATH")"

# Add the cron job
(crontab -l 2>/dev/null; echo "0 0 1 * * cd $SCRIPT_PATH && $PYTHON_PATH $SCRIPT_PATH >> $LOG_PATH 2>&1") | crontab -

echo "Cron job has been set up to run update_geolite.py on the 1st of every month"
echo "Logs will be written to: $LOG_PATH"
echo "Current crontab:"
crontab -l
