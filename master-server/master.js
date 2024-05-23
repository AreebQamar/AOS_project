const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require('fs');
const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const ourFileSystem = grpcObject.distributedFileSystemPackage;

const chunkServers = {}; // Store chunk server clients

function ping(call, callback) {
  const clientId = call.request.id;
  console.log(`Ping received from client: ${clientId}`);
  callback(null, { message: `Pong from server to client ${clientId}` });
}

function pingAll(call) {
  call.on('data', (clientIdentity) => {
    const clientId = clientIdentity.id;
    console.log(`Received PingAll from client: ${clientId}`);
    call.write({ message: `Pong to client ${clientId}` });
  });

  call.on('end', () => {
    console.log('PingAll stream ended');
    call.end();
  });
}

function registerChunkServer(chunkServerId, client) {
  chunkServers[chunkServerId] = client;
  console.log(`Chunk server ${chunkServerId} registered`);
}

function sendFileToChunkServer(chunkServerId, filename) {
  const chunkServerClient = chunkServers[chunkServerId];
  if (!chunkServerClient) {
    console.error(`Chunk server ${chunkServerId} is not registered`);
    return;
  }

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

function main() {
  const server = new grpc.Server();
  server.addService(ourFileSystem.fileSystem.service, {
    Ping: ping,
    PingAll: pingAll
  });

  const serverAddress = "localhost:50051";
  server.bindAsync(serverAddress, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      console.error(`Failed to bind server: ${error.message}`);
    } else {
      console.log(`Server running at ${serverAddress}`);
      // server.start(); // Deprecation warning suggests it's no longer necessary

      // Register a chunk server client
      const chunkServerClient = new ourFileSystem.fileSystem(
        "localhost:50052",
        grpc.credentials.createInsecure()
      );
      registerChunkServer("chunk1", chunkServerClient);

      // Hardcode the file to be sent
      const filename = "example.txt";
      sendFileToChunkServer("chunk1", filename);
    }
  });
}

main();
