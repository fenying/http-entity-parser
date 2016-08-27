/// <reference path="./typings/index.d.ts" />

import * as http from "http";
import * as fs from "fs";
import parseMultipartFormData = require("./multipart-form-data");

enum BEStatus {
    "IDLE" = 0,
    "COMPLETED" = 1,
    "BAD_FORMAT" = 2,
    "READING_HEADER" = 3,
    "READING_FORM_DATA" = 4,
    "READING_FILE_DATA" = 5
}

export type DepackFailMethod = "ignore" | "shutdown";

export interface Options {

    uploadFile?: boolean;

    tempFileRoot?: string;

    maxFileSize?: number;

    maxFileNumber?: number;

    maxDataSize?: number;

    maxBufferSize?: number;

    /**
     * Interrupt the connection on data exceeded.
     */
    interruptOnExceed?: boolean;

    callback?: (err: Error, formData: HTTPEntityParser.HashMap<any>) => void;
}

class Parser {

    public buffer: Buffer;
    public tmpFiles: string[];
    public form: HTTPEntityParser.HashMap<any>;
    public elID: string;
    public depacker: Depacker;
    public isFile: boolean;
    public fd: number;
    public boundary: Buffer;
    public endBoundary: Buffer;
    public midBoundary: Buffer;
    public status: BEStatus;
    /*
    protected _status: BEStatus;

    public get status(): BEStatus {

        return this._status;
    }

    public set status(newV: BEStatus) {
        console.log("new status: ", BEStatus[newV]);
        this._status = newV;
    }*/

    public constructor(boundary: string, depacker: Depacker) {

        this.boundary = new Buffer(HTTP_NEWLINE + "--" + boundary);
        this.depacker = depacker;
        this.endBoundary = new Buffer(this.boundary + "--" + HTTP_NEWLINE);
        this.status = BEStatus.IDLE;
        this.buffer = new Buffer(HTTP_NEWLINE);
        this.form = {};
        this.tmpFiles = [];
        this.isFile = false;

        this.midBoundary = Buffer.concat([this.boundary, HTTP_NEWLINE]);
    }

}

export interface TempFileInfo {

    "name": string;
    "tempPath"?: string;
    "contentType": string;
    "size": number;
}

class FileInfo implements TempFileInfo {

    public "name": string;
    public "tempPath": string;
    public "contentType": string;
    public "size": number;

    public constructor(fName: string, tmpPath: string) {

        this.name = fName;
        this.tempPath = tmpPath;
        this.size = 0;
    }
}

const HTTP_NEWLINE: Buffer = new Buffer("\r\n");

export class Depacker {

    protected options: Options;

    protected static defaultOptions: Options = {

        "uploadFile": true,

        "tempFileRoot": "./tmp/",

        "maxFileSize": undefined,

        "maxDataSize": undefined,

        "maxBufferSize": 1048576, // 1 MB

        "interruptOnExceed": true,

        "callback": null

    };

    public constructor(opts?: Options) {

        this.options = {};

        if (opts) {

            for (let key in Depacker.defaultOptions) {

                if (opts[key] !== undefined) {

                    this.options[key] = opts[key];

                } else {

                    this.options[key] = Depacker.defaultOptions[key];
                }
            }
        } else {

            for (let key in Depacker.defaultOptions) {

                this.options[key] = Depacker.defaultOptions[key];
            }
        }

    }

    parse(req: http.IncomingMessage) {

        if (req.method !== "POST" || !req.headers["content-type"]) {
            return;
        }

        switch (req.headers["content-type"].toLowerCase()) {

        case "application/json":

            break;

        default:

            let result: RegExpMatchArray;

            if (result = req.headers["content-type"].match(/^multipart\/form-data;\s*boundary\=(.+)$/i)) {

                parseMultipartFormData(req, result[1].trim(), this.options);
            }
        }

    }


}
