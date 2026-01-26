import argparse
import sqlite3

DEFAULT_DBS = [
    r"C:\tmp\ucp_test\transactions_8182.db",
    r"C:\tmp\ucp_test\transactions_8282.db",
]

SEED = [
    ("sku-123", 200),
    ("matte_lipstick", 200),
]

def ensure_inventory(cur):
    # verify table exists
    tables = {r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    if "inventory" not in tables:
        raise RuntimeError("inventory table not found in this DB. Did you point to the right transactions_XXXX.db file?")

    cols = [r[1] for r in cur.execute("PRAGMA table_info(inventory)").fetchall()]
    if not {"product_id", "quantity"}.issubset(set(cols)):
        raise RuntimeError(f"inventory table schema unexpected. columns={cols}")

def seed_db(db_path: str):
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    ensure_inventory(cur)

    for product_id, qty in SEED:
        cur.execute("UPDATE inventory SET quantity=? WHERE product_id=?", (qty, product_id))
        if cur.rowcount == 0:
            cur.execute("INSERT INTO inventory(product_id, quantity) VALUES(?,?)", (product_id, qty))
        print(f"✅ {db_path}: {product_id} => {qty}")

    con.commit()

    rows = cur.execute("SELECT product_id, quantity FROM inventory ORDER BY product_id").fetchall()
    print(f"Inventory now in {db_path}: {rows}")

    con.close()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", action="append", help="Path to transactions db. Can repeat.", default=[])
    args = ap.parse_args()

    dbs = args.db if args.db else DEFAULT_DBS

    for db in dbs:
        seed_db(db)

if __name__ == "__main__":
    main()
