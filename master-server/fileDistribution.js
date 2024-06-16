const ping = require("./ping.js");
const grpc = require("@grpc/grpc-js");

const crypto = require('crypto');

const fs = require('fs');
const path = require('path');

function getChecksum(inputString) {
    const hash = crypto.createHash('sha256'); // Create a SHA-256 hash instance
    hash.update(inputString); // Update the hash with the input string
    const checksum = hash.digest('hex'); // Get the checksum as a hexadecimal string
    return checksum;
}

function saveMetadata(metaData) {
    const metadataFilePath = path.join(__dirname, 'metadata.json');
  
    // console.log("\n\n meta data: ",metaData,"\n\n");
  
    fs.open(metadataFilePath, 'a+', (err, fd) => {
      if (err) {
        console.error('Error opening metadata file:', err);
        return;
      }
  
      fs.readFile(fd, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading metadata file:', err);
          return;
        }
  
        let newEntry = JSON.stringify(metaData, null, 2);
  
        if (data.length === 0) {
          // New file, start the JSON array
          newEntry = `[${newEntry}]`;
        }
        else {
          // Existing file, remove the last `]` to append new entry
          const trimmedData = data.trim();
          if (trimmedData.endsWith(']')) {
            const updatedData = trimmedData.slice(0, -1);
            newEntry = `,${newEntry}]`;
            newEntry = updatedData + newEntry;
          }
          else {
            console.error('Invalid JSON structure in metadata file');
            return;
          }
        }
  
        fs.writeFile(metadataFilePath, newEntry, 'utf8', (err) => {
          if (err) {
            console.error('Error writing metadata file:', err);
          }
          else {
            console.log('Metadata updated successfully');
          }
        });
      });
    });
}

function createFileChunks(fileData, n) {
    const chunks = [];
    const chunkSize = Math.ceil(fileData.length / n);
  
    for (let i = 0; i < n; i++) {
      const chunk = fileData.slice(i * chunkSize, (i + 1) * chunkSize);
      chunks.push(chunk);
    }
    return chunks;
}

function getCombinations(chunks){
    const combinations = [];
    const len = chunks.length;

    for (let i = 0; combinations.length < len; i++) {
      const combo = {};

      for (let j = 0; j < 3; j++) {
        combo[(i + j) % len] = chunks[(i + j) % len]
      }

      combinations.push(combo);
    }
  
    return combinations;
  }
// function sendFileToChunkServer(packageDefinition, chunkServersList, chunkServerId, fileName, chunk) {
//     return new Promise((resolve, reject) => {
//       console.log(`\nid: ${chunkServerId}, port: ${chunkServersList[chunkServerId].port}`);
//       console.log("fileName :", fileName);
//       console.log("chunk: ", chunk, "\n");
  
//       const slave = new packageDefinition.FileSystem(
//         `localhost:${chunkServersList[chunkServerId].port}`,
//         grpc.credentials.createInsecure()
//       );
  
//       const checkSum = getChecksum(fileName + chunk);
//       slave.storeChunk({ clientId: chunkServerId, metaData: fileName, data: chunk, checkSum }, (error, response) => {
//         if (error) {
//           console.error(`Error sending chunk to ${chunkServerId}:`, error);
//           return reject(error);
//         } else {
//           console.log(response);
//           resolve(response);
//         }
//       });
//     });
// }

function sendFileToChunkServer(packageDefinition, chunkServersList, chunkServerId, fileName, combination) {
    return new Promise((resolve, reject) => {
      console.log(`\nid: ${chunkServerId}, port: ${chunkServersList[chunkServerId].port}`);
      console.log("fileName :", fileName);
      console.log("combination: ", combination, "\n");
    //   console.log("combination: ");
    //   combination.map((key, value)=>{
    //     console.log("key:", key, "value: ", value)
    //   })
  
      const slave = new packageDefinition.FileSystem(
        `localhost:${chunkServersList[chunkServerId].port}`,
        grpc.credentials.createInsecure()
      );
  
      const combinationBuffer = Buffer.from(JSON.stringify(combination)); // Serialize the combination to a Buffer
      const checkSum = getChecksum(fileName + combinationBuffer.toString('utf8'));
      
      slave.storeChunk({
        clientId: chunkServerId,
        metaData: fileName,
        data: combinationBuffer, // Send the combination as a Buffer
        checkSum
      }, (error, response) => {
        if (error) {
          console.error(`Error sending chunk to ${chunkServerId}:`, error);
          return reject(error);
        } else {
          console.log(response);
          resolve(response);
        }
      });
    });
  }

function saveFile(packageDefinition, chunkServersList, fileName, fileBuffer) {

    const masterMetaData = {
      fileName,
      chunkIDs: [],
      chunks: {}
    };
    
    return new Promise(async (resolve, reject) => {
      try {
        await ping.checkAndUpdateChunkServerStatus(packageDefinition, chunkServersList);
  
        const numberOfAvailableServers = Object.keys(chunkServersList).length;
        if (numberOfAvailableServers < 1) {
          reject(new Error("No chunk Server Available."));
        }
       
        const chunks = createFileChunks(fileBuffer, numberOfAvailableServers);
        const combinations = getCombinations(chunks);
        // console.log(combinations);
        // console.log("chunkServers:", chunkServersList);

        combinations.forEach((combination, index) => {
            masterMetaData.chunkIDs.push(index);
            const keys = Object.keys(combination);
            // console.log("keys", keys);
            masterMetaData.chunks[index] = keys.map((key) => {
                const serverId = String(Number(key) + 1);
                return {
                    chunkServerId: serverId,
                    chunkPort: chunkServersList[serverId].port
                };
            });
        });

        const chunkPromises = Object.keys(chunkServersList).map(chunkServerId => {
            return sendFileToChunkServer(packageDefinition, chunkServersList, chunkServerId, fileName, combinations[Number(chunkServerId-1)]);
        });

        await Promise.all(chunkPromises);
        saveMetadata(masterMetaData);

        resolve();
      } catch (err) {
        reject(err);
      }
    });
}

module.exports = {saveFile}