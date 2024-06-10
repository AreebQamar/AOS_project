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
const ping = require("./ping.js");


const saveFileModule = require("./fileDistribution");

const MASTER_PORT = 50051;
const SLAVE_PORT_BASE = 50052;

let chunkServerCounter = 0;
const chunkServers = {}; // Store chunk server clients
const metadataFilePath = path.join(__dirname, 'metadata.json');



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



function getAllTheFileChunks(fileName) {
  return new Promise(async (resolve, reject) => {
    try {
      // Read metadata file
      const data = await fs.promises.readFile(metadataFilePath, 'utf8');
      const masterMetadata = JSON.parse(data);

      // Filter metadata for specific file
      const metaData = masterMetadata.find((element) => element.fileName === fileName);
      if (!metaData) {
        throw new Error(`File "${fileName}" not found in metadata.`);
      }

      const chunkPromises = metaData.chunkIDs.map((chunkId) => {
        return new Promise((chunkResolve, chunkReject) => {
          const port = metaData.chunks[chunkId][Number(chunkId)].chunkPort;
          const slave = new ourFileSystem.FileSystem(
            `localhost:${port}`,
            grpc.credentials.createInsecure()
          );
          const reqFileName = `${fileName}_${chunkId}`;

          console.log("port:", port, "filename:", reqFileName);

          slave.requestChunk({ fileName: reqFileName }, (error, response) => {
            if (error) {
              console.error(`Error receiving chunk: ${chunkId} from: ${metaData.chunks[chunkId].chunkServerId}, Error:`, error);
              chunkReject(error);
            } else {
              chunkResolve(response.data);
            }
          });
        });
      });

      const chunks = await Promise.all(chunkPromises);
      const combinedBuffer = Buffer.concat(chunks);
      resolve(combinedBuffer);

    } catch (err) {
      console.error('Error processing file:', err);
      reject(err);
    }
  });
}


// async function getAllTheFileChunks(fileName) {
//   // Assume the chunk server statuses are updated correctly
//   await ping.checkAndUpdateChunkServerStatus(ourFileSystem, chunkServers);

//   return new Promise(async (resolve, reject) => {
//     try {
//       // Read metadata file
//       const data = await fs.promises.readFile(metadataFilePath, 'utf8');
//       const masterMetadata = JSON.parse(data);
//       console.log("Master Metadata:", masterMetadata);

//       // Filter metadata for specific file
//       const metaData = masterMetadata.find((element) => element.fileName === fileName);
//       if (!metaData) {
//         throw new Error(`File "${fileName}" not found in metadata.`);
//       }
//       console.log("Metadata for file:", fileName, metaData);

//       // Create chunk requests based on metadata and chunk server statuses
//       const chunkRequests = {};
//       for (const chunkId of metaData.chunkIDs) {
//         for (const chunkServer of metaData.chunks[chunkId]) {
//           if (chunkServers[chunkServer.chunkServerId] && chunkServers[chunkServer.chunkServerId].online) {
//             if (!chunkRequests[chunkServer.chunkServerId]) {
//               chunkRequests[chunkServer.chunkServerId] = [];
//             }
//             chunkRequests[chunkServer.chunkServerId].push(chunkId);
//             break; // Move to the next chunkId once an online server is found
//           }
//         }
//       }

//       console.log("Chunk Requests:", chunkRequests);

//       // Request chunks from the appropriate chunk servers
//       const chunkPromises = Object.entries(chunkRequests).map(([serverId, chunkIds]) => {
//         return new Promise((chunkResolve, chunkReject) => {
//           const port = chunkServers[serverId].port;
//           const slave = new ourFileSystem.FileSystem(
//             `localhost:${port}`,
//             grpc.credentials.createInsecure()
//           );

//           Promise.all(chunkIds.map(chunkId => {
//             const reqFileName = `${fileName}_${chunkId}`;
//             return new Promise((resolve, reject) => {
//               console.log("Requesting chunk:", reqFileName, "from server:", serverId, "port:", port);
//               slave.requestChunk({ fileName: reqFileName }, (error, response) => {
//                 if (error) {
//                   console.error(`Error receiving chunk: ${chunkId} from server: ${serverId}, Error:`, error);
//                   reject(error);
//                 } else {
//                   console.log("Received data for chunk:", chunkId, "from server:", serverId);
//                   resolve(response.data);
//                 }
//               });
//             });
//           })).then(chunks => {
//             chunkResolve(chunks);
//           }).catch(chunkReject);
//         });
//       });

//       const chunks = (await Promise.all(chunkPromises)).flat();
//       console.log("All chunks received, concatenating...");
//       const combinedBuffer = Buffer.concat(chunks);
//       resolve(combinedBuffer);

//     } catch (err) {
//       console.error('Error processing file:', err);
//       reject(err);
//     }
//   });
// }







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
    const combinedBuffer = await getAllTheFileChunks(fileName);
    res.status(200).send(combinedBuffer);  // Send the combined buffer
  } catch (err) {
    res.status(500).send('Error processing file: ' + err.message);
  }
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