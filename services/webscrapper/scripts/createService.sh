#!/bin/bash

SERVICE_NAME="start-scraping.service"

# Move the service file to the system directory
sudo cp /home/ubuntu/summaryapp/services/webscrapper/scripts/$SERVICE_NAME /etc/systemd/system/

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable $SERVICE_NAME

# Start the service
sudo systemctl start $SERVICE_NAME

# Check the status of the service
sudo systemctl status $SERVICE_NAME

echo "Setup complete. You can check the logs using:"
echo "journalctl -u $SERVICE_NAME"
