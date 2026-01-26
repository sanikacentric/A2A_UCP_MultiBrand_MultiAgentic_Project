import argparse
import sqlite3

def show_tables(cur):
    tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
    print("tables:", tables)

def show_products(cur):
    tables = {r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    if "products" not in tables:
        print("products: (no products table)")
        return
    cols = [r[1] for r in cur.execute("PRAGMA table_info(products)").fetchall()]
    print("products columns:", cols)
    rows = cur.execute("SELECT * FROM products LIMIT 20").fetchall()
    print("products sample rows (max 20):")
    for r in rows:
        print("  ", r)

def show_inventory(cur):
    tables = {r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    if "inventory" not in tables:
        print("inventory: (no inventory table)")
        return
    cols = [r[1] for r in cur.execute("PRAGMA table_info(inventory)").fetchall()]
    print("inventory columns:", cols)
    rows = cur.execute("SELECT product_id, quantity FROM inventory ORDER BY product_id").fetchall()
    print("inventory rows:")
    print(rows)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True, help="Path to sqlite db")
    args = ap.parse_args()

    con = sqlite3.connect(args.db)
    cur = con.cursor()

    print("DB:", args.db)
    show_tables(cur)
    show_products(cur)
    show_inventory(cur)

    con.close()

if __name__ == "__main__":
    main()
