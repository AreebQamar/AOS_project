const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const ourFileSystem = grpcObject.distributedFileSystemPackage;

const MASTER_PORT = 50051;
const SLAVE_PORT_BASE = 50052;

let chunkServerCounter = 0;
const chunkServers = {}; // Store chunk server clients
const metadataFilePath = path.join(__dirname, 'metadata.json');

function getChecksum(inputString) {
  const hash = crypto.createHash('sha256'); // Create a SHA-256 hash instance
  hash.update(inputString); // Update the hash with the input string
  const checksum = hash.digest('hex'); // Get the checksum as a hexadecimal string
  return checksum;
}

function register(call, callback) {
  const clientId = call.request.id;
  console.log(`Register request from chunk server: ${clientId}`);
  const chunkServerPort = SLAVE_PORT_BASE + chunkServerCounter++;
  chunkServers[clientId] = { id: clientId, port: chunkServerPort };
  console.log(`Chunk Server ${clientId} registered.\n`);
  callback(null, { message: `Chunk server ${clientId} registered`, port: chunkServerPort });
}

function startMaster() {
  const server = new grpc.Server();
  server.addService(ourFileSystem.FileSystem.service, {
    Register: register,
  });

  server.bindAsync(
    `localhost:${MASTER_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error(`Failed to bind server: ${error.message}\n`);
      } else {
        console.log(`Master server running at localhost:${port}\n`);
      }
    }
  );
}

function markChunkServerOffline(chunkServerId) {
  if (chunkServers[chunkServerId]) {
    delete chunkServers[chunkServerId];
  }
}

function pingChunkServer(chunkServerId) {
  return new Promise((resolve, reject) => {
    const slave = new ourFileSystem.FileSystem(
      `localhost:${chunkServers[chunkServerId].port}`,
      grpc.credentials.createInsecure()
    );

    console.log(`sending ping to chunkServer: ${chunkServerId}`);
    slave.Ping({ id: chunkServers[chunkServerId].id }, (error, response) => {
      if (error) {
        console.error("Error pinging chunk server, marking it offline:", error);
        markChunkServerOffline(chunkServerId);
        resolve(null); // resolve with null to indicate failure, but don't reject
      } else {
        console.log("response: ", response.message, "\n");
        resolve(response);
      }
    });
  });
}

async function checkAndUpdateChunkServerStatus() {
  const pingPromises = [];

  for (const chunkServerId in chunkServers) {
    pingPromises.push(pingChunkServer(chunkServerId));
  }

  await Promise.all(pingPromises);
  console.log('All chunk servers have been pinged.');
}

function createFileChunks(fileData, n) {
  const chunks = [];
  const chunkSize = Math.ceil(fileData.length / n);

  for (let i = 0; i < n; i++) {
    const chunk = fileData.slice(i * chunkSize, (i + 1) * chunkSize);
    chunks.push(chunk);
  }
  return chunks;
}

function saveFile(fileName, fileBuffer) {
  
  const masterMetaData = {
    fileName,
    chunkIDs:[],
    chunks:{}
  };

  return new Promise(async (resolve, reject) => {
    try {
      await checkAndUpdateChunkServerStatus();

      const numberOfAvailableServers = Object.keys(chunkServers).length;
      if(numberOfAvailableServers < 1)
      {
        reject(new Error("No chunk Server Available."));
      }
      const chunks = createFileChunks(fileBuffer, numberOfAvailableServers);

      console.log("chunks of the file: \n");

      const chunkPromises = Object.keys(chunkServers).map(chunkServerId => {

        const chunkId = chunkServerId - 1;
        masterMetaData.chunkIDs.push(chunkId);
        masterMetaData.chunks[chunkId] = {chunkServerId, chunkPort: chunkServers[chunkServerId].port};
        
        return sendFileToChunkServer(chunkServerId, fileName, chunks[chunkServerId - 1]);
      
      });

      await Promise.all(chunkPromises);

      saveMetadata(masterMetaData)
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function sendFileToChunkServer(chunkServerId, fileName, chunk) {
  return new Promise((resolve, reject) => {
    console.log(`\nid: ${chunkServerId}, port: ${chunkServers[chunkServerId].port}`);
    console.log("fileName :", fileName);
    console.log("chunk: ", chunk, "\n");
    
    const slave = new ourFileSystem.FileSystem(
      `localhost:${chunkServers[chunkServerId].port}`,
      grpc.credentials.createInsecure()
    );
    
    const checkSum = getChecksum(fileName + chunk);
    slave.storeChunk({ clientId: chunkServerId, metaData:fileName, data: chunk, checkSum }, (error, response) => {
      if (error) {
        console.error(`Error sending chunk to ${chunkServerId}:`, error);
        return reject(error);
      } else {
        console.log(response);
        resolve(response);
      }
    });
  });
}

function saveMetadata(metaData) {
  const metadataFilePath = path.join(__dirname, 'metadata.json');

  // console.log("\n\n meta data: ",metaData,"\n\n");
  
  fs.open(metadataFilePath, 'a+', (err, fd) => {
    if (err) {
      console.error('Error opening metadata file:', err);
      return;
    }
    
    fs.readFile(fd, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading metadata file:', err);
        return;
      }

      let newEntry = JSON.stringify(metaData, null, 2);

      if (data.length === 0) {
        // New file, start the JSON array
        newEntry = `[${newEntry}]`;
      }
      else {
        // Existing file, remove the last `]` to append new entry
        const trimmedData = data.trim();
        if (trimmedData.endsWith(']')) {
          const updatedData = trimmedData.slice(0, -1);
          newEntry = `,${newEntry}]`;
          newEntry = updatedData + newEntry;
        }
        else {
          console.error('Invalid JSON structure in metadata file');
          return;
        }
      }

      fs.writeFile(metadataFilePath, newEntry, 'utf8', (err) => {
        if (err) {
          console.error('Error writing metadata file:', err);
        }
        else {
          console.log('Metadata updated successfully');
        }
      });
    });
  });
}

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const fileName = req.file.originalname;
  const fileBuffer = req.file.buffer;
  // console.log("\n\nFile Name: ", filename, "\nBuffer: ", fileBuffer);

  saveFile(fileName, fileBuffer)
    .then(() => {
      res.status(200).send('File uploaded successfully');
    })
    .catch((err) => {
      res.status(500).send('Error processing file: ' + err.message);
    });
});

app.get('/filenames', (req, res) => {
  fs.readFile(metadataFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading metadata file:', err);
      return res.status(500).send('Error reading metadata file');
    }

    try {
      // Parse the JSON data
      const metadata = JSON.parse(data);

      // Extract the file names from the metadata
      const fileNames = metadata.map(entry => entry.fileName);

      // Send the list of file names as a JSON response
      res.json({ files: fileNames });
    } catch (parseError) {
      console.error('Error parsing metadata file:', parseError);
      res.status(500).send('Error parsing metadata file');
    }
  });
});

const HTTP_PORT = 4000; // port for client application.
app.listen(HTTP_PORT, () => {
  console.log(`Express server running on port ${HTTP_PORT}`);
});

startMaster();



// Combine the parts back together
        // const combinedData = Buffer.concat([part1, part2, part3]);

        // // Log the combined data
        // console.log('\nCombined Data:');
        // console.log(combinedData);

        // // Optionally, you can also write the combined data back to a file to verify it
        // fs.writeFile(path.join(__dirname, 'combined_example.png'), combinedData, (err) => {
        //   if (err) {
        //     console.error(`Error writing combined file: ${err}`);
        //     reject(err);
        //   } else {
        //     console.log('Combined data written to combined_example.txt');
        //     resolve();
        //   }
        // });