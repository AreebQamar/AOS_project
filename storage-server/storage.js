const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require('fs');

const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const ourFileSystem = grpcObject.distributedFileSystemPackage;

const MASTER_PORT_BASE = 50052;
const SLAVE_PORT = 50051;



// Slave part (for chunk servers to register and store files)
function ping(call, callback) {
  const clientId = call.request.id;
  console.log(`Ping received from Master: ${clientId}`);
  callback(null, { message: `Pong from server to client ${clientId}` });
}

// function register(call, callback) {
//   const clientId = call.request.id;
//   console.log(`Register request from chunk server: ${clientId}`);
//   chunkServers[clientId] = {
//     client: new ourFileSystem.FileSystem(
//       `localhost:${SLAVE_PORT}`,
//       grpc.credentials.createInsecure()
//     ),
//     online: true
//   };
//   callback(null, { message: `Chunk server ${clientId} registered` });
// }

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


// Master part (for master server to listen for chunk server registrations and file requests)
function startMaster(port) {
  console.log("Opening port to listen master's requests.")
  const master = new grpc.Server();
  master.addService(ourFileSystem.FileSystem.service, {
    Ping: ping,
    StoreFile: storeFile
  });

  master.bindAsync(
    `localhost:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error(`Failed to bind server: ${error.message}`);
      } else {
        console.log(`Now listening for master requests at:${port}`);
        master.start();
      }
    }
  );
}

// function pingChunkServer(chunkServerId) {
//   const chunkServerClient = chunkServers[chunkServerId].client;
//   chunkServerClient.Ping({ id: chunkServerId }, (error, response) => {
//     if (error) {
//       console.error(`Error pinging chunk server ${chunkServerId}:`, error);
//       chunkServers[chunkServerId].online = false;
//     } else {
//       console.log(`Ping response from chunk server ${chunkServerId}:`, response.message);
//       chunkServers[chunkServerId].online = true;
//     }
//   });
// }

// function sendFileToChunkServer(chunkServerId, filename) {
//   const chunkServerClient = chunkServers[chunkServerId].client;
//   fs.readFile(filename, (err, data) => {
//     if (err) {
//       console.error(`Error reading file ${filename}:`, err);
//       return;
//     }

//     chunkServerClient.StoreFile({ client_id: chunkServerId, filename, content: data }, (error, response) => {
//       if (error) {
//         console.error(`Error sending file to chunk server ${chunkServerId}:`, error);
//       } else {
//         console.log(`File sent to chunk server ${chunkServerId}:`, response.message);
//       }
//     });
//   });
// }

// Initialize the chunk server as a slave and then register with the master
function initializeChunkServer(clientId) {
  const slave = new ourFileSystem.FileSystem(
    `localhost:${SLAVE_PORT}`,
    grpc.credentials.createInsecure()
  );

  console.log("sending Reister request.")
  slave.Register({ id: clientId }, (error, response) => {
    if (error) {
      console.error("Error: ", error);
      console.log("could not register. PLEASE RESTART!!\n")
    } else {
      console.log(response.message, "\n");
      startMaster(response.port); // Start the slave part after registration
    }
  });
}



const clientId = process.argv[2];
if (!clientId) {
  console.error("Usage: node script.js --chunkserver <client_id>");
  process.exit(1);
}
initializeChunkServer(clientId);

