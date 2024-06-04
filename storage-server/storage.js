const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const fs = require('fs');
const path = require('path');

const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const ourFileSystem = grpcObject.distributedFileSystemPackage;

const crypto = require('crypto');


const SLAVE_PORT = 50051;
var Master_Port;

function getChecksum(inputString) {
  const hash = crypto.createHash('sha256'); // Create a SHA-256 hash instance
  hash.update(inputString); // Update the hash with the input string
  const checksum = hash.digest('hex'); // Get the checksum as a hexadecimal string
  return checksum;
}

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

function storeChunk(call, callback) {
  const { clientId, metaData, data, checkSum } = call.request;
  console.log("Chunk received");

  //for testing error handling.
  // if(clientId == "2"){
  //     console.log("check Sum does not match!!")
  //     return callback(new Error("check Sum does not match!!"));
  // }
  if (checkSum == getChecksum(metaData + data)) {
    // console.log(`client: ${clientId}\n mataData: ${metaData}\nMy port: ${Master_Port}\n`);
    saveChunkLocally(metaData, clientId, data);

    callback(null, { message: "saved!" });

  }
  else {
    console.log("check Sum does not match!!")
    return callback(new Error("check Sum does not match!!"));
  }


  //   fs.writeFile(filename, content, (err) => {
  //     if (err) {
  //       console.error(`Error writing file ${filename}:`, err);
  //       callback(null, { message: `Error writing file: ${filename}` });
  //       return;
  //     }

  //     console.log(`File ${filename} received and written successfully`);
  //     callback(null, { message: `File ${filename} received and written successfully` });
  //   });

}
function saveChunkLocally(metaData, clientId, buffer){
  const fileName = `${metaData}_${clientId}`;
  console.log("fileName: ", fileName);
  
  const filePath = path.join(`${Master_Port}`, fileName);
  console.log("filePath: ", filePath);
  
  // Save the buffer to a file
  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error("Error writing file:", err);
    } else {
      console.log("File saved successfully!");
    }
  });

}

// Master part (for master server to listen for chunk server registrations and file requests)
function startMaster(port) {
  console.log("Opening port to listen master's requests.")
  const master = new grpc.Server();
  master.addService(ourFileSystem.FileSystem.service, {
    Ping: ping,
    storeChunk: storeChunk
  });

  master.bindAsync(
    `localhost:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error(`Failed to bind server: ${error.message}`);
      } else {

        var dir = `./${port}`;
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
        }
        Master_Port = port;
        console.log(`Now listening for master requests at:${port}\n`);

      }
    }
  );
}

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
  console.error("Usage: node storage.js <client_id>");
  process.exit(1);
}
initializeChunkServer(clientId);

