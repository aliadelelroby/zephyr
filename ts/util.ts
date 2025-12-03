export function quote(text: string): string {
  return JSON.stringify(text);
}

export function error(text: string, line: number, column: number): never {
  const err = new Error(text);
  (err as any).line = line;
  (err as any).column = column;
  throw err;
}
