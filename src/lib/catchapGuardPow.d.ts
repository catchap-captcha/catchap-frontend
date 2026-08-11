export interface PowChallenge {
  seed: string;
  bits: number;
}
export function solveCatchapPow(pow: PowChallenge | null | undefined): Promise<string | null>;
