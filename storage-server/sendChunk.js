const fs = require('fs');
const path = require('path');

var Master_Port = require("./storage");

function requestChunk(call, callback) {
    const fileName = call.request.fileName;
    const filePath = path.join(`${Master_Port.Master_Port}`, fileName);
  
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error("Error reading file:", err);
        return callback(err);
      }
  
      callback(null, { data });
    });
}

module.exports = {requestChunk};