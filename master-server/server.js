const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const pingpongProto = grpcObject.PingPongPackage;
const path = require("path");
const fs = require("fs");

function uploadFileToStorage(call) {
  const filename = call.request.filename;
  const filepath = path.join(__dirname, filename);
  const readStream = fs.createReadStream(filepath);
  readStream.on("data", (chunk) => {
    call.write({ data: chunk });
  });
  readStream.on("end", () => {
    call.end();
  });
  readStream.on("error", (error) => {
    console.error(error);
    call.end();
  });
}
function downloadFileFromStorage(call) {
  let filename;
  call.write({ filename: "fetched-test.txt" });
  const writeStream = fs.createWriteStream("./test.txt");
  call.on("data", (response) => {
    writeStream.write(response.data);
  });
  call.on("end", () => {
    call.end();
  });
}
function main() {
  const server = new grpc.Server();
  server.addService(pingpongProto.FileTransfer.service, {
    // uploadFileToStorage: uploadFileToStorage,
    MasterRequestForFilenameToDownload: downloadFileFromStorage,
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
