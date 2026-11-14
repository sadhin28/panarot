export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("bn-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("bn-BD").format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("bn-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}