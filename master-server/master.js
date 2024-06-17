const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const ourFileSystem = grpcObject.distributedFileSystemPackage;

const express = require('express');
const multer = require('multer');

const fs = require('fs');
const path = require('path');

const cors = require("cors");

const fieRetriever = require("./fileRetrieval.js");
const saveFileModule = require("./fileDistribution");


const MASTER_PORT = 50051;
const SLAVE_PORT_BASE = 50052;

let chunkServerCounter = 0;
const chunkServers = {}; // Store chunk server clients
const metadataFilePath = path.join(__dirname, 'metadata.json');



function register(call, callback) {
  const clientId = call.request.id;
  console.log(`Register request from chunk server: ${clientId}`);
  const chunkServerPort = Number(SLAVE_PORT_BASE) + Number(clientId) - 1;
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



const app = express();
app.use(cors({ origin: "http://localhost:3000" }));

const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const fileName = req.file.originalname;
  const fileBuffer = req.file.buffer;
  // console.log("\n\nFile Name: ", filename, "\nBuffer: ", fileBuffer);
  
  saveFileModule.saveFile(ourFileSystem, chunkServers, fileName, fileBuffer)
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

app.get('/getfile', async (req, res) => {
  const fileName = req.query.fileName;

  if (!fileName) {
    return res.status(400).send('Bad request. No file name provided.');
  }

  try {
    const combinedBuffer = await fieRetriever.getAllTheFileChunks(fileName, metadataFilePath, ourFileSystem, chunkServers);
    res.status(200).send(combinedBuffer);  // Send the combined buffer
  } catch (err) {
    res.status(500).send('Error processing file: ' + err.message);
  }
});


const ping = require("./ping.js");

app.get('/ping', async (req, res) => {

  await ping.checkAndUpdateChunkServerStatus(ourFileSystem, chunkServers);
  
  
  res.status(200).send(chunkServers); 
 
   

});


const HTTP_PORT = 4000; // port for client application.
app.listen(HTTP_PORT, () => {
  console.log(`Express server running on port ${HTTP_PORT}`);
});

startMaster();