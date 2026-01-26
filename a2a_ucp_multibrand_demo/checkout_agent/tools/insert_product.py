import sqlite3
import json

DB_PATH = r"C:\tmp\ucp_test\products.db"

PRODUCTS = [
    {
        "id": "sku-123",
        "title": "vitamin c serum",
        "amount": 2999,   # cents
        "currency": "USD",
        "image_url": "https://storage.googleapis.com/ucp-demo-assets/vitamin_c_serum.jpg",
    },
    {
        "id": "matte_lipstick",
        "title": "matte lipstick",
        "amount": 1999,   # cents
        "currency": "USD",
        "image_url": "https://storage.googleapis.com/ucp-demo-assets/matte_lipstick.jpg",
    }
]

def build_row_for_schema(cur, product: dict) -> dict:
    cols = [r[1] for r in cur.execute("PRAGMA table_info(products)").fetchall()]
    colset = set(cols)

    data = {}

    # id
    if "id" in colset:
        data["id"] = product["id"]
    else:
        raise RuntimeError("No 'id' column found in products table")

    # title/name
    if "title" in colset:
        data["title"] = product["title"]
    elif "name" in colset:
        data["name"] = product["title"]
    else:
        raise RuntimeError("No title/name column found in products table")

    # image_url
    if "image_url" in colset and "image_url" in product:
        data["image_url"] = product["image_url"]

    # price variants
    # The server schema server/db.py defines price = Column(Integer)  # Price in cents
    if "price_amount" in colset and "price_currency" in colset:
        data["price_amount"] = product["amount"]
        data["price_currency"] = product["currency"]
    elif "price" in colset:
        # FIXED: Server expects an Integer (cents), NOT a JSON string.
        data["price"] = product["amount"]
    elif "amount" in colset and "currency" in colset:
        data["amount"] = product["amount"]
        data["currency"] = product["currency"]
    else:
        # Try common variants
        candidates_amount = [c for c in cols if "price" in c and "amount" in c] + [c for c in cols if "amount" in c]
        candidates_currency = [c for c in cols if "currency" in c]
        if candidates_amount and candidates_currency:
            data[candidates_amount[0]] = product["amount"]
            data[candidates_currency[0]] = product["currency"]
        else:
            raise RuntimeError(f"Could not find usable price columns in products table. Columns={cols}")

    return data

def main():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cols = [r[1] for r in cur.execute("PRAGMA table_info(products)").fetchall()]
    print("products columns:", cols)

    for p in PRODUCTS:
        data = build_row_for_schema(cur, p)
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        sql = f"INSERT OR REPLACE INTO products ({columns}) VALUES ({placeholders})"
        
        cur.execute(sql, list(data.values()))
        print(f"✅ upserted product: {p['id']}")

    con.commit()

    # quick verify
    for p in PRODUCTS:
        row = cur.execute("SELECT * FROM products WHERE id = ?", (p["id"],)).fetchone()
        print("Inserted row:", row)

    con.close()
    print("✅ Done seeding products")

if __name__ == "__main__":
    main()
