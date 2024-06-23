const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const ourFileSystem = grpcObject.distributedFileSystemPackage;

const fs = require('fs');

const crypto = require('crypto');

const ping = require("./ping");
const savechunk = require("./saveChunk");
const sendChunk = require("./sendChunk");
const deleteChunk = require("./deleteChunk");

const SLAVE_PORT = 50051;
var Master_Port;

function startMaster(port) {
  const master = new grpc.Server();
  master.addService(ourFileSystem.FileSystem.service, {
    Ping: ping.ping,
    storeChunk: savechunk.storeChunk,
    requestChunk: sendChunk.requestChunk,
    deleteChunk: deleteChunk.deleteChunk
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
        exports.Master_Port = Master_Port; //to be use by other moduals.
        console.log(`Now listening for master requests at: ${port}\n`);
      }
    }
  );
}

function initializeChunkServer(clientId) {
  const slave = new ourFileSystem.FileSystem(
    `localhost:${SLAVE_PORT}`,
    grpc.credentials.createInsecure()
  );

  console.log("Sending Register request.");
  slave.Register({ id: clientId }, (error, response) => {
    if (error) {
      console.error("Error: ", error);
      console.log("Could not register. PLEASE RESTART!!\n");
    } else {
      console.log(response.message, "\n");
      startMaster(response.port);
    }
  });
}

const clientId = process.argv[2];
if (!clientId || !/^\d+$/.test(clientId) || Number(clientId) <= 0) {
  console.error("Usage: node storage.js <client_id> (client_id should be a number greater than 0)");
  process.exit(1);
}
initializeChunkServer(clientId);
