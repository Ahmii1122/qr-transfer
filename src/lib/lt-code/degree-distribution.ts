const DEFAULT_C = 0.03;
const DEFAULT_DELTA = 0.5;

/**
 * Robust Soliton degree distribution for LT codes.
 * Returns normalized probabilities for degrees 1..K (index 0 unused).
 */
export function robustSolitonDistribution(
  blockCount: number,
  c = DEFAULT_C,
  delta = DEFAULT_DELTA
): number[] {
  if (blockCount <= 0) return [];
  if (blockCount === 1) return [0, 1];

  const distribution = new Array(blockCount + 1).fill(0);

  // Ideal Soliton ρ
  distribution[1] = 1 / blockCount;
  for (let degree = 2; degree <= blockCount; degree++) {
    distribution[degree] = 1 / (degree * (degree - 1));
  }

  // Robust Soliton τ
  const R = c * Math.log(blockCount / delta) * Math.sqrt(blockCount);
  for (let degree = 1; degree < blockCount; degree++) {
    if (degree < blockCount / R) {
      distribution[degree] += R / (blockCount * degree);
    } else {
      distribution[degree] += (R * Math.log(R / delta)) / (blockCount * degree);
    }
  }
  distribution[blockCount] += (R * Math.log(R / delta)) / blockCount;

  const total = distribution.reduce((sum, value) => sum + value, 0);
  for (let degree = 1; degree <= blockCount; degree++) {
    distribution[degree] /= total;
  }

  return distribution;
}

export function createDegreeSampler(blockCount: number): () => number {
  const distribution = robustSolitonDistribution(blockCount);
  const cdf: number[] = [];
  let cumulative = 0;

  for (let degree = 1; degree <= blockCount; degree++) {
    cumulative += distribution[degree];
    cdf.push(cumulative);
  }

  return () => {
    const roll = Math.random();
    for (let i = 0; i < cdf.length; i++) {
      if (roll <= cdf[i]) return i + 1;
    }
    return blockCount;
  };
}
