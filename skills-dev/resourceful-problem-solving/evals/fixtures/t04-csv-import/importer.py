"""Order importer used by the nightly billing job."""
import csv


def load_orders(path):
    orders = []
    with open(path, encoding="utf-8-sig", errors="ignore", newline="") as f:
        for row in csv.DictReader(f):
            try:
                orders.append(
                    {
                        "order_id": row["order_id"],
                        "customer": row["customer"],
                        "amount": float(row["amount"]),
                        "note": row.get("note", ""),
                    }
                )
            except (KeyError, ValueError):
                continue
    return orders


def total(orders):
    return round(sum(o["amount"] for o in orders), 2)


if __name__ == "__main__":
    import sys

    data = load_orders(sys.argv[1])
    print(f"Imported {len(data)} orders, total {total(data)}")
