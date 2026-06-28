type ClassType = new (...args: any[]) => object;

export function ApiProperty(_options?: Record<string, unknown>): PropertyDecorator {
  return () => undefined;
}

export function ApiPropertyOptional(_options?: Record<string, unknown>): PropertyDecorator {
  return () => undefined;
}

export function PartialType(classRef: ClassType): ClassType {
  return class extends classRef {} as ClassType;
}

