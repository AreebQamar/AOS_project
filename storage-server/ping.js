


function ping(call, callback) {
    const clientId = call.request.id;
    console.log(`Ping received from Master: ${clientId}`);
    callback(null, { message: `Pong from server to client ${clientId}` });
}

module.exports = {ping}