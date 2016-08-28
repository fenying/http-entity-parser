/// <reference path="../typings/index.d.ts" />

import * as http from "http";

function parseRawBinary(req: http.IncomingMessage, opts: HTTPEntityParser.Options, callback?: HTTPEntityParser.Callback<any>): void {

    let buffer: Buffer = null;
    let err: Error = null;

    let onDataRecv = function(chunk: Buffer): void {

        buffer = buffer ? Buffer.concat([buffer, chunk]) : chunk;

        if (opts.maxDataSize && opts.maxDataSize < buffer.length) {

            req.removeListener("data", onDataRecv);
            err = {
                "name": "EXCEED-LENGTH",
                "message": "The received data length has exceeded the max length limitation."
            };
            buffer = null;
        }

    };

    req.addListener("data", onDataRecv).addListener("end", function(): void {

        req.removeListener("data", onDataRecv);

        if (err) {

            callback && setTimeout(callback, 0, err);
            err = null;

            return;
        }

        callback && setTimeout(callback, 0, null, buffer, function() {});
        buffer = null;
    });

}

export = parseRawBinary;
