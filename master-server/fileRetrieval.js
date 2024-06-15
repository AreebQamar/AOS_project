const grpc = require("@grpc/grpc-js");

const ping = require("./ping.js");

const fs = require('fs');




async function getAllTheFileChunks(fileName, metadataFilePath, packageDefinition, chunkServersList) {
    await ping.checkAndUpdateChunkServerStatus(packageDefinition, chunkServersList);
  
    return new Promise(async (resolve, reject) => {
      try {
        // Read metadata file
        const data = await fs.promises.readFile(metadataFilePath, 'utf8');
        const masterMetadata = JSON.parse(data);
  
        // Filter metadata for specific file
        const metaData = masterMetadata.find((element) => element.fileName === fileName);
        if (!metaData) {
          throw new Error(`File "${fileName}" not found in metadata.`);
        }
  
        const chunkPromises = metaData.chunkIDs.map((chunkId) => {
          return new Promise((chunkResolve, chunkReject) => {
            let port;
            if(chunkServersList[`${Number(chunkId) +1}`])
            {
              port = metaData.chunks[chunkId][Number(chunkId)].chunkPort;
  
            }
            else{
              for(let i= 0; i<3; i++){
                if(chunkServersList[i+1])
                {
                  port = metaData.chunks[chunkId][i].chunkPort;
      
                }
              }
            }
            const slave = new packageDefinition.FileSystem(
              `localhost:${port}`,
              grpc.credentials.createInsecure()
            );
            const reqFileName = `${fileName}_${chunkId}`;
  
            console.log("port:", port, "filename:", reqFileName);
  
            slave.requestChunk({ fileName: reqFileName }, (error, response) => {
              if (error) {
                console.error(`Error receiving chunk: ${chunkId} from: ${metaData.chunks[chunkId].chunkServerId}, Error:`, error);
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