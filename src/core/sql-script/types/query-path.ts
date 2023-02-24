type JsonKeys<T> = T extends object
  ? {
      [K in keyof T]-?:
        | `${string & K}`
        | `${JsonKeys<T[K]> & `.${string & K}`}`;
    }[keyof T]
  : "";

type FlattenJson<T, K = JsonKeys<T>> = K extends keyof T
  ? T[K] extends Record<string, any>
    ? `${string & K}.${FlattenJson<T[K]>}`
    : K
  : never;

export type QueryPath<T> = FlattenJson<T>;
