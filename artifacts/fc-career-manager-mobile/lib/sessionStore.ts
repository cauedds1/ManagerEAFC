const _store: Map<string, unknown> = new Map();

export function sessionGet<T>(key: string): T | null {
  const v = _store.get(key);
  return v !== undefined ? (v as T) : null;
}

export function sessionSet(key: string, value: unknown): void {
  if (value === null || value === undefined) {
    _store.delete(key);
    return;
  }
  _store.set(key, value);
}

export function sessionDel(key: string): void {
  _store.delete(key);
}

export function sessionClear(): void {
  _store.clear();
}

export function sessionKeys(): string[] {
  return [..._store.keys()];
}
