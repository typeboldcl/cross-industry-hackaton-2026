import { Global, Module } from "@nestjs/common";
import { ENV, type Env } from "../common/config/env.js";
import { ObsStorage } from "./obs-storage.js";
import { STORAGE } from "./storage.service.js";

@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      inject: [ENV],
      useFactory: (env: Env) => new ObsStorage(env.storage),
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
