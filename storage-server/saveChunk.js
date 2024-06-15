const fs = require('fs');
const path = require('path');

var Master_Port = require("./storage");

function getChecksum(inputString) {
  const hash = crypto.createHash('sha256');
  hash.update(inputString);
  return hash.digest('hex');
}

function saveChunkLocally(metaData, chunkId, buffer) {
  // console.log(Master_Port);
  const fileName = `${metaData}_${chunkId}`;
  const filePath = path.join(`${Master_Port.Master_Port}`, fileName);
  
  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error("Error writing file:", err);
    } else {
      console.log(`File ${fileName} saved successfully!`);
    }
  });
}

function storeChunk(call, callback) {
    const { clientId, metaData, data, checkSum } = call.request;
    console.log("Chunk combination received");
  
    const receivedDataString = data.toString('utf8'); // Convert the Buffer to a string
    let receivedData;
    try {
      receivedData = JSON.parse(receivedDataString); // Parse the string to JSON
    } catch (e) {
      console.error("Error parsing JSON data:", e);
      return callback(new Error("Invalid JSON data"));
    }
  
    for (const [chunkId, chunkData] of Object.entries(receivedData)) {
        saveChunkLocally(metaData, chunkId, Buffer.from(chunkData));
  
      // if (checkSum == getChecksum(metaData + chunkData)) {
      //   saveChunkLocally(metaData, chunkId, Buffer.from(chunkData));
      // } else {
      //   console.log("Checksum does not match for chunk", chunkId);
      //   return callback(new Error(`Checksum does not match for chunk ${chunkId}`));
      // }
    }
    
    callback(null, { message: "All chunks saved!" });
  }



  module.exports = {storeChunk};