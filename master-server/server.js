const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const pingpongProto = grpcObject.PingPongPackage;

function ping(call, callback) {
  const clientId = call.request.id;
  console.log(`Ping received from client: ${clientId}`);
  callback(null, { message: `Pong from server to client ${clientId}` });
}

function main() {
  const server = new grpc.Server();
  server.addService(pingpongProto.PingPong.service, { Ping: ping });
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
