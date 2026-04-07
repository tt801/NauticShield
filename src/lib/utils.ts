type ClassValue = string | number | boolean | undefined | null | ClassValue[];

function clsx(...inputs: ClassValue[]): string {
  return inputs
    .flat(Infinity as 0)
    .filter(Boolean)
    .join(' ');
}

export function cn(...inputs: ClassValue[]): string {
  return clsx(...inputs);
}
