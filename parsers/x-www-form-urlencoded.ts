/// <reference path="../typings/index.d.ts" />

import NodeQS = require("querystring");
import * as http from "http";

function parseURLEncoded(req: http.IncomingMessage, opts: HTTPEntityParser.Options, callback?: HTTPEntityParser.Callback<any>): void {

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

        let postData: any;

        req.removeListener("data", onDataRecv);

        if (err) {

            callback && setTimeout(callback, 0, err);
            err = null;

            return;
        }

        try {

            postData = NodeQS.parse(buffer.toString());
            buffer = null;

        } catch (e) {

            callback && setTimeout(callback, 0, {
                "name": "BAD-FORMAT",
                "message": "Failed to parse HTTP Entity as URLEncoded data."
            }, buffer, function() {});

            buffer = null;
            return;
        }

        callback && setTimeout(callback, 0, null, postData, function() {});
        postData = null;
    });

}

export = parseURLEncoded;
