export type ManagedAnnualAmountPlot =
  | Readonly<{ status: "ready"; values: readonly number[] }>
  | Readonly<{ status: "unavailable"; reason: "unsafe_plot_value" }>;

export type ManagedAnnualAmountChartInput = Readonly<{
  contentKey: string;
  label: string;
  summary: string;
  unit: "USD";
  periods: readonly Readonly<{
    startDate: string;
    endDate: string;
    amount: string;
  }>[];
  plot: ManagedAnnualAmountPlot;
}>;

export function projectManagedAnnualAmountPlot(
  amounts: readonly string[],
): ManagedAnnualAmountPlot {
  const values: number[] = [];
  for (const amount of amounts) {
    const value = Number(amount);
    if (
      !withinPlotMagnitude(amount) ||
      !Number.isFinite(value) ||
      (amount !== "0" && value === 0) ||
      value < 0 !== amount.startsWith("-")
    )
      return Object.freeze({
        status: "unavailable",
        reason: "unsafe_plot_value",
      });
    values.push(value);
  }
  return Object.freeze({ status: "ready", values: Object.freeze(values) });
}

// Match the local trend's conservative bound before Number can round away excess.
function withinPlotMagnitude(amount: string): boolean {
  const maximumInteger = "9007199254740991";
  const unsigned = amount.startsWith("-") ? amount.slice(1) : amount;
  const [integer = "", fraction] = unsigned.split(".");
  if (integer.length < maximumInteger.length) return true;
  if (integer.length > maximumInteger.length) return false;
  return (
    integer < maximumInteger ||
    (integer === maximumInteger && fraction === undefined)
  );
}
