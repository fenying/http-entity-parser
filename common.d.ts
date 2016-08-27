
declare namespace HTTPEntityParser {

    export interface HashMap<T> {

        [key: string]: T;
    }

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

        callback?: (err: Error, formData: HashMap<any>) => void;
    }

    /**
     * The information structure of uploaded temporary files.
     */
    export interface TempFileInfo {

        /**
         * Filename from client.
         */
        "name": string;

        /**
         * Path of uploaded temporary file.
         * 
         * NOTICE: If file parsed failed, this property doesn't exist. 
         */
        "tempPath"?: string;

        /**
         * MIME type of this file.
         */
        "contentType": string;

        /**
         * Length in bytes of this file.
         */
        "size": number;
    }

}
