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
  const hash = crypto.createHash('sha256');
  hash.update(inputString);
  return hash.digest('hex');
}

function ping(call, callback) {
  const clientId = call.request.id;
  console.log(`Ping received from Master: ${clientId}`);
  callback(null, { message: `Pong from server to client ${clientId}` });
}

function storeChunk(call, callback) {
  const { clientId, metaData, data, checkSum } = call.request;
  console.log("Chunk received");

  if (checkSum == getChecksum(metaData + data.toString())) {
    saveChunkLocally(metaData, clientId, data);
    callback(null, { message: "saved!" });
  } else {
    console.log("check Sum does not match!!");
    return callback(new Error("check Sum does not match!!"));
  }
}

function saveChunkLocally(metaData, clientId, buffer) {
  const fileName = `${metaData}_${clientId-1}`;
  const filePath = path.join(`${Master_Port}`, fileName);
  
  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error("Error writing file:", err);
    } else {
      console.log("File saved successfully!");
    }
  });
}

function requestChunk(call, callback) {
  const fileName = call.request.fileName;
  const filePath = path.join(`${Master_Port}`, fileName);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return callback(err);
    }

    callback(null, { data });
  });
}

function startMaster(port) {
  const master = new grpc.Server();
  master.addService(ourFileSystem.FileSystem.service, {
    Ping: ping,
    storeChunk: storeChunk,
    requestChunk: requestChunk
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
if (!clientId) {
  console.error("Usage: node storage.js <client_id>");
  process.exit(1);
}
initializeChunkServer(clientId);
