import { Module } from "@nestjs/common";
import { ExtractionModule } from "../extraction/extraction.module.js";
import { DocumentPipeline } from "./document-pipeline.js";
import {
  InlineDispatcher,
  PROCESSING_DISPATCHER,
} from "./processing-dispatcher.js";

@Module({
  imports: [ExtractionModule],
  providers: [
    DocumentPipeline,
    InlineDispatcher,
    { provide: PROCESSING_DISPATCHER, useExisting: InlineDispatcher },
  ],
  exports: [PROCESSING_DISPATCHER],
})
export class ProcessingModule {}
