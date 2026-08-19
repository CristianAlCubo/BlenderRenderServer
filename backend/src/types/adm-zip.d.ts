declare module "adm-zip" {
  class AdmZip {
    constructor(path?: string);
    addFile(entryName: string, data: Buffer | string): void;
    writeZip(targetPath?: string): void;
    toBuffer(): Buffer;
  }
  export = AdmZip;
}
