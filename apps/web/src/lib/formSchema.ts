export type FormFieldType = 'string' | 'number' | 'boolean' | 'array';

export interface FormField {
  key: string;
  type: FormFieldType;
  required: boolean;
}

/** Compiles builder rows into the JSON-schema-like object the backend stores. */
export function fieldsToFormSchema(
  fields: FormField[],
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const field of fields) {
    if (!field.key.trim()) continue;
    properties[field.key] =
      field.type === 'array'
        ? { type: 'array', items: { type: 'string' } }
        : { type: field.type };
  }
  return {
    type: 'object',
    required: fields.filter((f) => f.required && f.key.trim()).map((f) => f.key),
    properties,
  };
}

/** Parses a stored formSchema back into builder rows. */
export function formSchemaToFields(
  schema: Record<string, unknown> | undefined,
): FormField[] {
  if (!schema || typeof schema.properties !== 'object') return [];
  const properties = schema.properties as Record<
    string,
    { type?: string }
  >;
  const required = Array.isArray(schema.required)
    ? (schema.required as string[])
    : [];

  return Object.entries(properties).map(([key, def]) => ({
    key,
    type: (def.type === 'array' ||
    def.type === 'number' ||
    def.type === 'boolean'
      ? def.type
      : 'string') as FormFieldType,
    required: required.includes(key),
  }));
}
