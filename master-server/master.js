const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");


const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const ourFileSystem = grpcObject.distributedFileSystemPackage;

const MASTER_PORT = 50051;
const SLAVE_PORT_BASE = 50052;

let chunkServerCounter = 0;
const chunkServers = {}; // Store chunk server clients

const fs = require('fs');
const path = require('path');

const express = require('express');
const multer = require('multer');

//Master part of the master server, this acts as a master in the system.
//1. wait for the register request from the chunk server's slave part.
//2. upon receiving the register request, is saves the client id.
//3. this information will be used by the slave part of the master server.
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
        server.start();
      }
    }
  );

  // saveFile("abd")
  // setInterval(() => {
  //   checkAndUpdateChunkServerStatus();
    
  // }, 5000);

}

function checkAndUpdateChunkServerStatus(){
 
  for (const chunkServerId in chunkServers) {
    pingChunkServer(chunkServerId);
    // console.log(chunkServerId.id, chunkServerId.port);
  }
}
function markChunkServerOffline(chunkServerId){
  if (chunkServers[chunkServerId]) {
    delete chunkServers[chunkServerId];
  }
}
function pingChunkServer(chunkServerId) {

  const slave = new ourFileSystem.FileSystem(
    `localhost:${chunkServers[chunkServerId].port}`,
    grpc.credentials.createInsecure()
  );

  console.log(`sending ping to chunkServer: ${chunkServerId}`);
  slave.Ping({ id: chunkServers[chunkServerId].id}, (error, response) => {
    if (error) {
      console.error("Error \nMarking it offine.");
      markChunkServerOffline(chunkServerId);
    } else {
      console.log("response: ", response.message, "\n");
    }
  });
}

// Slave part (for chunk servers to register and store files)
function storeFile(call, callback) {
  const { client_id, filename, content } = call.request;
  console.log(`Received file for client: ${client_id}, filename: ${filename}`);

  fs.writeFile(filename, content, (err) => {
    if (err) {
      console.error(`Error writing file ${filename}:`, err);
      callback(null, { message: `Error writing file: ${filename}` });
      return;
    }

    console.log(`File ${filename} received and written successfully`);
    callback(null, { message: `File ${filename} received and written successfully` });
  });
}

function createFileChunks(fileData, n){
  const chunks = [];

  const chunkSize = Math.ceil(fileData.length / n);

  for(var i = 0; i < n+1; i++){
    const chunk = fileData.slice(i*chunkSize, (i+1)*chunkSize);
    chunks.push(chunk);
  }
  return chunks;
}

function saveFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error(`Error processing file: ${err}\n`);
        reject(err);
      } else {
        const chunks = createFileChunks(data, 3);
        const part1 = chunks[0];
        const part2 = chunks[1];
        const part3 = chunks[2];

        // Log each part separately
        console.log('Part 1:');
        console.log(part1);

        console.log('Part 2:');
        console.log(part2);

        console.log('Part 3:');
        console.log(part3);

        // Combine the parts back together
        const combinedData = Buffer.concat([part1, part2, part3]);

        // Log the combined data
        console.log('\nCombined Data:');
        console.log(combinedData);

        // Optionally, you can also write the combined data back to a file to verify it
        fs.writeFile(path.join(__dirname, 'combined_example.png'), combinedData, (err) => {
          if (err) {
            console.error(`Error writing combined file: ${err}`);
            reject(err);
          } else {
            console.log('Combined data written to combined_example.txt');
            resolve();
          }
        });
      }
    });
  });


  //checkAndUpdateChunkServerStatus();
  //const numberOfAvailableServers = Object.keys(chunkServers).length;



}
function sendFileToChunkServer(chunkServerId, filename) {
  const chunkServerClient = chunkServers[chunkServerId].client;
  fs.readFile(filename, (err, data) => {
    if (err) {
      console.error(`Error reading file ${filename}:`, err);
      return;
    }

    chunkServerClient.StoreFile({ client_id: chunkServerId, filename, content: data }, (error, response) => {
      if (error) {
        console.error(`Error sending file to chunk server ${chunkServerId}:`, error);
      } else {
        console.log(`File sent to chunk server ${chunkServerId}:`, response.message);
      }
    });
  });
}


// Start the master and chunk server processes

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const filePath = path.join(__dirname, req.file.path);
  const filename = req.file.originalname;


  saveFile(filePath)
  .then(() => {
    res.status(200).send('File uploaded successfully');
  })
  .catch((err) => {
    res.status(500).send('Error processing file: ' + err.message);
  });


  // fs.readFile(filePath, (err, data) => {
  //   if (err) {
  //     console.error(`Error reading file from disk: ${err}`);
  //     return res.status(500).send('Error reading file from disk.');
  //   }

  //   // Use gRPC client to send the file to the master server
  //   const client = new ourFileSystem.FileSystem(
  //     `localhost:${MASTER_PORT}`,
  //     grpc.credentials.createInsecure()
  //   );

  //   client.UploadFile({ filename, content: data }, (error, response) => {
  //     if (error) {
  //       console.error(`Error uploading file: ${error}`);
  //       return res.status(500).send('Error uploading file to master server.');
  //     } else {
  //       console.log(`Response from server: ${response.message}`);
  //       return res.status(200).send(`File uploaded successfully: ${response.message}`);
  //     }
  //   });
  // });


});
app.get('/', (req, res) => {
  res.send('Server is running');
});
const HTTP_PORT = 4000; // port for client application.
app.listen(HTTP_PORT, () => {
  console.log(`Express server running on port ${HTTP_PORT}`);
});

startMaster();


