Project Setup Guide
This guide provides instructions for setting up and running the master server and multiple storage servers for the project.

Prerequisites
Ensure you have the latest version of Node.js installed on your machine. You can download it from the Node.js official website.

1. Installation Steps
Install Dependencies:

2. Open a terminal in the base directory of the project.
Run the following command to install all necessary dependencies:
   
npm install
Start the Master Server:

3. In the terminal, navigate to the master-server directory:

cd master-server
Run the following command to execute the master server:

node server.js
Start Storage Servers:

4. Open multiple terminals to run multiple storage servers.
In each terminal, navigate to the storage-server directory:

cd storage-server

In each terminal, run the following command to start a storage server, replacing <client_ID> with a unique client ID of your choice:

node storage.js <client_ID>

Expected Behavior
All storage servers should start sending pings to the master server.
The master server should respond to the pings from each storage server.
This setup will help you test and run the master-server and storage-server interactions as intended.

Repository Structure
master-server/: Contains the master server code.
storage-server/: Contains the storage server code.
