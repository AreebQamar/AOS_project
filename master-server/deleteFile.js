const grpc = require("@grpc/grpc-js");
const fs = require('fs');
const ping = require("./ping.js");

const metadataFilePath = "./metaData.json"; // Update with the actual path to your metadata file

async function deleteMetaData(fileName) {
    const data = await fs.promises.readFile(metadataFilePath, 'utf8');
    const masterMetadata = JSON.parse(data);
    const fileIndex = masterMetadata.findIndex((element) => element.fileName === fileName);

    // console.log("file Index: ", fileIndex);
    if (fileIndex !== -1) {
        masterMetadata.splice(fileIndex, 1); // Remove the file entry completely
        if (masterMetadata.length === 0) {
            await fs.promises.writeFile(metadataFilePath, ''); // Write an empty string to the file
        } else {
            await fs.promises.writeFile(metadataFilePath, JSON.stringify(masterMetadata, null, 2));
        }
        // await fs.promises.writeFile(metadataFilePath, JSON.stringify(masterMetadata, null, 2));
    }
}

async function markFileAsDeleted(fileName) {
    const data = await fs.promises.readFile(metadataFilePath, 'utf8');
    const masterMetadata = JSON.parse(data);
    const fileMetaData = masterMetadata.find((element) => element.fileName === fileName);

    if (fileMetaData) {
        fileMetaData.deleted = true; // Mark the file as deleted
        await fs.promises.writeFile(metadataFilePath, JSON.stringify(masterMetadata, null, 2));
    }
}

async function updateMetadata(fileMetaData) {
    const data = await fs.promises.readFile(metadataFilePath, 'utf8');
    const masterMetadata = JSON.parse(data);
    const fileIndex = masterMetadata.findIndex((element) => element.fileName === fileMetaData.fileName);

    if (fileIndex !== -1) {
        masterMetadata[fileIndex] = fileMetaData; // Update the metadata with new chunk information
        await fs.promises.writeFile(metadataFilePath, JSON.stringify(masterMetadata, null, 2));
    }
}

async function deleteAllChunks(fileName, packageDefinition, chunkServersList) {
    await ping.checkAndUpdateChunkServerStatus(packageDefinition, chunkServersList);

    console.log("FR: ", chunkServersList);

    return new Promise(async (resolve, reject) => {
        try {
            const data = await fs.promises.readFile(metadataFilePath, 'utf8');
            const masterMetadata = JSON.parse(data);
            const fileMetaData = masterMetadata.find((element) => element.fileName === fileName);

            if (!fileMetaData) {
                reject(new Error(`File "${fileName}" not found.`));
                return;
            }

            const chunkPromises = fileMetaData.chunkIDs.map((chunkId) => {

                return new Promise((chunkResolve, chunkReject) => {

                    let allLocationsDeleted = true;
                    const chunkLocations = fileMetaData.chunks[chunkId];

                    for (let i = 0; i < chunkLocations.length; i++) {

                        const chunkLocation = chunkLocations[i];
                        if (chunkServersList[chunkLocation.chunkServerId]) {
                            
                            const port = chunkLocation.chunkPort;
                            const slave = new packageDefinition.FileSystem(
                                `localhost:${port}`,
                                grpc.credentials.createInsecure()
                            );
                            const reqFileName = `${fileName}_${chunkId}`;

                            console.log("port:", port, "chunkName:", reqFileName);

                            slave.deleteChunk({ fileName: reqFileName }, (error, response) => {
                                if (error) {
                                    console.error(`Error deleting chunk: ${chunkId} from: ${chunkLocation.chunkServerId}, Error:`, error);
                                    allLocationsDeleted = false;
                                    chunkReject(error);
                                } else {
                                    // Remove the chunk location from the metadata
                                    fileMetaData.chunks[chunkId] = fileMetaData.chunks[chunkId].filter(loc => loc.chunkServerId !== chunkLocation.chunkServerId);
                                    if (fileMetaData.chunks[chunkId].length === 0) {
                                        delete fileMetaData.chunks[chunkId];
                                        fileMetaData.chunkIDs = fileMetaData.chunkIDs.filter(id => id !== chunkId);
                                    }

                                    // console.log("file meta data: ", fileMetaData);

                                    if (fileMetaData.chunkIDs.length === 0) {
                                       deleteMetaData(fileName);
                                    } 
                                    chunkResolve();
                                }
                            });
                        }
                        else {
                            // allLocationsDeleted = false;
                            // // Store the chunks information as pending
                            // if (!fileMetaData.pendingDeletes) {
                            //     fileMetaData.pendingDeletes = [];
                            // }
                            // fileMetaData.pendingDeletes.push({ chunkId, chunkLocation });
                        }
                    }

                    if (allLocationsDeleted) {
                        chunkResolve();
                    }
                });
            });

            await Promise.all(chunkPromises);

            // console.log("at the end \n file MetaData: ", fileMetaData);
            // if (fileMetaData.chunkIDs.length === 0) {
            //     await deleteMetaData(fileName);
            // } else {
            //     await markFileAsDeleted(fileName);
            //     await updateMetadata(fileMetaData);
            // }

            resolve("File deletion process completed");
        } catch (err) {
            console.error('Error processing file:', err);
            reject(err);
        }
    });
}

module.exports = { deleteAllChunks }
