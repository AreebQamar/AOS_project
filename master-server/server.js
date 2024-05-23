const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const ourFileSystem = grpcObject.distributedFileSyatemPackage;

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

function main() {

  const server = new grpc.Server();
  server.addService(ourFileSystem.fileSystem.service, { 
    Ping: ping,
    PingAll: pingAll
  });

  const serverAddress = "localhost:50051";
  
  server.bindAsync(
    serverAddress,
    grpc.ServerCredentials.createInsecure(),
    () => {
      console.log(`Server running at ${serverAddress}`);
      server.start();
    }
  );
}

main();
