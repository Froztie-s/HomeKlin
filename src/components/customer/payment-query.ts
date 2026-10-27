type SearchParams = Record<string, string | string[] | undefined>;

// After paying (or leaving) on Midtrans' payment page, the customer comes back to /orders?booked=<id>
// with Midtrans' own fields added: order_id, status_code and transaction_status (T10). The confirmation
// reads only that the customer came back, to say the payment is being confirmed. What the fields claim
// is never taken as the payment's result: anyone can type them into the address, and the order's
// status changes only through Midtrans' signed notification (T11).

function filled(value: string | string[] | undefined): boolean {
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === "string" && text.trim() !== "";
}

/** Whether the address shows the customer coming back from Midtrans' payment page. */
export function cameBackFromPayment(params: SearchParams): boolean {
  return filled(params.transaction_status) || filled(params.status_code);
}
