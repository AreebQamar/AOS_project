const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require('fs');

const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const pingpongProto = grpcObject.PingPongPackage;

// Read client ID from command-line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: node client.js <client_id>");
  process.exit(1);
}
const clientId = args[0];

const client = new pingpongProto.PingPong(
  "localhost:50051",
  grpc.credentials.createInsecure()
);

function pingClient() {
  client.Ping({ id: clientId }, (error, response) => {
    if (error) {
      console.error("Client encountered an error:", error);
    } else {
      console.log("response:", response.message);
    }
  });
}

setInterval(pingClient, 5000);
