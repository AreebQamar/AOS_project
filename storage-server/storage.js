const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require("fs");
const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const FileTransferProto = grpcObject.FileTransferPackage;

function saveFile(filename, client) {
  const call = client.uploadFile((error, response) => {
    if (error) {
      console.error("Error uploading file:", error);
    } else {
      console.log("Upload status:", response.message);
    }
  });

  const readStream = fs.createReadStream(filename);
  readStream.on("data", (chunk) => {
    call.write({ content: chunk, filename: filename });
  });

  readStream.on("end", () => {
    call.end();
  });

  readStream.on("error", (err) => {
    console.error("Error reading file:", err);
  });
}

function main() {
  const client = new FileTransferProto.FileTransfer(
    "localhost:50051",
    grpc.credentials.createInsecure()
  );
  const filename = "send.txt";
  uploadFile(filename, client);
}

main();
