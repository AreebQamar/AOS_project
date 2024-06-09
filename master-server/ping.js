const grpc = require("@grpc/grpc-js");




function markChunkServerOffline(chunkServersList, chunkServerId) {
    if (chunkServersList[chunkServerId]) {
      delete chunkServersList[chunkServerId];
    }
}

function pingChunkServer(packageDefinition, chunkServersList, chunkServerId) {
    return new Promise((resolve, reject) => {
        const slave = new packageDefinition.FileSystem(
        `localhost:${chunkServersList[chunkServerId].port}`,
        grpc.credentials.createInsecure()
        );

        console.log(`sending ping to chunkServer: ${chunkServerId}`);
        slave.Ping({ id: chunkServersList[chunkServerId].id }, (error, response) => {
        if (error) {
            console.error("Error pinging chunk server, marking it offline:", error);
            markChunkServerOffline(chunkServerId);
            resolve(null); // resolve with null to indicate failure, but don't reject
        } else {
            console.log("response: ", response.message, "\n");
            resolve(response);
        }
        });
    });
}

async function checkAndUpdateChunkServerStatus(packageDefinition, chunkServersList) {
    const pingPromises = [];
  
    for (const chunkServerId in chunkServersList) {
      pingPromises.push(pingChunkServer(packageDefinition, chunkServersList, chunkServerId));
    }
  
    await Promise.all(pingPromises);
    console.log('All chunk servers have been pinged.');
}

module.exports = {checkAndUpdateChunkServerStatus}