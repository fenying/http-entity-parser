/// <reference path="../typings/index.d.ts" />

import * as http from "http";
import * as fs from "fs";
import async = require("async");

enum BEStatus {
    "IDLE" = 0,
    "COMPLETED" = 1,
    "BAD_FORMAT" = 2,
    "READING_HEADER" = 3,
    "READING_FORM_DATA" = 4,
    "READING_FILE_DATA" = 5
}

/**
 * The stack variables set
 */
class DepackStack {

    public buffer: Buffer;
    public tmpFiles: string[];
    public form: HTTPEntityParser.HashMap<any>;
    public elID: string;
    public fd: number;
    public boundary: Buffer;
    public endBoundary: Buffer;
    public midBoundary: Buffer;
    public status: BEStatus;

    public constructor(boundary: string) {

        this.boundary = new Buffer(HTTP_NEWLINE + "--" + boundary);
        this.endBoundary = new Buffer(this.boundary + "--" + HTTP_NEWLINE);
        this.status = BEStatus.IDLE;
        this.buffer = new Buffer(HTTP_NEWLINE);
        this.form = {};
        this.tmpFiles = [];

        this.midBoundary = Buffer.concat([this.boundary, HTTP_NEWLINE]);
    }

}

class FileInfo implements HTTPEntityParser.TempFileInfo {

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

function depackHeadVar(line: string): HTTPEntityParser.HashMap<any> {

    let rtn: HTTPEntityParser.HashMap<any> = {}, vals: string[], ss: string[] = [];
    let pos: number;
    let i = 0;

    pos = line.indexOf(":");

    if (pos === -1) {
        return null;
    }

    rtn["----NAME"] = line.substr(0, pos).toLowerCase();

    line = line.substr(pos + 1).replace(/".+?"/g, function(el): string {
        ss.push(el.substr(1, el.length - 2));
        return `@##${i++}`;
    });

    vals = line.split(";");

    rtn[rtn["----NAME"]] = vals.splice(0, 1)[0].trim();

    for (let rexp of vals) {

        let exp = rexp.split("=");

        if (exp.length === 1) {

            rtn[exp[0].trim().toLowerCase()] = true;

        } else {

            exp[1] = exp[1].trim();

            let match: RegExpMatchArray;

            if (match = exp[1].match(/^@##(\d+)$/)) {

                rtn[exp[0].trim().toLowerCase()] = ss[parseInt(match[1])];

            } else {

                rtn[exp[0].trim().toLowerCase()] = exp[1].trim();

            }

        }
    }

    return rtn;
}

function parseMultipartFormData(req: http.IncomingMessage, boundary: string, opts: HTTPEntityParser.Options, callback?: HTTPEntityParser.Callback<HTTPEntityParser.HashMap<any>>) {

    let stack = new DepackStack(boundary);
    let pos: number;
    let file: FileInfo;
    let onDataRecv = function(chunk: Buffer) {

        if (stack.status === BEStatus.BAD_FORMAT || stack.status === BEStatus.COMPLETED) {

            return false;
        }

        let looping: boolean = true;

        let itemBuffer: string = "";

        stack.buffer = Buffer.concat([stack.buffer, chunk]);

        do {

            switch (stack.status) {
            case BEStatus.BAD_FORMAT:

                req.removeListener("data", onDataRecv);
                looping = false;
                break;

            case BEStatus.IDLE:

                if (stack.buffer.slice(0, stack.midBoundary.length).compare(stack.midBoundary) === 0) {

                    stack.buffer = stack.buffer.slice(stack.midBoundary.length);

                    stack.status = BEStatus.READING_HEADER;

                } else if (stack.buffer.slice(0, stack.endBoundary.length).compare(stack.endBoundary) === 0) {

                    looping = false;

                    stack.status = BEStatus.COMPLETED;

                } else {

                    stack.status = BEStatus.BAD_FORMAT;
                }

                break;

            case BEStatus.READING_FORM_DATA:

                pos = stack.buffer.indexOf(stack.boundary);

                if (pos === -1) {

                    if (stack.buffer.length >= opts.maxBufferSize) {

                        pos = stack.buffer.length - stack.boundary.length;

                        itemBuffer += stack.buffer.slice(0, pos);

                        stack.buffer = stack.buffer.slice(pos);

                    }

                    looping = false;

                } else {

                    itemBuffer += stack.buffer.slice(0, pos);

                    stack.buffer = stack.buffer.slice(pos);

                    if (stack.form[stack.elID] === undefined) {

                        stack.form[stack.elID] = itemBuffer;

                    } else {

                        stack.form[stack.elID].push(itemBuffer);
                    }

                    stack.status = BEStatus.IDLE;

                }

                break;

            case BEStatus.READING_FILE_DATA:

                pos = stack.buffer.indexOf(stack.boundary);

                if (pos === -1) {

                    if (stack.buffer.length >= opts.maxBufferSize) {

                        pos = stack.buffer.length - stack.boundary.length;

                        file.size += pos;

                        if (opts.maxFileSize && opts.maxFileSize < file.size) {

                            if (stack.fd) {

                                fs.closeSync(stack.fd);
                                fs.unlink(file.tempPath);

                                delete file.tempPath;

                                stack.fd = null;

                                file = null;
                                stack.tmpFiles.pop();

                            }

                        } else {

                            fs.writeSync(stack.fd, stack.buffer.slice(0, pos), 0, pos);

                        }

                        stack.buffer = stack.buffer.slice(pos);

                    }

                    looping = false;

                } else {

                    file.size += pos;

                    if (opts.maxFileSize && opts.maxFileSize < file.size) {

                        if (stack.fd) {

                            fs.close(stack.fd);
                            fs.unlink(file.tempPath);

                            delete file.tempPath;

                            stack.fd = null;

                            file = null;
                            stack.tmpFiles.pop();

                        }

                    } else {

                        fs.writeSync(stack.fd, stack.buffer.slice(0, pos), 0, pos);

                        fs.close(stack.fd);

                    }

                    stack.fd = null;

                    file = null;

                    stack.buffer = stack.buffer.slice(pos);

                    stack.status = BEStatus.IDLE;

                }

                break;

            case BEStatus.READING_HEADER:

                let innerLooping: boolean = true;

                while (innerLooping) {

                    let line: string;

                    pos = stack.buffer.indexOf(HTTP_NEWLINE);

                    if (pos === -1) {

                        if (stack.buffer.length > 1024) {

                            stack.status = BEStatus.BAD_FORMAT;

                        } else {

                            looping = false;
                        }

                        break;
                    }

                    line = stack.buffer.slice(0, pos).toString("utf-8").trim();

                    if (line.length === 0) {

                        stack.buffer = stack.buffer.slice(2);

                        stack.status = file ? BEStatus.READING_FILE_DATA : BEStatus.READING_FORM_DATA;

                        innerLooping = false;

                        if (file) {

                            stack.fd = fs.openSync(file.tempPath, "w");

                        }

                        continue;

                    } else {

                        let httpVar: HTTPEntityParser.HashMap<any> = depackHeadVar(line);

                        if (null === httpVar) {

                            stack.status = BEStatus.BAD_FORMAT;

                            innerLooping = false;

                            continue;

                        }

                        switch (httpVar["----NAME"]) {
                        case "content-disposition":

                            if (httpVar["content-disposition"].toLowerCase() !== "form-data" || !httpVar["name"]) {

                                stack.status = BEStatus.BAD_FORMAT;

                                innerLooping = false;

                                continue;

                            }

                            stack.elID = httpVar["name"];

                            if (httpVar["filename"]) {

                                let today: Date = new Date();

                                let tempFile: string = opts.tempFileRoot + today.getFullYear() + today.getMonth() + today.getDate() + String.random(32);

                                stack.tmpFiles.push(tempFile);

                                stack.form[stack.elID] = file = new FileInfo(httpVar["filename"], tempFile);

                            } else {

                                file = null;

                                if (stack.elID.substr(stack.elID.length - 2) === "[]") {

                                    stack.elID = stack.elID.substr(0, stack.elID.length - 2);

                                    stack.form[stack.elID] === undefined && (stack.form[stack.elID] = []);

                                }

                                itemBuffer = "";

                            }

                            break;

                        case "content-type":

                            if (!file) {

                                break;
                            }

                            file.contentType = httpVar["content-type"];

                            break;
                        }

                        stack.buffer = stack.buffer.slice(pos + 2);
                    }

                }

                break;

            }

        } while (looping);

    };

    req.addListener("data", onDataRecv).addListener("end", function() {

        let files: string[] = stack.tmpFiles;

        let freeFiles = function() {

            async.forEachOf(files, function(item: string, key: number, next: ErrorCallback) {

                fs.exists(item, function(exist: boolean) {

                    if (exist) {

                        fs.unlink(item, function(err?: Error) {

                            next(err);
                        });

                    } else {

                        next();
                    }

                });

            }, function(err?: Error) {

                files = undefined;
            });
        };

        if (stack.status !== BEStatus.COMPLETED) {

            stack.fd && fs.close(stack.fd);

            callback && setTimeout(callback, 0, {
                "name": "BAD-FORMAT",
                "message": "Failed to depack the data as multipart/form-data format."
            }, undefined, freeFiles);

        } else {

            let formData: HTTPEntityParser.HashMap<any> = stack.form;

            stack = undefined;

            callback && callback(undefined, formData, freeFiles);
        }

    });
}

export = parseMultipartFormData;
