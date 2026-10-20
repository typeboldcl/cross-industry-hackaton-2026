import type { QueryRequest } from "@hackaton/contracts";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class QueryDto implements QueryRequest {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  question: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @IsOptional()
  @IsBoolean()
  answer?: boolean;
}
