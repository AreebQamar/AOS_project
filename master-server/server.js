const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const FileTransferProto = grpcObject.FileTransferPackage;
const fs = require("fs");
const path = require("path");

function uploadFileToStorage(call, callback) {
  let writeStream;
  let filename;
  call.on("data", (chunk) => {
    if (!writeStream) {
      filename = chunk.filename;
      const filePath = path.join("../storage-server/file-storage/", filename);
      writeStream = fs.createWriteStream(filePath);
    }
    writeStream.write(chunk.content);
  });

  call.on("end", () => {
    if (writeStream) {
      writeStream.end();
      callback(null, { success: true, message: "File uploaded successfully" });
    } else {
      callback(null, { success: false, message: "No data received" });
    }
  });

  call.on("error", (err) => {
    console.error("Error receiving file:", err);
  });
}

function main() {
  const server = new grpc.Server();
  server.addService(FileTransferProto.FileTransfer.service, {
    SendFileToStorage: uploadFileToStorage,
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
