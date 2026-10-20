import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";

export const ACTOR_NAME_HEADER = "x-actor-name";

export function actorNameFrom(request: Pick<Request, "header">): string {
  const value = request.header(ACTOR_NAME_HEADER)?.trim();

  if (!value) {
    throw new BadRequestException(
      "Indica quién realiza la acción en el encabezado X-Actor-Name.",
    );
  }

  return decodeURIComponent(value);
}

export const OptionalActorName = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    const value = context
      .switchToHttp()
      .getRequest<Request>()
      .header(ACTOR_NAME_HEADER)
      ?.trim();
    return value ? decodeURIComponent(value) : null;
  },
);

export const ActorName = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    actorNameFrom(context.switchToHttp().getRequest<Request>()),
);
