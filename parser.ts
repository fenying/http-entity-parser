/// <reference path="./typings/index.d.ts" />

import * as http from "http";
import * as fs from "fs";
import parseMultipartFormData = require("./parsers/multipart-form-data");
import parseJSON = require("./parsers/application-json");
import parseURLEncoded = require("./parsers/x-www-form-urlencoded");
import parseRawBinary = require("./parsers/raw-binary");

enum BEStatus {
    "IDLE" = 0,
    "COMPLETED" = 1,
    "BAD_FORMAT" = 2,
    "READING_HEADER" = 3,
    "READING_FORM_DATA" = 4,
    "READING_FILE_DATA" = 5
}

/**
 * The parser to decode HTTP Entity Data.
 */
export class EntityParser {

    protected options: HTTPEntityParser.Options;

    protected static defaultOptions:  HTTPEntityParser.Options = {

        "uploadFile": true,

        "tempFileRoot": "./tmp/",

        "maxBufferSize": 1048576, // 1 MB

        "interruptOnExceed": true,

        "disableTextJSON": false,

        "disableRawBinary": false
    };

    public constructor(opts?:  HTTPEntityParser.Options) {

        this.options = {};

        if (opts) {

            for (let key in EntityParser.defaultOptions) {

                if (opts[key] !== undefined) {

                    this.options[key] = opts[key];

                } else {

                    this.options[key] = EntityParser.defaultOptions[key];
                }
            }

        } else {

            for (let key in EntityParser.defaultOptions) {

                this.options[key] = EntityParser.defaultOptions[key];
            }
        }

    }

    parse(req: http.IncomingMessage, callback?: HTTPEntityParser.Callback<any>) {

        if (req.method !== "POST" || !req.headers["content-type"]) {
            return;
        }

        switch (req.headers["content-type"].toLowerCase()) {

        case "x-www-form-urlencoded":

            parseURLEncoded(req, this.options, callback);
            break;

        case "text/json":

            if (this.options.disableTextJSON) {

                if (this.options.disableRawBinary) {

                    break;
                }

                parseRawBinary(req, this.options, callback);

                break;
            }

            parseJSON(req, this.options, callback);
            break;

        case "application/json":

            parseJSON(req, this.options, callback);
            break;

        default:

            let result: RegExpMatchArray;

            if (result = req.headers["content-type"].match(/^multipart\/form-data;\s*boundary\=(.+)$/i)) {

                parseMultipartFormData(req, result[1].trim(), this.options, callback);

            } else if (!this.options.disableRawBinary) {

                parseRawBinary(req, this.options, callback);
            }
        }

    }


}
