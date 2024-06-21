# Project Setup Guide

This guide provides instructions for setting up and running the master server and multiple storage servers for the project.

## Prerequisites

- Ensure you have the latest version of Node.js installed on your machine. You can download it from the [Node.js official website](https://nodejs.org/).

## Installation Steps

1. **Install Dependencies**:
    - Open a terminal in the base directory of the project.
    - Run the following command to install all necessary dependencies:
      ```bash
      npm install
      ```

2. **Start the Master Server**:
    - In the terminal, navigate to the `master-server` directory:
      ```bash
      cd master-server
      ```
    - Run the following command to execute the master server:
      ```bash
      node master
      ```

3. **Start Storage Servers**:
    - Open multiple terminals to run multiple storage servers.
    - In each terminal, navigate to the `storage-server` directory:
      ```bash
      cd storage-server
      ```
    - In each terminal, run the following command to start a storage server, replacing `<client_ID>` with a unique client ID of your choice:
      ```bash
      node storage <client_ID>
      ```

## Expected Behavior

- All storage servers should start sending pings to the master server.
- The master server should respond to the pings from each storage server.

This setup will help you test and run the master-server and storage-server interactions as intended.

## Repository Structure

- `master-server/`: Contains the master server code.
- `storage-server/`: Contains the storage server code.

## HTTP APIs

The master server exposes several HTTP endpoints for interacting with the file system. The server runs on port 4000.

### Upload File API

- **Endpoint**: `/upload`
- **Method**: `POST`
- **Description**: Uploads a file to the system.
- **Request**: Form-data containing the file.
- **Response**: 
  - `200 OK`: File uploaded successfully.
  - `400 Bad Request`: No file uploaded.
  - `500 Internal Server Error`: Error processing the file.

```bash
curl -X POST -F "file=@/path/to/your/file" http://localhost:4000/upload
```

### List Filenames API

- **Endpoint**: `/filenames`
- **Method**: `GET`
- **Description**:  Retrieves a list of all filenames in the system.
- **Response**: 
  - `200 OK`: JSON object containing the list of file names.
  - `500 Internal Server Error`: Error reading or parsing the metadata file.

```bash
curl -X POST -F "file=@/path/to/your/file" http://localhost:4000/filenames
```

### Get File API

- **Endpoint**: `/getfile`
- **Method**: `GET`
- **Description**:  Retrieves a file by name.
- **Request**: Query parameter `fileName` specifying the name of the file.
- **Response**: 
  - `200 OK`: The file content.
  - `400 Bad Request`: No file name provided.
  - `500 Internal Server Error`: Error processing the file.

```bash
curl -X POST -F "file=@/path/to/your/file" http://localhost:4000/getfile?fileName=example.txt
```

### Delete File API

- **Endpoint**: `/deletefile`
- **Method**: `DELETE`
- **Description**:  Deletes a file by name.
- **Request**: Query parameter `fileName` specifying the name of the file.
- **Response**: 
  - `200 OK`: File deleted successfully.
  - `400 Bad Request`: No file name provided.
  - `500 Internal Server Error`: Error deleting the file.

```bash
curl -X POST -F "file=@/path/to/your/file" http://localhost:4000/deleteFile?fileName=example.txt
```

### Ping API

- **Endpoint**: `/ping`
- **Method**: `GET`
- **Description**:  Checks the status of chunk servers and updates their status.
- **Response**: 
  - `200 OK`: JSON object containing the status of chunk servers.

```bash
curl -X POST -F "file=@/path/to/your/file" http://localhost:4000/ping
```