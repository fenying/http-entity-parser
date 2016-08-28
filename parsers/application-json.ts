/// <reference path="../typings/index.d.ts" />

import * as http from "http";

function parseJSON(req: http.IncomingMessage, opts: HTTPEntityParser.Options, callback?: HTTPEntityParser.Callback<any>): void {

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

        let jsonData: any;

        req.removeListener("data", onDataRecv);

        if (err) {

            callback && setTimeout(callback, 0, err);
            err = null;

            return;
        }

        try {

            jsonData = JSON.parse(buffer.toString());
            buffer = null;

        } catch (e) {

            callback && setTimeout(callback, 0, {
                "name": "BAD-FORMAT",
                "message": "Failed to parse HTTP Entity as JSON."
            }, buffer, function() {});

            buffer = null;
            return;
        }

        callback && setTimeout(callback, 0, null, jsonData, function() {});
        jsonData = null;
    });

}

export = parseJSON;
