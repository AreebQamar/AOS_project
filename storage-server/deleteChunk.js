const fs = require('fs');
const path = require('path');

var Master_Port = require("./storage");

function deleteChunk(call, callback) {
    const fileName = call.request.fileName;
    const filePath = path.join(`${Master_Port.Master_Port}`, fileName);
  
    // Check if the file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File not found: ${filePath}`);
            callback({
                code: grpc.status.NOT_FOUND,
                message: `File not found: ${filePath}`
            });
            return;
        }

        // Delete the file
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error(`Error deleting file: ${filePath}`, err);
                callback({
                    code: grpc.status.INTERNAL,
                    message: `Error deleting file: ${filePath}`
                });
                return;
            }

            console.log(`File deleted: ${filePath}`);
            callback(null, { message: `File deleted: ${filePath}` });
        });
    });
}

module.exports = { deleteChunk };
