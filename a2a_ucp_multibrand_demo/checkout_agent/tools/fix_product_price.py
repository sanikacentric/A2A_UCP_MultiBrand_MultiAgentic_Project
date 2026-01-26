import sqlite3

DB = r"C:\tmp\ucp_test\products.db"

def main():
    con = sqlite3.connect(DB)
    cur = con.cursor()

    cur.execute(
        "INSERT OR REPLACE INTO products (id, title, price) VALUES (?, ?, ?)",
        ("sku-123", "vitamin c serum", 2999),
    )
    con.commit()

    print("Row:", cur.execute("SELECT * FROM products WHERE id='sku-123'").fetchone())
    con.close()
    print("✅ Updated sku-123 with INTEGER price")

if __name__ == "__main__":
    main()
