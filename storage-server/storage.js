const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const ourFileSystem = grpcObject.distributedFileSyatemPackage;

// Read client ID from command-line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: node client.js <client_id>");
  process.exit(1);
}
const clientId = args[0];

const client = new ourFileSystem.fileSystem(
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

function startPingAll() {
  const call = client.PingAll();
  
  // Send client identity
  call.write({ id: clientId });

  call.on('data', (response) => {
    console.log('Received from server:', response.message);
  });

  call.on('end', () => {
    console.log('PingAll stream ended by server');
  });

  // Send periodic pings to server
  setInterval(() => {
    call.write({ id: clientId });
  }, 5000);
}


startPingAll();

setInterval(pingClient, 5000);
