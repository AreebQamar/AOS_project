const grpc = require("@grpc/grpc-js");

const ping = require("./ping.js");

const fs = require('fs');




async function getAllTheFileChunks(fileName, metadataFilePath, packageDefinition, chunkServersList) {
    await ping.checkAndUpdateChunkServerStatus(packageDefinition, chunkServersList);

    console.log("FR: ", chunkServersList);

    return new Promise(async (resolve, reject) => {
      try {
        // Read metadata file
        const data = await fs.promises.readFile(metadataFilePath, 'utf8');
        const masterMetadata = JSON.parse(data);
  
        // Filter metadata for specific file
        const fileMetaData = masterMetadata.find((element) => element.fileName === fileName);

        if (!fileMetaData) {

          reject(new Error(`File "${fileName}" not found in metadata.`));
          return;

        }
  
        const chunkServerAlreadyUsed = [];
        const chunkPromises = fileMetaData.chunkIDs.map((chunkId) => {
          return new Promise((chunkResolve, chunkReject) => {
            let port;
            const chunkLocations = fileMetaData.chunks[chunkId];

            //testing.
            // console.log("\n\nchunk ID: ", chunkId);
            // console.log("chunk locations: ", chunkLocations);

            for (let i = 0; i< 3; i++){//3 replicas for each chunk.
              //testing.
              // console.log("chunk server Id: ", chunkLocations[i].chunkServerId);
              // console.log("chunk server port: ", chunkLocations[i].chunkPort);

              if(!chunkServerAlreadyUsed.includes(chunkLocations[i].chunkServerId) && chunkServersList[chunkLocations[i].chunkServerId]){
                chunkServerAlreadyUsed.push(chunkLocations[i].chunkServerId);
                port = chunkLocations[i].chunkPort;
                break;
              }
            }

            // console.log("loop terminated, port: ", port);

            if(!port){
              //console.log("No free server found!. requesting first location.")
              port = chunkLocations[0].chunkPort;
            }

            const slave = new packageDefinition.FileSystem(
              `localhost:${port}`,
              grpc.credentials.createInsecure()
            );
            const reqFileName = `${fileName}_${chunkId}`;
  
            console.log("port:", port, "filename:", reqFileName);
  
            slave.requestChunk({ fileName: reqFileName }, (error, response) => {
              if (error) {
                console.error(`Error receiving chunk: ${chunkId} from: ${fileMetaData.chunks[chunkId].chunkServerId}, Error:`, error);
                chunkReject(error);
              } else {
                chunkResolve(response.data);
              }
            });
          });
        });
  
        const chunks = await Promise.all(chunkPromises);
        const combinedBuffer = Buffer.concat(chunks);
        resolve(combinedBuffer);
  
      } catch (err) {
        console.error('Error processing file:', err);
        reject(err);
      }
    });
  }

  module.exports = {getAllTheFileChunks}