const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const packageDefinition = protoLoader.loadSync("../proto.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDefinition);
const pingpongProto = grpcObject.PingPongPackage;
const fs = require("fs");
const path = require("path");
const client = new pingpongProto.FileTransfer(
  "localhost:50051",
  grpc.credentials.createInsecure()
);

// function getFileFromMaster(filename) {
//   const savepath = path.join(__dirname, `fetched-${filename}`);
//   const writeStream = fs.createWriteStream(savepath);
//   const call = client.uploadFileToStorage({ filename });
//   call.on("data", (chunk) => {
//     writeStream.write(chunk.data);
//   });

//   call.on("end", () => {
//     writeStream.end();
//     console.log(`File fetched successfully and saved to ${savepath}`);
//   });

//   call.on("error", (error) => {
//     console.error("Error fetching the file:", error.message);
//   });
// }

function sendFileToMaster(filename) {
  const readStream = fs.createReadStream("./fetched-test.txt");
  const call = client.MasterRequestForFilenameToDownload((error, response) => {
    if (error) {
      console.error("Error uploading file:", error);
    } else {
      console.log("Upload status:", response.message);
    }
  });
  call.on("data", (message) => {
    const responsemessage = { filename: message.filename };
    console.log(responsemessage.filename);
  });
  readStream.on("data", (chunk) => call.write({ data: chunk }));
  readStream.on("end", () => {
    call.end();
  });
  readStream.on("error", (error) => {
    console.error(error);
    call.end();
  });
}

const filename = "test.txt";
sendFileToMaster();
// getFileFromMaster(filename);
