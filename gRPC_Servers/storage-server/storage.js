const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const pingpongProto = grpcObject.PingPongPackage;

const client = new pingpongProto.PingPong(
  "localhost:50051",
  grpc.credentials.createInsecure()
);

function pingClient() {
  client.Ping({}, (error, response) => {
    if (error) {
      console.error("Client is offline");
    } else {
      console.log("Client is online: ", response.message);
    }
  });
}

setInterval(pingClient, 5000);
