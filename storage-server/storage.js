const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require('fs');
const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const ourFileSystem = grpcObject.distributedFileSystemPackage;

// Read client ID from command-line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: node chunkServer.js <client_id>");
  process.exit(1);
}
const clientId = args[0];

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

function main() {
  const server = new grpc.Server();
  server.addService(ourFileSystem.fileSystem.service, {
    StoreFile: storeFile
  });

  const serverAddress = "localhost:50052"; // Each chunk server runs on a different port

  server.bindAsync(serverAddress, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      console.error(`Failed to bind server: ${error.message}`);
    } else {
      console.log(`Chunk server running at ${serverAddress}`);
      // server.start(); // Deprecation warning suggests it's no longer necessary
    }
  });
}

main();
